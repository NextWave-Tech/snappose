"""Router for dataset management and image importing with automated CLIP embedding."""
import io
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from PIL import Image
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app import storage
from app.clip_engine import embed_image
from app.config import settings
from app.database import get_db
from app.models import Category, Pose
from app.schemas import PoseOut

router = APIRouter(prefix="/api/dataset", tags=["dataset"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


class DatasetCategorySummary(BaseModel):
    id: int
    name: str
    slug: str
    pose_count: int
    embedded_count: int


class DatasetSummaryResponse(BaseModel):
    total_categories: int
    total_poses: int
    total_embedded_poses: int
    categories: list[DatasetCategorySummary]


class DatasetItemOut(BaseModel):
    id: int
    category_id: int
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    name: str
    photo_url: str
    skeleton_url: str
    sort_order: int
    is_active: bool
    has_vector: bool
    vector_dim: int
    vector_preview: Optional[list[float]] = None


class DatasetItemDetailOut(DatasetItemOut):
    vector: Optional[list[float]] = None


class VectorUpdateIn(BaseModel):
    vector: Optional[list[float]] = None
    recompute_from_photo: bool = False


class DatasetItemUpdateIn(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


def _to_dataset_item_out(pose: Pose, include_full_vector: bool = False) -> DatasetItemOut | DatasetItemDetailOut:
    has_vec = pose.embedding is not None and isinstance(pose.embedding, list) and len(pose.embedding) > 0
    dim = len(pose.embedding) if has_vec else 0
    preview = [round(x, 4) for x in pose.embedding[:5]] if has_vec else None

    base_dict = {
        "id": pose.id,
        "category_id": pose.category_id,
        "category_name": pose.category_name,
        "category_slug": pose.category_slug,
        "name": pose.name,
        "photo_url": pose.photo_url,
        "skeleton_url": pose.skeleton_url,
        "sort_order": pose.sort_order,
        "is_active": pose.is_active,
        "has_vector": has_vec,
        "vector_dim": dim,
        "vector_preview": preview,
    }

    if include_full_vector:
        return DatasetItemDetailOut(**base_dict, vector=pose.embedding if has_vec else None)
    return DatasetItemOut(**base_dict)


@router.get("/summary", response_model=DatasetSummaryResponse)
def get_dataset_summary(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.sort_order).all()
    cat_summaries: list[DatasetCategorySummary] = []
    total_poses = 0
    total_embedded = 0

    # One query for every pose instead of one query per category (avoids N+1).
    all_poses = db.query(Pose.category_id, Pose.embedding).all()
    poses_by_cat: dict[int, list] = {}
    for cat_id, embedding in all_poses:
        poses_by_cat.setdefault(cat_id, []).append(embedding)

    for cat in categories:
        embeddings = poses_by_cat.get(cat.id, [])
        p_count = len(embeddings)
        emb_count = sum(1 for e in embeddings if e is not None and len(e) > 0)
        total_poses += p_count
        total_embedded += emb_count

        cat_summaries.append(
            DatasetCategorySummary(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                pose_count=p_count,
                embedded_count=emb_count,
            )
        )

    return DatasetSummaryResponse(
        total_categories=len(categories),
        total_poses=total_poses,
        total_embedded_poses=total_embedded,
        categories=cat_summaries,
    )


@router.get("/items", response_model=list[DatasetItemOut])
def list_dataset_items(
    category_id: Optional[int] = Query(None),
    has_vector: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List dataset poses with filter and vector status."""
    query = db.query(Pose).options(joinedload(Pose.category))

    if category_id is not None:
        query = query.filter(Pose.category_id == category_id)

    if search:
        query = query.filter(Pose.name.ilike(f"%{search.strip()}%"))

    poses = query.order_by(Pose.category_id, Pose.sort_order).all()

    if has_vector is not None:
        if has_vector:
            poses = [p for p in poses if p.embedding is not None and len(p.embedding) > 0]
        else:
            poses = [p for p in poses if p.embedding is None or len(p.embedding) == 0]

    paged = poses[skip : skip + limit]
    return [_to_dataset_item_out(p) for p in paged]


@router.get("/items/{pose_id}", response_model=DatasetItemDetailOut)
def get_dataset_item(pose_id: int, db: Session = Depends(get_db)):
    """Get full details of a dataset item including complete vector."""
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Không tìm thấy pose")
    return _to_dataset_item_out(pose, include_full_vector=True)


@router.put("/items/{pose_id}/vector", response_model=DatasetItemDetailOut)
def update_dataset_vector(pose_id: int, payload: VectorUpdateIn, db: Session = Depends(get_db)):
    """Directly edit a pose's embedding vector or recompute it from photo via CLIP."""
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Không tìm thấy pose")

    if payload.recompute_from_photo:
        obj_name = pose.photo_url.lstrip("/")
        if obj_name.startswith(f"{settings.minio_bucket}/"):
            obj_name = obj_name[len(f"{settings.minio_bucket}/") :]

        try:
            photo_bytes = storage.get_object_bytes(obj_name)
            pil_photo = Image.open(io.BytesIO(photo_bytes)).convert("RGB")
            vector = embed_image(pil_photo)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi khi trích xuất vector từ ảnh: {e}")

        pose.embedding = vector
        db.commit()
        db.refresh(pose)
        return _to_dataset_item_out(pose, include_full_vector=True)

    if payload.vector is not None:
        if not isinstance(payload.vector, list):
            raise HTTPException(status_code=400, detail="Vector phải là một mảng số thực (list of floats)")
        try:
            vector = [float(x) for x in payload.vector]
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Các giá trị trong vector phải là số thực hợp lệ")

        pose.embedding = vector
        db.commit()
        db.refresh(pose)
        return _to_dataset_item_out(pose, include_full_vector=True)

    raise HTTPException(status_code=400, detail="Cần cung cấp vector mới hoặc cờ recompute_from_photo=True")


@router.delete("/items/{pose_id}/vector")
def delete_dataset_vector(pose_id: int, db: Session = Depends(get_db)):
    """Delete/clear the embedding vector of a pose in dataset."""
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Không tìm thấy pose")

    pose.embedding = None
    db.commit()
    db.refresh(pose)
    return {"success": True, "message": f"Đã xóa vector của pose {pose_id}", "pose_id": pose_id}


@router.delete("/items/{pose_id}")
def delete_dataset_item(pose_id: int, db: Session = Depends(get_db)):
    """Delete a pose item completely from dataset."""
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Không tìm thấy pose")

    # Optionally remove MinIO photo and skeleton
    for url in [pose.photo_url, pose.skeleton_url]:
        if url and url.startswith(f"/{settings.minio_bucket}/"):
            obj = url[len(f"/{settings.minio_bucket}/") :]
            storage.delete_object(obj)

    db.delete(pose)
    db.commit()
    return {"success": True, "message": f"Đã xóa pose '{pose.name}' (id={pose_id}) thành công", "pose_id": pose_id}


@router.patch("/items/{pose_id}", response_model=DatasetItemOut)
def patch_dataset_item(pose_id: int, payload: DatasetItemUpdateIn, db: Session = Depends(get_db)):
    """Update dataset item metadata (name, category, active status, sort order)."""
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Không tìm thấy pose")

    if payload.name is not None:
        pose.name = payload.name.strip()
    if payload.category_id is not None:
        cat = db.get(Category, payload.category_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Category không tồn tại")
        pose.category_id = payload.category_id
    if payload.is_active is not None:
        pose.is_active = payload.is_active
    if payload.sort_order is not None:
        pose.sort_order = payload.sort_order

    db.commit()
    db.refresh(pose)
    return _to_dataset_item_out(pose)


@router.post("/import", response_model=PoseOut)
async def import_dataset_pose(
    category_id: int = Form(...),
    name: str = Form(...),
    photo: UploadFile = File(...),
    skeleton: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Import a photo into the dataset: upload to MinIO, compute CLIP embedding, and save to DB."""
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy category")

    # 1. Validate and read photo
    photo_ext = os.path.splitext(photo.filename or "")[1].lower()
    if photo_ext not in ALLOWED_EXTENSIONS:
        photo_ext = ".png"

    photo_bytes = await photo.read()
    if len(photo_bytes) == 0:
        raise HTTPException(status_code=400, detail="File ảnh rỗng")

    try:
        pil_photo = Image.open(io.BytesIO(photo_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Không thể đọc file ảnh")

    # 2. Upload photo to MinIO
    storage.ensure_bucket()
    unique_id = uuid.uuid4().hex[:10]
    photo_obj = f"poses/{category.slug}/{unique_id}-photo{photo_ext}"
    photo_url = storage.upload(photo_obj, photo_bytes, CONTENT_TYPES.get(photo_ext, "image/png"))

    # 3. Handle skeleton outline
    if skeleton is not None:
        skel_ext = os.path.splitext(skeleton.filename or "")[1].lower()
        if skel_ext not in ALLOWED_EXTENSIONS:
            skel_ext = ".png"
        skel_bytes = await skeleton.read()
        skel_obj = f"poses/{category.slug}/{unique_id}-skeleton{skel_ext}"
        skeleton_url = storage.upload(skel_obj, skel_bytes, CONTENT_TYPES.get(skel_ext, "image/png"))
    else:
        skeleton_url = photo_url

    # 4. Compute CLIP embedding for photo
    try:
        embedding_vector = embed_image(pil_photo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tính CLIP embedding: {e}")

    # 5. Insert Pose into database
    next_sort = db.query(Pose).filter(Pose.category_id == category_id).count() + 1
    pose = Pose(
        category_id=category_id,
        name=name.strip() or f"Pose {next_sort:02d}",
        photo_url=photo_url,
        skeleton_url=skeleton_url,
        sort_order=next_sort,
        is_active=True,
        embedding=embedding_vector,
    )
    db.add(pose)
    db.commit()
    db.refresh(pose)

    return PoseOut.model_validate(pose)

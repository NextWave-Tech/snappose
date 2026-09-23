"""POST /api/suggest-pose & /api/match-image — AI-powered pose suggestion and environment matching."""
import base64
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.clip_engine import cosine_similarity, embed_image
from app.database import get_db
from app.models import Category, Pose
from app.schemas import EnvironmentScore, MatchImageResponse, PoseOut

router = APIRouter(prefix="/api", tags=["suggest"])


class SuggestRequest(BaseModel):
    image: str  # base64 data-URL or raw base64
    category_id: Optional[int] = None
    top_k: int = 5


def _decode_image_from_base64(data: str) -> Image.Image:
    """Decode a base64 (or data-URL) string into a PIL Image."""
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _process_image_matching(img: Image.Image, category_id: Optional[int], top_k: int, db: Session):
    query_vec = embed_image(img)

    # 1. Fetch active poses that have embeddings
    q = db.query(Pose).options(joinedload(Pose.category)).filter(Pose.is_active.is_(True), Pose.embedding.isnot(None))
    if category_id is not None:
        cat_poses = q.filter(Pose.category_id == category_id).all()
        poses = cat_poses if cat_poses else q.all()
    else:
        poses = q.all()

    if not poses:
        raise HTTPException(status_code=404, detail="Chưa có pose nào có dữ liệu embedding trong hệ thống")

    # 2. Rank poses by cosine similarity descending
    scored = [
        (cosine_similarity(query_vec, p.embedding), p)
        for p in poses
    ]
    scored.sort(key=lambda item: item[0], reverse=True)

    # Build PoseOut with similarity
    results: list[PoseOut] = []
    for score, p in scored[:top_k]:
        out = PoseOut.model_validate(p)
        out.similarity = round(score, 4)
        results.append(out)

    # 3. Aggregate environment / category scores
    cat_scores: dict[int, list[float]] = {}
    cat_map: dict[int, Category] = {}
    for score, p in scored:
        if p.category_id not in cat_scores:
            cat_scores[p.category_id] = []
            cat_map[p.category_id] = p.category
        cat_scores[p.category_id].append(score)

    env_list: list[EnvironmentScore] = []
    for cat_id, scores in cat_scores.items():
        cat = cat_map.get(cat_id)
        if not cat:
            continue
        max_s = max(scores)
        conf_pct = round(max(0.0, min(100.0, ((max_s + 1.0) / 2.0) * 100)), 1)
        env_list.append(
            EnvironmentScore(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                score=round(max_s, 4),
                confidence_percent=conf_pct,
            )
        )
    env_list.sort(key=lambda e: e.score, reverse=True)
    detected = env_list[0] if env_list else None

    return results, detected, env_list


@router.post("/suggest-pose", response_model=list[PoseOut])
def suggest_pose(body: SuggestRequest, db: Session = Depends(get_db)):
    try:
        img = _decode_image_from_base64(body.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    k = max(1, min(body.top_k, 20))
    matches, _, _ = _process_image_matching(img, body.category_id, k, db)
    return matches


@router.post("/match-image", response_model=MatchImageResponse)
def match_image(body: SuggestRequest, db: Session = Depends(get_db)):
    """Analyze uploaded base64/dataURL image: identify environment and return most related poses."""
    try:
        img = _decode_image_from_base64(body.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    k = max(1, min(body.top_k, 30))
    matches, detected_env, env_list = _process_image_matching(img, body.category_id, k, db)

    return MatchImageResponse(
        detected_environment=detected_env,
        environments=env_list,
        matches=matches,
    )


@router.post("/match-image-file", response_model=MatchImageResponse)
async def match_image_file(file: UploadFile = File(...), top_k: int = Form(10), db: Session = Depends(get_db)):
    """Analyze an uploaded multipart image file."""
    content = await file.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Định dạng file ảnh không hợp lệ")

    k = max(1, min(top_k, 30))
    matches, detected_env, env_list = _process_image_matching(img, None, k, db)

    return MatchImageResponse(
        detected_environment=detected_env,
        environments=env_list,
        matches=matches,
    )

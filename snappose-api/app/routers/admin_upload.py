import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.auth import require_admin
from app import storage
from app.schemas import UploadResponse

router = APIRouter(prefix="/api/admin/upload", tags=["admin-upload"], dependencies=[Depends(require_admin)])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
MAX_SIZE_BYTES = 8 * 1024 * 1024


@router.post("", response_model=UploadResponse)
async def upload_image(file: UploadFile):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ ảnh jpg/png/webp")

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Ảnh tối đa 8MB")

    object_name = f"uploads/{uuid.uuid4().hex}{ext}"
    url = storage.upload(object_name, contents, CONTENT_TYPES[ext])
    return UploadResponse(url=url)

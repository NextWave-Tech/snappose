from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import Pose
from app.schemas import PoseCreate, PoseOut, PoseUpdate

router = APIRouter(prefix="/api/admin/poses", tags=["admin-poses"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[PoseOut])
def list_poses(category_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Pose)
    if category_id is not None:
        query = query.filter(Pose.category_id == category_id)
    return query.order_by(Pose.category_id, Pose.sort_order).all()


@router.post("", response_model=PoseOut)
def create_pose(payload: PoseCreate, db: Session = Depends(get_db)):
    pose = Pose(**payload.model_dump())
    db.add(pose)
    db.commit()
    db.refresh(pose)
    return pose


@router.put("/{pose_id}", response_model=PoseOut)
def update_pose(pose_id: int, payload: PoseUpdate, db: Session = Depends(get_db)):
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Pose not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pose, field, value)
    db.commit()
    db.refresh(pose)
    return pose


@router.delete("/{pose_id}")
def delete_pose(pose_id: int, db: Session = Depends(get_db)):
    pose = db.get(Pose, pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail="Pose not found")
    db.delete(pose)
    db.commit()
    return {"ok": True}

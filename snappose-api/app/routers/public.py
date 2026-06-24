from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Pose
from app.schemas import CategoryOut, PoseOut

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.sort_order)
        .all()
    )


@router.get("/poses", response_model=list[PoseOut])
def list_poses(category_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Pose).filter(Pose.is_active.is_(True))
    if category_id is not None:
        query = query.filter(Pose.category_id == category_id)
    return query.order_by(Pose.sort_order).all()

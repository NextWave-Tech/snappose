from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

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
    # joinedload(Pose.category) avoids one extra SELECT per pose (N+1) when
    # serializing PoseOut.category_name/category_slug below.
    query = db.query(Pose).options(joinedload(Pose.category)).filter(Pose.is_active.is_(True))
    if category_id is not None:
        query = query.filter(Pose.category_id == category_id)
    return query.order_by(Pose.sort_order).all()

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship

from app.database import Base


class Pose(Base):
    __tablename__ = "poses"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    photo_url = Column(String, nullable=False)
    skeleton_url = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    embedding = Column(JSON, nullable=True)
    gender = Column(String, nullable=True)  # "nam" | "nu" | None (chưa gán nhãn)

    category = relationship("Category", back_populates="poses")

    @property
    def category_name(self) -> str | None:
        return self.category.name if self.category else None

    @property
    def category_slug(self) -> str | None:
        return self.category.slug if self.category else None

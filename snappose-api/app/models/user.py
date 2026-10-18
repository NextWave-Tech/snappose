from sqlalchemy import Column, DateTime, Integer, String, func

from app.database import Base


class User(Base):
    """An app user, signed in with Google. `google_sub` is Google's stable account id."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

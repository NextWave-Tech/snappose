from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, require_admin, verify_password
from app.database import get_db
from app.models import AdminUser
from app.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/admin", tags=["admin-auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai tài khoản hoặc mật khẩu")
    token = create_access_token(user.username)
    return TokenResponse(access_token=token)


@router.get("/me")
def me(username: str = Depends(require_admin)):
    return {"username": username}

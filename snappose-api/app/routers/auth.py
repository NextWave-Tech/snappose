from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import create_user_token, require_user
from app.database import get_db
from app.google_auth import GoogleTokenError, verify_google_id_token
from app.models import User
from app.schemas import GoogleLoginRequest, UserOut, UserTokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/google", response_model=UserTokenResponse)
def login_with_google(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Exchanges a Google ID token from the app for a SnapPose token, creating the user on first login."""
    try:
        claims = verify_google_id_token(payload.id_token)
    except GoogleTokenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error))

    user = db.query(User).filter(User.google_sub == claims["sub"]).first()
    if user is None:
        user = User(google_sub=claims["sub"], email=claims["email"])
        db.add(user)
    # Keep the profile in step with the Google account.
    user.email = claims["email"]
    user.name = claims.get("name")
    user.avatar_url = claims.get("picture")
    user.last_login_at = func.now()
    db.commit()
    db.refresh(user)
    return UserTokenResponse(access_token=create_user_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user_id: int = Depends(require_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return user

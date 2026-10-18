from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

bearer_scheme = HTTPBearer()

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7
USER_TOKEN_EXPIRE_DAYS = 30
# App-user tokens carry this type so they can never pass as an admin token (both share the secret).
USER_TOKEN_TYPE = "user"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_user_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=USER_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "typ": USER_TOKEN_TYPE, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def _decode(credentials: HTTPAuthorizationCredentials) -> dict:
    try:
        return jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    payload = _decode(credentials)
    if payload.get("typ") == USER_TOKEN_TYPE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload["sub"]


def require_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> int:
    """The signed-in app user's id."""
    payload = _decode(credentials)
    if payload.get("typ") != USER_TOKEN_TYPE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return int(payload["sub"])

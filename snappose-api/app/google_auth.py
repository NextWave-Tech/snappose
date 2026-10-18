"""Verifies Google ID tokens (from the mobile app's Google Sign-In) against Google's public keys."""
import time

import httpx
from jose import JWTError, jwt

from app.config import settings

_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
# Google rotates its signing keys every few days; refetching hourly is plenty.
_CERTS_TTL_S = 3600

_certs: dict | None = None
_certs_fetched_at = 0.0


class GoogleTokenError(Exception):
    pass


def _google_certs(force: bool = False) -> dict:
    global _certs, _certs_fetched_at
    if force or _certs is None or time.time() - _certs_fetched_at > _CERTS_TTL_S:
        response = httpx.get(_CERTS_URL, timeout=10)
        response.raise_for_status()
        _certs = response.json()
        _certs_fetched_at = time.time()
    return _certs


def _allowed_audiences() -> set[str]:
    return {client_id.strip() for client_id in settings.google_client_ids.split(",") if client_id.strip()}


def verify_google_id_token(id_token: str) -> dict:
    """Returns the token's claims (sub, email, name, picture, ...) or raises GoogleTokenError."""
    audiences = _allowed_audiences()
    if not audiences:
        raise GoogleTokenError("GOOGLE_CLIENT_IDS is not configured on the server")

    try:
        kid = jwt.get_unverified_header(id_token).get("kid")
        certs = _google_certs()
        if kid not in {key.get("kid") for key in certs.get("keys", [])}:
            # A key we haven't seen yet: Google may have just rotated.
            certs = _google_certs(force=True)
        # The audience is checked below against several client ids, which python-jose can't do.
        claims = jwt.decode(id_token, certs, algorithms=["RS256"], options={"verify_aud": False})
    except (JWTError, httpx.HTTPError) as error:
        raise GoogleTokenError(f"Invalid Google token: {error}") from error

    if claims.get("iss") not in _ISSUERS:
        raise GoogleTokenError("Token was not issued by Google")
    if claims.get("aud") not in audiences:
        raise GoogleTokenError("Token was issued for a different app")
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleTokenError("Google account has no verified email")
    return claims

import hashlib
import hmac
import os
import sys
import warnings
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

DEFAULT_SECRET_KEY = "dev-only-change-me"
KNOWN_INSECURE_SECRETS = frozenset(
    {
        DEFAULT_SECRET_KEY,
        "change-this-in-production",
        "changeme",
        "secret",
    }
)
SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
ALGORITHM = "HS256"
bearer = HTTPBearer(auto_error=False)


def is_insecure_secret(secret: str | None) -> bool:
    return not secret or not secret.strip() or secret.strip() in KNOWN_INSECURE_SECRETS


def resolve_environment(environment: str | None = None) -> str:
    raw = environment if environment is not None else os.getenv("PYTRAIL_ENV", os.getenv("ENV", "development"))
    return (raw or "development").strip().lower()


def is_production_environment(environment: str | None = None) -> bool:
    return resolve_environment(environment) in {"production", "prod"}


def enforce_secret_key_policy(secret: str | None = None, environment: str | None = None) -> str:
    """Refuse a known-default key in production; warn loudly in demo mode."""
    value = SECRET_KEY if secret is None else secret
    if not is_insecure_secret(value):
        return value
    message = (
        "SECRET_KEY is unset or matches a known default. "
        "Set a long random SECRET_KEY before exposing this API."
    )
    if is_production_environment(environment):
        raise RuntimeError(message)
    warnings.warn(message, UserWarning, stacklevel=2)
    print(f"WARNING: {message}", file=sys.stderr)
    return value


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split(":", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 120_000)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": str(user_id), "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", ""))
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

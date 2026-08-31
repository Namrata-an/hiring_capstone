"""Authentication service - JWT tokens and password hashing."""
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from database import get_db
from models import User

# Password hashing - use sha256_crypt for simplicity (bcrypt has issues with newer versions)
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# Bearer token extraction
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    # DEBUG: Print token info (first 10 chars and length) to avoid leaking full token in logs
    # but help diagnose issues.
    print(f"DEBUG: Receiving token. Length: {len(token)}, Starts with: {token[:10]}...")
    
    payload = decode_token(token)
    
    if payload is None:
        print(f"DEBUG: Token decoding failed for token: {token[:10]}...")
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        print(f"DEBUG: No 'sub' in payload")
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        print(f"DEBUG: User not found for id: {user_id}")
        raise credentials_exception
    
    return user


def require_hr_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to require HR admin role."""
    from models import UserRole
    if current_user.role != UserRole.HR_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR Admin access required"
        )
    return current_user

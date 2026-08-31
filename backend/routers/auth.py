"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole
from schemas import UserRegister, UserLogin, AuthResponse, UserResponse, RolesResponse, SwitchRoleRequest, SwitchRoleResponse
from services.auth_service import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=hash_password(user_data.password)
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Generate token
    access_token = create_access_token(data={"sub": user.id})
    
    return AuthResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role
        )
    )


@router.post("/login", response_model=AuthResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return token."""
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate token
    access_token = create_access_token(data={"sub": user.id})
    
    return AuthResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role
        )
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(__import__('services.auth_service', fromlist=['get_current_user']).get_current_user)
):
    """Get current authenticated user info."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role
    )


@router.get("/my-roles", response_model=RolesResponse)
def get_my_roles(
    current_user: User = Depends(__import__('services.auth_service', fromlist=['get_current_user']).get_current_user)
):
    """Get all roles available to the current user.
    
    For now returns the user's current role. In future could support users with multiple roles.
    For demo/development mode, returns both roles to allow easy switching.
    """
    # In demo mode, allow switching between all roles
    demo_mode = True  # Set to False in production to restrict to actual user roles
    
    if demo_mode:
        available_roles = ["hr_admin", "interviewer"]
    else:
        available_roles = [current_user.role.value if hasattr(current_user.role, 'value') else current_user.role]
    
    return RolesResponse(
        roles=available_roles,
        current_role=current_user.role.value if hasattr(current_user.role, 'value') else current_user.role
    )


@router.post("/switch-role", response_model=SwitchRoleResponse)
def switch_role(
    request: SwitchRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(__import__('services.auth_service', fromlist=['get_current_user']).get_current_user)
):
    """Switch to a different role (for users with multiple roles or demo mode).
    
    For development/demo: Allows switching between any roles for easier testing.
    For production: Should validate that user actually has the requested role.
    """
    valid_roles = ["hr_admin", "interviewer"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # For demo mode: Update user's role in database
    # In production, you might just change the token claim without changing DB
    demo_mode = True
    
    if demo_mode:
        # Update user role in database
        current_user.role = UserRole(request.role)
        db.commit()
        db.refresh(current_user)
    else:
        # Production: Verify user has the requested role
        if current_user.role.value != request.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this role"
            )
    
    # Generate new token
    new_token = create_access_token(data={"sub": current_user.id})
    
    return SwitchRoleResponse(
        token=new_token,
        role=current_user.role.value if hasattr(current_user.role, 'value') else current_user.role,
        user=UserResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            role=current_user.role
        )
    )

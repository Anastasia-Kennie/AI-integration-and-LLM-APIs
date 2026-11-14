from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut, Token, LoginRequest
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserOut, status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        is_approved=False,
        phone_number=user_data.phone_number,
        birthday=user_data.birthday,
        address=user_data.address,
        nationality=user_data.nationality,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Notify all online managers of the new registration
    from app.routers.chat import notify_user, presence_sockets
    manager_result = await db.execute(
        select(User).where(User.role == 'manager', User.is_active == True)
    )
    manager_ids = {u.id for u in manager_result.scalars().all()}
    for mid in list(presence_sockets.keys()):
        if mid in manager_ids:
            await notify_user(mid, {
                "type": "new_registration",
                "name": user.name,
                "email": user.email,
            })

    return user

@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending approval. Please wait for the admin to approve your registration.")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.post("/logout")
async def logout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Set last_seen to epoch so presence_status immediately returns "offline"
    current_user.last_seen = datetime(1970, 1, 1, tzinfo=timezone.utc)
    await db.commit()

    # Notify all other connected users that presence changed
    from app.routers.chat import notify_user, presence_sockets, online_user_ids
    online_user_ids.discard(current_user.id)
    for uid in list(presence_sockets.keys()):
        if uid != current_user.id:
            await notify_user(uid, {"type": "presence_changed"})

    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

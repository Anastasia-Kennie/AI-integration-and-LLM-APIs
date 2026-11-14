from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timezone
from app.database import get_db
from app.models import User
from app.schemas import UserOut, UserUpdate
from app.auth import get_current_user, require_manager, verify_password, get_password_hash

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.is_active == True, User.is_approved == True))
    return result.scalars().all()

@router.get("/pending", response_model=List[UserOut])
async def pending_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(User).where(User.is_approved == False).order_by(User.created_at.desc()))
    return result.scalars().all()

@router.post("/{user_id}/approve", response_model=UserOut)
async def approve_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = True
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}/reject")
async def reject_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"message": "User rejected and removed"}

@router.patch("/me", response_model=UserOut)
async def update_me(
    updates: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if updates.name:
        current_user.name = updates.name
    if updates.avatar is not None:
        current_user.avatar = updates.avatar
    if updates.phone_number is not None:
        current_user.phone_number = updates.phone_number
    if updates.birthday is not None:
        current_user.birthday = updates.birthday
    if updates.address is not None:
        current_user.address = updates.address
    if updates.nationality is not None:
        current_user.nationality = updates.nationality

    if updates.new_password:
        if not updates.current_password:
            raise HTTPException(status_code=400, detail="Current password required to set a new password")
        if not verify_password(updates.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.hashed_password = get_password_hash(updates.new_password)

    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.delete("/{user_id}/avatar")
async def reset_avatar(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.avatar = None
    await db.commit()
    return {"message": "Avatar reset"}

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models import (
        DirectInvitation, ChatMessage, ChatRoom, RoomLastRead,
        ProjectMember, ProjectFile, AIConversation
    )
    from sqlalchemy import or_, delete as sql_delete

    # Find all chat rooms this user is part of via invitations
    inv_result = await db.execute(
        select(DirectInvitation).where(
            or_(DirectInvitation.from_id == user_id, DirectInvitation.to_id == user_id)
        )
    )
    invitations = inv_result.scalars().all()
    room_ids = [inv.room_id for inv in invitations if inv.room_id]

    # Delete all chat messages in those rooms + messages sent by user
    if room_ids:
        await db.execute(sql_delete(ChatMessage).where(ChatMessage.room_id.in_(room_ids)))
        await db.execute(sql_delete(RoomLastRead).where(RoomLastRead.room_id.in_(room_ids)))
    await db.execute(sql_delete(ChatMessage).where(ChatMessage.sender_id == user_id))
    await db.execute(sql_delete(RoomLastRead).where(RoomLastRead.user_id == user_id))

    # Delete invitations and their rooms
    await db.execute(sql_delete(DirectInvitation).where(
        or_(DirectInvitation.from_id == user_id, DirectInvitation.to_id == user_id)
    ))
    if room_ids:
        await db.execute(sql_delete(ChatRoom).where(ChatRoom.id.in_(room_ids)))

    # Delete project memberships and files uploaded by this user
    await db.execute(sql_delete(ProjectMember).where(ProjectMember.user_id == user_id))
    await db.execute(sql_delete(ProjectFile).where(ProjectFile.uploader_id == user_id))

    # Delete AI conversation history
    await db.execute(sql_delete(AIConversation).where(AIConversation.user_id == user_id))

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}

@router.post("/heartbeat")
async def heartbeat(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.last_seen = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "ok"}

@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

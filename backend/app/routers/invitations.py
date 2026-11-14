from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, cast, Date
from sqlalchemy.orm import selectinload
from typing import List
from datetime import date
from app.database import get_db
from app.models import User, DirectInvitation, ChatRoom
from app.schemas import InvitationOut, InvitationCreate
from app.auth import get_current_user

DAILY_INVITE_LIMIT = 10

async def _invites_sent_today(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count(DirectInvitation.id)).where(
            DirectInvitation.from_id == user_id,
            cast(DirectInvitation.created_at, Date) == date.today(),
        )
    )
    return result.scalar() or 0

router = APIRouter(prefix="/api/invitations", tags=["invitations"])

@router.post("/", response_model=InvitationOut, status_code=201)
async def send_invitation(
    data: InvitationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sent_today = await _invites_sent_today(db, current_user.id)
    if sent_today >= DAILY_INVITE_LIMIT:
        raise HTTPException(429, f"Daily invitation limit reached ({DAILY_INVITE_LIMIT}/day). Try again tomorrow.")

    result = await db.execute(select(User).where(User.email == data.to_email))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "No user found with that email")
    if target.id == current_user.id:
        raise HTTPException(400, "Cannot invite yourself")

    existing = await db.execute(
        select(DirectInvitation).where(
            or_(
                (DirectInvitation.from_id == current_user.id) & (DirectInvitation.to_id == target.id),
                (DirectInvitation.from_id == target.id) & (DirectInvitation.to_id == current_user.id),
            ),
            DirectInvitation.status.in_(["pending", "accepted"])
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Invitation already exists or you are already connected")

    inv = DirectInvitation(from_id=current_user.id, to_id=target.id)
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    result = await db.execute(
        select(DirectInvitation)
        .options(selectinload(DirectInvitation.from_user), selectinload(DirectInvitation.to_user))
        .where(DirectInvitation.id == inv.id)
    )
    inv = result.scalar_one()

    from app.routers.chat import notify_user
    await notify_user(target.id, {"type": "invitation", "from_name": current_user.name})

    return inv


@router.get("/remaining")
async def remaining_invites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sent = await _invites_sent_today(db, current_user.id)
    return {"remaining": max(0, DAILY_INVITE_LIMIT - sent), "limit": DAILY_INVITE_LIMIT}

@router.get("/received", response_model=List[InvitationOut])
async def get_received(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(DirectInvitation)
        .options(selectinload(DirectInvitation.from_user), selectinload(DirectInvitation.to_user))
        .where(DirectInvitation.to_id == current_user.id, DirectInvitation.status == "pending")
        .order_by(DirectInvitation.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{inv_id}/accept", response_model=InvitationOut)
async def accept_invitation(
    inv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(DirectInvitation)
        .options(selectinload(DirectInvitation.from_user), selectinload(DirectInvitation.to_user))
        .where(DirectInvitation.id == inv_id, DirectInvitation.to_id == current_user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invitation not found")
    if inv.status != "pending":
        raise HTTPException(400, "Invitation is not pending")

    room = ChatRoom(
        name=f"dm_{min(inv.from_id, inv.to_id)}_{max(inv.from_id, inv.to_id)}",
        is_private=True,
        created_by=current_user.id
    )
    db.add(room)
    await db.flush()

    inv.status = "accepted"
    inv.room_id = room.id
    await db.commit()

    from app.routers.chat import notify_user
    await notify_user(inv.from_id, {"type": "accepted", "by_name": current_user.name, "room_id": room.id})

    result = await db.execute(
        select(DirectInvitation)
        .options(selectinload(DirectInvitation.from_user), selectinload(DirectInvitation.to_user))
        .where(DirectInvitation.id == inv_id)
    )
    return result.scalar_one()


@router.post("/{inv_id}/decline")
async def decline_invitation(
    inv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(DirectInvitation)
        .where(DirectInvitation.id == inv_id, DirectInvitation.to_id == current_user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invitation not found")
    inv.status = "declined"
    await db.commit()
    return {"message": "Declined"}

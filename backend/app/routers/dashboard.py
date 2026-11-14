from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from datetime import datetime, date, timedelta, timezone
from typing import List
from app.database import get_db
from app.models import User, ChatMessage, ChatRoom, Project, AIConversation
from app.schemas import DashboardStats, ConversationVolume, OnlineMember
from app.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True, User.is_approved == True)
    )
    team_members = members_result.scalar() or 0

    today = date.today()
    msgs_result = await db.execute(
        select(func.count(ChatMessage.id)).where(
            cast(ChatMessage.created_at, Date) == today
        )
    )
    messages_today = msgs_result.scalar() or 0

    rooms_result = await db.execute(select(func.count(ChatRoom.id)))
    active_chats = rooms_result.scalar() or 0

    projects_result = await db.execute(
        select(func.count(Project.id)).where(Project.is_active == True)
    )
    projects = projects_result.scalar() or 0

    return DashboardStats(
        team_members=team_members,
        messages_today=messages_today,
        active_chats=active_chats,
        projects=projects,
    )


@router.get("/conversation-volume", response_model=List[ConversationVolume])
async def get_conversation_volume(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = date.today()
    result = await db.execute(
        select(
            cast(ChatMessage.created_at, Date).label("day"),
            func.count(ChatMessage.id).label("messages"),
        )
        .where(ChatMessage.created_at >= datetime.combine(today - timedelta(days=6), datetime.min.time()))
        .group_by(cast(ChatMessage.created_at, Date))
        .order_by(cast(ChatMessage.created_at, Date))
    )
    rows = {row.day: row.messages for row in result.all()}

    output = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        output.append(ConversationVolume(
            day=d.strftime("%a"),
            messages=rows.get(d, 0),
        ))
    return output


@router.get("/online-members", response_model=List[OnlineMember])
async def get_online_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.routers.chat import presence_status
    result = await db.execute(
        select(User).where(User.is_active == True, User.is_approved == True)
        .order_by(User.last_seen.desc().nullslast())
    )
    users = result.scalars().all()
    members = [
        OnlineMember(id=u.id, name=u.name, avatar=u.avatar, role=u.role, status=presence_status(u))
        for u in users
    ]
    members.sort(key=lambda m: (0 if m.status == "online" else 1 if m.status == "away" else 2))
    return members


@router.get("/recent-activity")
async def get_recent_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatMessage, User.name.label("sender_name"), User.avatar.label("sender_avatar"), ChatRoom.name.label("room_name"))
        .join(User, ChatMessage.sender_id == User.id)
        .join(ChatRoom, ChatMessage.room_id == ChatRoom.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    rows = result.all()
    now = datetime.now(timezone.utc)
    output = []
    for msg, sender_name, sender_avatar, room_name in rows:
        created = msg.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        diff = int((now - created).total_seconds())
        if diff < 60:
            time_str = f"{diff}s ago"
        elif diff < 3600:
            time_str = f"{diff // 60}m ago"
        elif diff < 86400:
            time_str = f"{diff // 3600}h ago"
        else:
            time_str = f"{diff // 86400}d ago"
        output.append({
            "id": msg.id,
            "sender_name": sender_name,
            "sender_avatar": sender_avatar,
            "room_name": room_name,
            "content": msg.content[:80],
            "time": time_str,
        })
    return output

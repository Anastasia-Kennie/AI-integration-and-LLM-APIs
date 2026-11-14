from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import List
from app.database import get_db
from app.models import Ticket, TicketStatus, User
from app.schemas import DashboardStats, ConversationVolume, TicketByCategory, SatisfactionStats
from app.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

CATEGORY_COLORS = {
    "Shipping": "#6366f1",
    "Payment": "#22c55e",
    "Refund": "#3b82f6",
    "Order": "#f97316",
    "Technical": "#06b6d4",
    "Login": "#ec4899",
}

@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    open_result = await db.execute(select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.open))
    open_count = open_result.scalar() or 0

    waiting_result = await db.execute(select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.pending))
    waiting_count = waiting_result.scalar() or 0

    resolved_result = await db.execute(
        select(func.count(Ticket.id)).where(
            Ticket.status == TicketStatus.resolved,
            func.date(Ticket.updated_at) == date.today()
        )
    )
    resolved_count = resolved_result.scalar() or 0

    return DashboardStats(
        open_conversations=open_count or 128,
        waiting_for_reply=waiting_count or 24,
        resolved_today=resolved_count or 342,
        avg_response_time="4m 12s",
        open_change=12.0,
        waiting_change=-8.0,
        resolved_change=18.0,
        response_change=-8.0,
    )

@router.get("/conversation-volume", response_model=List[ConversationVolume])
async def get_conversation_volume(current_user: User = Depends(get_current_user)):
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    incoming = [220, 280, 300, 460, 350, 110, 80]
    resolved = [100, 230, 250, 310, 290, 100, 60]
    return [ConversationVolume(day=days[i], incoming=incoming[i], resolved=resolved[i]) for i in range(7)]

@router.get("/tickets-by-category", response_model=List[TicketByCategory])
async def get_tickets_by_category(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Ticket.category, func.count(Ticket.id).label("count"))
        .group_by(Ticket.category)
        .order_by(func.count(Ticket.id).desc())
    )
    rows = result.all()

    if not rows:
        default = [
            ("Shipping", 128), ("Payment", 86), ("Refund", 64),
            ("Order", 52), ("Technical", 41), ("Login", 28),
        ]
        return [TicketByCategory(category=c, count=n, color=CATEGORY_COLORS.get(c, "#6366f1")) for c, n in default]

    return [
        TicketByCategory(category=row.category, count=row.count, color=CATEGORY_COLORS.get(row.category, "#6366f1"))
        for row in rows
    ]

@router.get("/satisfaction", response_model=SatisfactionStats)
async def get_satisfaction(current_user: User = Depends(get_current_user)):
    return SatisfactionStats(percentage=94.0, happy=218, neutral=12, unhappy=8)

@router.get("/recent-tickets")
async def get_recent_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Ticket).order_by(Ticket.created_at.desc()).limit(10))
    tickets = result.scalars().all()

    if not tickets:
        return [
            {"id": 1, "customer_name": "Bessie Cooper", "subject": "Where is my order?", "channel": "WhatsApp", "status": "open", "time": "2m ago"},
            {"id": 2, "customer_name": "Brooklyn Simmons", "subject": "Payment failed", "channel": "Website", "status": "resolved", "time": "8m ago"},
            {"id": 3, "customer_name": "Eleanor Pena", "subject": "Refund request", "channel": "Email", "status": "pending", "time": "14m ago"},
            {"id": 4, "customer_name": "Darlene Robertson", "subject": "Can't login", "channel": "WhatsApp", "status": "open", "time": "21m ago"},
        ]

    now = datetime.utcnow()
    return [
        {
            "id": t.id,
            "customer_name": t.customer_name,
            "subject": t.subject,
            "channel": t.channel,
            "status": t.status,
            "time": f"{(now - t.created_at.replace(tzinfo=None)).seconds // 60}m ago",
        }
        for t in tickets
    ]

"""Seed database — creates only the admin account (Peter Rizk)."""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, create_tables
from app.models import User, Ticket, TicketStatus, TicketCategory, Channel, ChatRoom, UserRole
from app.auth import get_password_hash

async def seed():
    await create_tables()
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "petegrizk.engineer@gmail.com"))
        if existing.scalar_one_or_none():
            print("Admin already exists — skipping seed.")
            return

        admin = User(
            name="Peter Rizk",
            email="petegrizk.engineer@gmail.com",
            hashed_password=get_password_hash("1234567890"),
            role=UserRole.manager,
            is_approved=True,
        )
        db.add(admin)
        await db.flush()

        tickets_data = [
            ("Bessie Cooper",    "Where is my order?", Channel.whatsapp, TicketStatus.open,     TicketCategory.order),
            ("Brooklyn Simmons", "Payment failed",      Channel.website,  TicketStatus.resolved, TicketCategory.payment),
            ("Eleanor Pena",     "Refund request",      Channel.email,    TicketStatus.pending,  TicketCategory.refund),
            ("Darlene Robertson","Can't login",         Channel.whatsapp, TicketStatus.open,     TicketCategory.login),
            ("Jacob Jones",      "Shipping delay",      Channel.email,    TicketStatus.open,     TicketCategory.shipping),
            ("Kathryn Murphy",   "Technical issue",     Channel.website,  TicketStatus.pending,  TicketCategory.technical),
        ]
        for name, subject, channel, status, category in tickets_data:
            db.add(Ticket(customer_name=name, subject=subject, channel=channel, status=status, category=category))

        db.add(ChatRoom(name="General", is_private=False, created_by=admin.id))
        await db.commit()
        print("✓ Database seeded.")
        print("  Admin: petegrizk.engineer@gmail.com / 1234567890")

if __name__ == "__main__":
    asyncio.run(seed())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import create_tables, AsyncSessionLocal
from app.routers import auth, users, projects, chat, ai, dashboard, invitations

app = FastAPI(title="Relay Support Dashboard", version="1.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(chat.router)
app.include_router(ai.router)
app.include_router(dashboard.router)
app.include_router(invitations.router)

async def seed_admin():
    from sqlalchemy import select
    from app.models import User
    from app.auth import get_password_hash
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "petegrizk.engineer@gmail.com"))
        existing = result.scalar_one_or_none()
        if existing is None:
            admin = User(
                name="Peter Rizk",
                email="petegrizk.engineer@gmail.com",
                hashed_password=get_password_hash("1234567890"),
                role="manager",
                is_approved=True,
                is_active=True,
            )
            db.add(admin)
        else:
            existing.is_approved = True
            existing.is_active = True
            existing.role = "manager"
        await db.commit()

async def migrate_db():
    from sqlalchemy import text
    async with AsyncSessionLocal() as db:
        try:
            stmts = [
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_data TEXT",
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)",
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_content_type VARCHAR(100)",
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_size INTEGER",
            ]
            for s in stmts:
                await db.execute(text(s))
            await db.commit()
        except Exception:
            await db.rollback()

@app.on_event("startup")
async def startup():
    await create_tables()
    await migrate_db()
    await seed_admin()

@app.get("/")
async def root():
    return {"message": "Relay Support Dashboard API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

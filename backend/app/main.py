from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import create_tables
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

@app.on_event("startup")
async def startup():
    await create_tables()

@app.get("/")
async def root():
    return {"message": "Relay Support Dashboard API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

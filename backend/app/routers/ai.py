import json
import asyncio
from pathlib import Path
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pydantic import BaseModel
from app.database import get_db, AsyncSessionLocal
from app.models import AIConversation, User
from app.schemas import AIMessageCreate, AIMessageOut
from app.auth import get_current_user, require_manager
from app.config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])

SYSTEM_PROMPT = (
    "You are Relay AI, an intelligent customer support assistant. "
    "Help support agents draft responses, analyse tickets, suggest solutions, "
    "and handle escalations professionally and empathetically. "
    "Be concise and practical."
)

# Model catalogue exposed to the frontend
MODELS = [
    {"id": "openai/gpt-oss-120b", "label": "GPT-OSS 120B", "provider": "groq", "badge": "Free ⚡"},
    {"id": "openai/gpt-oss-20b",  "label": "GPT-OSS 20B",  "provider": "groq", "badge": "Free · Fast"},
    {"id": "qwen/qwen3.8-27b",    "label": "Qwen 3 27B",   "provider": "groq", "badge": "Free"},
    {"id": "claude-haiku-5-5",     "label": "Claude Haiku",   "provider": "anthropic", "badge": "Fast"},
    {"id": "claude-sonnet-5-5",    "label": "Claude Sonnet",  "provider": "anthropic", "badge": "Smart"},
    {"id": "gpt-4o-mini",          "label": "GPT-4o mini",    "provider": "openai",    "badge": "Fast"},
    {"id": "gpt-4o",               "label": "GPT-4o",         "provider": "openai",    "badge": "Smart"},
]

def _provider(model_id: str) -> str:
    for m in MODELS:
        if m["id"] == model_id:
            return m["provider"]
    return "groq"

class APIKeyUpdate(BaseModel):
    api_key: str
    provider: str = "anthropic"   # "anthropic" | "openai"

# ── Status & key management ────────────────────────────────────────────────
@router.get("/status")
async def ai_status(current_user: User = Depends(get_current_user)):
    return {
        "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "has_openai_key":    bool(settings.OPENAI_API_KEY),
        "has_groq_key":      bool(settings.GROQ_API_KEY),
        "models": MODELS,
    }

ENV_VAR = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "groq": "GROQ_API_KEY"}

@router.post("/key")
async def save_api_key(
    body: APIKeyUpdate,
    current_user: User = Depends(require_manager),
):
    env_path = Path(__file__).parent.parent.parent / ".env"
    env_var  = ENV_VAR.get(body.provider, "GROQ_API_KEY")
    lines    = env_path.read_text(encoding="utf-8").splitlines()
    found    = False
    for i, line in enumerate(lines):
        if line.startswith(f"{env_var}="):
            lines[i] = f"{env_var}={body.api_key}"
            found = True
            break
    if not found:
        lines.append(f"{env_var}={body.api_key}")
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    if body.provider == "anthropic":
        settings.ANTHROPIC_API_KEY = body.api_key
    elif body.provider == "openai":
        settings.OPENAI_API_KEY = body.api_key
    else:
        settings.GROQ_API_KEY = body.api_key
    return {"ok": True}

# ── Streaming helpers ──────────────────────────────────────────────────────
async def _stream_anthropic(websocket: WebSocket, messages: list, model: str) -> str:
    import anthropic as sdk
    client   = sdk.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    full     = ""
    async with client.messages.stream(
        model=model, max_tokens=1024, system=SYSTEM_PROMPT, messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            full += text
            await websocket.send_json({"text": text})
    return full

async def _stream_groq(websocket: WebSocket, messages: list, model: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
    full   = ""
    msgs   = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    stream = await client.chat.completions.create(
        model=model, messages=msgs, max_tokens=1024, stream=True
    )
    async for chunk in stream:
        text = chunk.choices[0].delta.content or ""
        if text:
            full += text
            await websocket.send_json({"text": text})
    return full

async def _stream_openai(websocket: WebSocket, messages: list, model: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    full   = ""
    msgs   = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    stream = await client.chat.completions.create(
        model=model, messages=msgs, max_tokens=1024, stream=True
    )
    async for chunk in stream:
        text = chunk.choices[0].delta.content or ""
        if text:
            full += text
            await websocket.send_json({"text": text})
    return full

# ── WebSocket AI chat ──────────────────────────────────────────────────────
@router.websocket("/ws")
async def ai_ws(websocket: WebSocket, token: str):
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        await websocket.close(code=4001)
        return

    await websocket.accept()
    try:
        while True:
            raw     = await websocket.receive_text()
            data    = json.loads(raw)
            content = data.get("content", "").strip()
            model   = data.get("model", "claude-haiku-5-5")
            if not content:
                continue

            # Persist user message & fetch history
            async with AsyncSessionLocal() as db:
                db.add(AIConversation(user_id=user_id, role="user", content=content))
                await db.commit()
                result = await db.execute(
                    select(AIConversation)
                    .where(AIConversation.user_id == user_id)
                    .order_by(AIConversation.created_at.asc())
                    .limit(20)
                )
                messages = [{"role": m.role, "content": m.content} for m in result.scalars().all()]

            # Route to provider
            provider = _provider(model)
            key_map  = {"anthropic": settings.ANTHROPIC_API_KEY, "openai": settings.OPENAI_API_KEY, "groq": settings.GROQ_API_KEY}
            has_key  = key_map.get(provider, "")

            full_text = ""
            try:
                if not has_key:
                    full_text = (
                        f"No API key configured for {provider.title()}. "
                        "A manager can add it via the API Keys button at the top of this page."
                    )
                    for word in full_text.split(" "):
                        await websocket.send_json({"text": word + " "})
                        await asyncio.sleep(0.03)
                elif provider == "anthropic":
                    full_text = await _stream_anthropic(websocket, messages, model)
                elif provider == "openai":
                    full_text = await _stream_openai(websocket, messages, model)
                else:
                    full_text = await _stream_groq(websocket, messages, model)
            except Exception as exc:
                full_text = f"Error: {exc}"
                await websocket.send_json({"text": full_text})

            await websocket.send_json({"done": True})

            async with AsyncSessionLocal() as db:
                db.add(AIConversation(user_id=user_id, role="assistant", content=full_text))
                await db.commit()

    except WebSocketDisconnect:
        pass

# ── History ────────────────────────────────────────────────────────────────
@router.get("/history", response_model=List[AIMessageOut])
async def get_ai_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.created_at.asc())
        .limit(100)
    )
    return result.scalars().all()

@router.delete("/history")
async def clear_ai_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(AIConversation).where(AIConversation.user_id == current_user.id))
    for msg in result.scalars().all():
        await db.delete(msg)
    await db.commit()
    return {"message": "History cleared"}

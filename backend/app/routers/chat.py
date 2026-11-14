from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.responses import Response as HTTPResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete as sql_delete
from sqlalchemy.orm import selectinload
from typing import List, Dict
from datetime import datetime, timezone
from app.database import get_db, AsyncSessionLocal
from app.models import ChatRoom, ChatMessage, User, DirectInvitation, RoomLastRead
from app.schemas import ChatRoomOut, ChatMessageOut, ContactOut, UnreadRoomOut, ChatFileUpload
from sqlalchemy import func as sqlfunc
from app.auth import get_current_user
import json

router = APIRouter(prefix="/api/chat", tags=["chat"])

# ── Presence tracking ──────────────────────────────────────────────────────
online_user_ids: set = set()
presence_sockets: Dict[int, List[WebSocket]] = {}

def presence_status(user: User) -> str:
    if user.id in online_user_ids:
        return "online"
    if user.last_seen:
        try:
            ls = user.last_seen
            if ls.tzinfo is None:
                ls = ls.replace(tzinfo=timezone.utc)
            delta = (datetime.now(timezone.utc) - ls).total_seconds()
            if delta < 90:   # heartbeat within 90s → treat as online
                return "online"
            if delta < 600:
                return "away"
        except Exception:
            pass
    return "offline"

async def notify_user(user_id: int, payload: dict):
    for ws in list(presence_sockets.get(user_id, [])):
        try:
            await ws.send_json(payload)
        except Exception:
            pass

# ── Presence WebSocket ─────────────────────────────────────────────────────
@router.websocket("/presence")
async def presence_ws(websocket: WebSocket, token: str):
    from jose import jwt, JWTError
    from app.config import settings
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        await websocket.close(code=4001)
        return

    await websocket.accept()
    online_user_ids.add(user_id)
    presence_sockets.setdefault(user_id, []).append(websocket)

    # Notify other connected users that presence changed
    for uid in list(presence_sockets.keys()):
        if uid != user_id:
            await notify_user(uid, {"type": "presence_changed"})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        online_user_ids.discard(user_id)
        socks = presence_sockets.get(user_id, [])
        if websocket in socks:
            socks.remove(websocket)
        if not socks and user_id in presence_sockets:
            del presence_sockets[user_id]

        # Notify other connected users that presence changed
        for uid in list(presence_sockets.keys()):
            if uid != user_id:
                await notify_user(uid, {"type": "presence_changed"})

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            u = result.scalar_one_or_none()
            if u:
                u.last_seen = datetime.now(timezone.utc)
                await db.commit()

# ── Contact list ───────────────────────────────────────────────────────────
@router.get("/contacts", response_model=List[ContactOut])
async def get_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(DirectInvitation)
        .options(selectinload(DirectInvitation.from_user), selectinload(DirectInvitation.to_user))
        .where(
            or_(DirectInvitation.from_id == current_user.id,
                DirectInvitation.to_id == current_user.id),
            DirectInvitation.status == "accepted",
            DirectInvitation.room_id.isnot(None)
        )
    )
    invitations = result.scalars().all()
    contacts = []
    for inv in invitations:
        other = inv.to_user if inv.from_id == current_user.id else inv.from_user
        if not other or not inv.room_id:
            continue
        contacts.append(ContactOut(
            user=other,
            room_id=inv.room_id,
            invitation_id=inv.id,
            presence=presence_status(other),
        ))
    return contacts

# ── Remove contact ────────────────────────────────────────────────────────
@router.delete("/contacts/{room_id}")
async def remove_contact(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv_result = await db.execute(
        select(DirectInvitation).where(
            or_(DirectInvitation.from_id == current_user.id, DirectInvitation.to_id == current_user.id),
            DirectInvitation.room_id == room_id,
            DirectInvitation.status == "accepted",
        )
    )
    inv = inv_result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Contact not found")
    # delete messages, last-reads, invitation, room
    await db.execute(sql_delete(ChatMessage).where(ChatMessage.room_id == room_id))
    await db.execute(sql_delete(RoomLastRead).where(RoomLastRead.room_id == room_id))
    await db.delete(inv)
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if room:
        await db.delete(room)
    await db.commit()
    return {"message": "Contact removed"}

# ── Unread messages ────────────────────────────────────────────────────────
@router.get("/unread", response_model=List[UnreadRoomOut])
async def get_unread(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(DirectInvitation)
        .options(selectinload(DirectInvitation.from_user), selectinload(DirectInvitation.to_user))
        .where(
            or_(DirectInvitation.from_id == current_user.id, DirectInvitation.to_id == current_user.id),
            DirectInvitation.status == "accepted",
            DirectInvitation.room_id.isnot(None)
        )
    )
    invitations = result.scalars().all()
    unread_rooms = []
    for inv in invitations:
        other = inv.to_user if inv.from_id == current_user.id else inv.from_user
        if not other or not inv.room_id:
            continue
        lr_result = await db.execute(
            select(RoomLastRead).where(
                RoomLastRead.user_id == current_user.id,
                RoomLastRead.room_id == inv.room_id
            )
        )
        lr = lr_result.scalar_one_or_none()
        count_query = (
            select(sqlfunc.count(ChatMessage.id))
            .where(ChatMessage.room_id == inv.room_id, ChatMessage.sender_id != current_user.id)
        )
        if lr:
            count_query = count_query.where(ChatMessage.created_at > lr.last_read_at)
        count = (await db.execute(count_query)).scalar() or 0
        if count > 0:
            last_msg = (await db.execute(
                select(ChatMessage)
                .where(ChatMessage.room_id == inv.room_id)
                .order_by(ChatMessage.created_at.desc())
                .limit(1)
            )).scalar_one_or_none()
            unread_rooms.append(UnreadRoomOut(
                contact=other,
                room_id=inv.room_id,
                unread_count=count,
                last_message=last_msg.content if last_msg else "",
                last_message_at=last_msg.created_at if last_msg else None,
            ))
    return unread_rooms

@router.post("/rooms/{room_id}/mark-read")
async def mark_read(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lr = (await db.execute(
        select(RoomLastRead).where(
            RoomLastRead.user_id == current_user.id,
            RoomLastRead.room_id == room_id
        )
    )).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if lr:
        lr.last_read_at = now
    else:
        db.add(RoomLastRead(user_id=current_user.id, room_id=room_id, last_read_at=now))
    await db.commit()
    return {"ok": True}

# ── Room messages ──────────────────────────────────────────────────────────
@router.get("/rooms", response_model=List[ChatRoomOut])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ChatRoom))
    return result.scalars().all()

@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageOut])
async def get_messages(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatMessage)
        .options(selectinload(ChatMessage.sender))
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(200)
    )
    return result.scalars().all()

# ── Token-based auth helper (for download URLs) ───────────────────────────
async def _resolve_user(request: Request, token: str | None = None, db: AsyncSession = Depends(get_db)) -> User:
    from jose import jwt, JWTError
    from app.config import settings
    raw = token or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not raw:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(raw, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(401, "Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    return user

# ── Send file / voice attachment via HTTP ─────────────────────────────────
@router.post("/rooms/{room_id}/attachments")
async def send_attachment(
    room_id: int,
    data: ChatFileUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        content=data.content or "",
        file_data=data.file_data,
        file_name=data.file_name,
        file_content_type=data.file_content_type,
        file_size=data.file_size,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    broadcast_data = {
        "id": message.id,
        "room_id": room_id,
        "sender_id": current_user.id,
        "sender_name": current_user.name,
        "content": message.content,
        "file_name": data.file_name,
        "file_content_type": data.file_content_type,
        "file_size": data.file_size,
        "created_at": message.created_at.isoformat(),
    }
    await manager.broadcast(broadcast_data, room_id)

    # Notify the other participant via presence socket
    async with AsyncSessionLocal() as notify_db:
        inv_q = await notify_db.execute(
            select(DirectInvitation).where(
                DirectInvitation.room_id == room_id,
                DirectInvitation.status == "accepted",
            )
        )
        inv = inv_q.scalar_one_or_none()
        if inv:
            other_id = inv.to_id if inv.from_id == current_user.id else inv.from_id
            await notify_user(other_id, {
                "type": "new_message",
                "room_id": room_id,
                "from_name": current_user.name,
                "preview": f"[{data.file_name}]",
            })

    return {"id": message.id, "created_at": message.created_at.isoformat()}

# ── Download file attachment ───────────────────────────────────────────────
@router.get("/rooms/{room_id}/messages/{msg_id}/download")
async def download_attachment(
    room_id: int,
    msg_id: int,
    current_user: User = Depends(_resolve_user),
    db: AsyncSession = Depends(get_db),
):
    import base64 as b64
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.id == msg_id, ChatMessage.room_id == room_id)
    )
    msg = result.scalar_one_or_none()
    if not msg or not msg.file_data:
        raise HTTPException(404, "File not found")
    file_bytes = b64.b64decode(msg.file_data)
    return HTTPResponse(
        content=file_bytes,
        media_type=msg.file_content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{msg.file_name}"'},
    )

# ── Chat WebSocket ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: int):
        await websocket.accept()
        self.active_connections.setdefault(room_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: int):
        conns = self.active_connections.get(room_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, message: dict, room_id: int):
        dead = []
        for ws in self.active_connections.get(room_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_connections[room_id].remove(ws)

manager = ConnectionManager()

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str):
    from jose import jwt, JWTError
    from app.config import settings
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            msg_data = json.loads(data)
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if not user:
                    break
                message = ChatMessage(room_id=room_id, sender_id=user_id, content=msg_data["content"])
                db.add(message)
                await db.commit()
                await db.refresh(message)
                broadcast_data = {
                    "id": message.id, "room_id": room_id, "sender_id": user_id,
                    "sender_name": user.name, "content": message.content,
                    "created_at": message.created_at.isoformat(),
                }
            await manager.broadcast(broadcast_data, room_id)
            # Push notification to the other participant's presence socket
            async with AsyncSessionLocal() as notify_db:
                inv_q = await notify_db.execute(
                    select(DirectInvitation).where(
                        DirectInvitation.room_id == room_id,
                        DirectInvitation.status == "accepted"
                    )
                )
                inv = inv_q.scalar_one_or_none()
                if inv:
                    other_id = inv.to_id if inv.from_id == user_id else inv.from_id
                    await notify_user(other_id, {
                        "type": "new_message",
                        "room_id": room_id,
                        "from_name": user.name,
                        "preview": msg_data["content"][:60],
                    })
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception:
        manager.disconnect(websocket, room_id)

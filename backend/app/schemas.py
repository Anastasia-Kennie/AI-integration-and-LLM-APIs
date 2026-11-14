from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models import UserRole, TicketStatus, TicketCategory, Channel

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.agent
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None

class UserOut(UserBase):
    id: int
    role: UserRole
    is_active: bool
    is_approved: bool
    avatar: Optional[str] = None
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    last_seen: Optional[datetime] = None
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None

class InvitationOut(BaseModel):
    id: int
    from_id: int
    to_id: int
    status: str
    room_id: Optional[int] = None
    created_at: datetime
    from_user: Optional[UserOut] = None
    to_user: Optional[UserOut] = None
    class Config:
        from_attributes = True

class InvitationCreate(BaseModel):
    to_email: str

class ContactOut(BaseModel):
    user: UserOut
    room_id: int
    invitation_id: int
    presence: str
    class Config:
        from_attributes = True

class UnreadRoomOut(BaseModel):
    contact: UserOut
    room_id: int
    unread_count: int
    last_message: str
    last_message_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectOut(ProjectBase):
    id: int
    manager_id: int
    is_active: bool
    created_at: datetime
    manager: Optional[UserOut] = None
    class Config:
        from_attributes = True

class ChatRoomBase(BaseModel):
    name: str
    is_private: bool = False

class ChatRoomCreate(ChatRoomBase):
    pass

class ChatRoomOut(ChatRoomBase):
    id: int
    created_by: int
    created_at: datetime
    class Config:
        from_attributes = True

class ChatMessageOut(BaseModel):
    id: int
    room_id: int
    sender_id: int
    content: str
    created_at: datetime
    sender: Optional[UserOut] = None
    class Config:
        from_attributes = True

class TicketOut(BaseModel):
    id: int
    customer_name: str
    subject: str
    channel: Channel
    status: TicketStatus
    category: TicketCategory
    assigned_to: Optional[int]
    created_at: datetime
    class Config:
        from_attributes = True

class AIMessageCreate(BaseModel):
    content: str

class AIMessageOut(BaseModel):
    id: int
    user_id: int
    role: str
    content: str
    created_at: datetime
    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    team_members: int
    messages_today: int
    active_chats: int
    projects: int

class ConversationVolume(BaseModel):
    day: str
    messages: int

class OnlineMember(BaseModel):
    id: int
    name: str
    avatar: str | None
    role: str
    status: str

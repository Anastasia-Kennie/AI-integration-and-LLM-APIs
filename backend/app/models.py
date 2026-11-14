from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    manager = "manager"
    agent = "agent"

class TicketStatus(str, enum.Enum):
    open = "open"
    pending = "pending"
    resolved = "resolved"

class TicketCategory(str, enum.Enum):
    shipping = "Shipping"
    payment = "Payment"
    refund = "Refund"
    order = "Order"
    technical = "Technical"
    login = "Login"

class Channel(str, enum.Enum):
    whatsapp = "WhatsApp"
    website = "Website"
    email = "Email"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.agent)
    avatar = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False)
    phone_number = Column(String(30), nullable=True)
    birthday = Column(String(20), nullable=True)
    address = Column(String(300), nullable=True)
    nationality = Column(String(100), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    messages = relationship("ChatMessage", back_populates="sender", foreign_keys="ChatMessage.sender_id")
    projects = relationship("Project", back_populates="manager", foreign_keys="Project.manager_id")

class RoomLastRead(Base):
    __tablename__ = "room_last_reads"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    last_read_at = Column(DateTime(timezone=True), nullable=False)

class DirectInvitation(Base):
    __tablename__ = "direct_invitations"
    id         = Column(Integer, primary_key=True, index=True)
    from_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    status     = Column(String(20), default="pending")
    room_id    = Column(Integer, ForeignKey("chat_rooms.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    from_user = relationship("User", foreign_keys=[from_id])
    to_user   = relationship("User", foreign_keys=[to_id])

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    manager = relationship("User", back_populates="projects", foreign_keys=[manager_id])
    members = relationship("ProjectMember", back_populates="project")

class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="members")
    user = relationship("User")

class ChatRoom(Base):
    __tablename__ = "chat_rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    is_private = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    messages = relationship("ChatMessage", back_populates="room")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User", back_populates="messages", foreign_keys=[sender_id])

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    subject = Column(String(300), nullable=False)
    channel = Column(Enum(Channel), default=Channel.website)
    status = Column(Enum(TicketStatus), default=TicketStatus.open)
    category = Column(Enum(TicketCategory), default=TicketCategory.order)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AIConversation(Base):
    __tablename__ = "ai_conversations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

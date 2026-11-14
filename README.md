# Relay – Support Team Dashboard

A full-stack customer support dashboard with:
- **Login / Register** (JWT authentication)
- **Manager & Agent roles** – managers can create projects; agents see assigned projects
- **Multi-user real-time chat** (WebSocket)
- **AI chat** powered by Anthropic Claude API
- **Dashboard** with metrics, charts, and ticket tracking

## Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Python 3.11+, FastAPI, SQLAlchemy (async), PostgreSQL |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Auth     | JWT (python-jose + passlib bcrypt) |
| AI       | Anthropic Claude API (anthropic SDK) |
| Realtime | WebSocket (FastAPI native) |

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### 2. Database Setup

```sql
CREATE DATABASE relay_db;
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env — set DATABASE_URL and ANTHROPIC_API_KEY

# Seed the database with demo data
python seed.py

# Start the server
python run.py
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### 4. Frontend Setup

```bash
cd frontend

npm install
npm run dev
# → http://localhost:5173
```

---

## Demo Accounts

After running `seed.py`:

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Manager | manager@relay.com   | manager123  |
| Agent   | agent@relay.com     | agent123    |
| Agent   | agent2@relay.com    | agent123    |

---

## Features

### Dashboard (`/dashboard`)
- 4 KPI cards: open conversations, waiting, resolved today, avg response time
- Line chart: incoming vs resolved (last 7 days)
- AI Activity panel
- Tickets by category with progress bars
- Customer satisfaction donut chart (94%)
- Recent conversations table

### Chat Rooms (`/chat`)
- Create public chat rooms
- Real-time messaging via WebSocket
- Message history loaded on room entry

### AI Chat (`/ai-chat`)
- Powered by Anthropic Claude (`claude-opus-4-5`)
- Full conversation history per user
- Quick prompt suggestions
- Clear history button
- Demo mode works without API key

### Projects (`/projects`)
- **Managers only**: create / delete projects
- Agents: see projects they are assigned to
- Manager can add members via API

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/users/` | List all users |
| POST | `/api/projects/` | Create project (manager) |
| GET | `/api/projects/` | List projects |
| POST | `/api/chat/rooms` | Create chat room |
| GET | `/api/chat/rooms` | List chat rooms |
| GET | `/api/chat/rooms/{id}/messages` | Get messages |
| WS | `/api/chat/ws/{room_id}?token=` | WebSocket chat |
| POST | `/api/ai/chat` | Send message to AI |
| GET | `/api/ai/history` | AI conversation history |
| DELETE | `/api/ai/history` | Clear AI history |
| GET | `/api/dashboard/stats` | Dashboard KPIs |
| GET | `/api/dashboard/conversation-volume` | Chart data |
| GET | `/api/dashboard/tickets-by-category` | Category breakdown |
| GET | `/api/dashboard/satisfaction` | CSAT score |
| GET | `/api/dashboard/recent-tickets` | Recent tickets table |

Full interactive docs: **http://localhost:8000/docs**

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS + router registration
│   │   ├── config.py        # Settings (pydantic-settings)
│   │   ├── database.py      # Async SQLAlchemy engine + session
│   │   ├── models.py        # ORM models
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── auth.py          # JWT helpers + password hashing
│   │   └── routers/
│   │       ├── auth.py      # Register / Login / Me
│   │       ├── users.py     # User list
│   │       ├── projects.py  # Manager CRUD for projects
│   │       ├── chat.py      # Rooms + WebSocket
│   │       ├── ai.py        # Anthropic Claude chat
│   │       └── dashboard.py # Metrics endpoints
│   ├── seed.py              # Populate DB with demo data
│   ├── run.py               # Uvicorn entry point
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx           # Router + PrivateRoute
    │   ├── contexts/
    │   │   └── AuthContext.tsx
    │   ├── services/
    │   │   └── api.ts        # Axios instance
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   └── Sidebar.tsx
    │   └── pages/
    │       ├── Login.tsx
    │       ├── Register.tsx
    │       ├── Dashboard.tsx
    │       ├── Chat.tsx
    │       ├── AIChat.tsx
    │       └── Projects.tsx
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

---

## AI Integration Notes

The AI chat endpoint (`POST /api/ai/chat`) sends the full conversation history to Claude with this system prompt:

> "You are a helpful customer support AI assistant named Relay AI. Help support agents with customer inquiries, suggest responses, and provide analysis."

**Without an API key**, the endpoint returns a demo message so you can test the UI without spending credits. Set `ANTHROPIC_API_KEY` in `.env` to enable real responses.

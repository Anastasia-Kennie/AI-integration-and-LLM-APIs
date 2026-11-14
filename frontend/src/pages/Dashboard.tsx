import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  MessageSquare, Users, FolderOpen, Sparkles,
  ChevronRight, Calendar, UserCheck, UserX, Bell
} from 'lucide-react'
import clsx from 'clsx'
import Avatar from '../components/Avatar'

interface Stats {
  team_members: number
  messages_today: number
  active_chats: number
  projects: number
}

interface VolumeData { day: string; messages: number }

interface OnlineMember {
  id: number
  name: string
  avatar: string | null
  role: string
  status: 'online' | 'away' | 'offline'
}

interface RecentMessage {
  id: number
  sender_name: string
  sender_avatar: string | null
  room_name: string
  content: string
  time: string
}

interface PendingUser {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-500',
  away:   'bg-amber-400',
  offline:'bg-gray-300',
}

function StatCard({ icon: Icon, label, value, iconBg }: {
  icon: React.ElementType; label: string; value: string | number; iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={clsx('p-2.5 rounded-lg', iconBg)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}


export default function Dashboard() {
  const { user } = useAuth()
  const { unreadRooms } = usePresence()
  const navigate = useNavigate()
  const [stats, setStats]       = useState<Stats | null>(null)
  const [volume, setVolume]     = useState<VolumeData[]>([])
  const [members, setMembers]   = useState<OnlineMember[]>([])
  const [activity, setActivity] = useState<RecentMessage[]>([])
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])

  const fetchPending = () => {
    if (user?.role === 'manager') {
      api.get('/api/users/pending').then(r => setPendingUsers(r.data)).catch(() => {})
    }
  }

  async function approveUser(id: number) {
    await api.post(`/api/users/${id}/approve`)
    setPendingUsers(prev => prev.filter(u => u.id !== id))
  }

  async function rejectUser(id: number) {
    await api.delete(`/api/users/${id}/reject`)
    setPendingUsers(prev => prev.filter(u => u.id !== id))
  }

  useEffect(() => {
    fetchPending()
    Promise.all([
      api.get('/api/dashboard/stats'),
      api.get('/api/dashboard/conversation-volume'),
      api.get('/api/dashboard/online-members'),
      api.get('/api/dashboard/recent-activity'),
    ]).then(([s, v, m, a]) => {
      setStats(s.data)
      setVolume(v.data)
      setMembers(m.data)
      setActivity(a.data)
    })
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const onlineCount = members.filter(m => m.status === 'online').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's what's happening with your team today.</p>
        </div>
      </div>

      {/* Pending approvals */}
      {user?.role === 'manager' && pendingUsers.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-100">
            <Bell size={16} className="text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">
              {pendingUsers.length} pending registration{pendingUsers.length > 1 ? 's' : ''} waiting for your approval
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold">
                    {u.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email} · <span className="capitalize">{u.role}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => approveUser(u.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors">
                    <UserCheck size={13} /> Approve
                  </button>
                  <button onClick={() => rejectUser(u.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors">
                    <UserX size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unread messages */}
      {unreadRooms.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-primary-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-primary-50 border-b border-primary-100">
            <MessageSquare size={16} className="text-primary-500" />
            <span className="text-sm font-semibold text-primary-700">
              {unreadRooms.reduce((s, r) => s + r.unread_count, 0)} unread message{unreadRooms.reduce((s, r) => s + r.unread_count, 0) !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {unreadRooms.map(room => (
              <button key={room.room_id}
                onClick={() => navigate('/chat')}
                className="flex items-center justify-between px-5 py-3 w-full text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar avatar={room.contact.avatar} name={room.contact.name} size={9} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{room.contact.name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[300px]">{room.last_message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {room.last_message_at && (
                    <span className="text-[11px] text-gray-400">
                      {new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <span className="min-w-[20px] h-5 flex items-center justify-center text-xs font-bold bg-primary-600 text-white rounded-full px-1.5">
                    {room.unread_count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats && <>
          <StatCard icon={Users}        label="Team members"   value={stats.team_members}   iconBg="bg-indigo-50 text-indigo-500" />
          <StatCard icon={MessageSquare} label="Messages today" value={stats.messages_today} iconBg="bg-amber-50 text-amber-500" />
          <StatCard icon={MessageSquare} label="Chat rooms"     value={stats.active_chats}   iconBg="bg-green-50 text-green-500" />
          <StatCard icon={FolderOpen}   label="Projects"       value={stats.projects}       iconBg="bg-blue-50 text-blue-500" />
        </>}
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Message Volume</h2>
              <p className="text-xs text-gray-400">Team messages sent over the last 7 days.</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">
              <Calendar size={12} /> Last 7 days
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volume} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="messages" fill="#6366f1" radius={[4, 4, 0, 0]} name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Online now */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Team Online</h2>
              <p className="text-xs text-gray-400">{onlineCount} of {members.length} online now</p>
            </div>
            <button className="text-xs text-primary-600 hover:underline flex items-center gap-1" onClick={() => navigate('/users')}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5 max-h-52 overflow-y-auto">
            {members.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No team members yet.</p>
            )}
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <Avatar avatar={m.avatar} name={m.name} size={8} />
                  <span className={clsx('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white', STATUS_COLOR[m.status])} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{m.role}</p>
                </div>
                <span className={clsx('text-[10px] font-medium capitalize', m.status === 'online' ? 'text-green-600' : m.status === 'away' ? 'text-amber-500' : 'text-gray-400')}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent messages */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Recent Messages</h2>
              <p className="text-xs text-gray-400">Latest team messages across all chat rooms</p>
            </div>
            <button className="text-xs text-primary-600 hover:underline flex items-center gap-1" onClick={() => navigate('/chat')}>
              Open chat <ChevronRight size={12} />
            </button>
          </div>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No messages yet.</p>
              <button onClick={() => navigate('/chat')} className="mt-2 text-xs text-primary-600 hover:underline">Start a conversation</button>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map(msg => (
                <div key={msg.id} className="flex items-start gap-3">
                  <Avatar avatar={msg.sender_avatar} name={msg.sender_name} size={8} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-gray-800">{msg.sender_name}</span>
                      <span className="text-[10px] text-gray-400">in {msg.room_name}</span>
                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">{msg.time}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI quick-launch */}
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} />
              <span className="text-sm font-semibold">Ask AI</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              Get instant answers, draft replies, or analyse customer data — all from one AI chat.
            </p>
          </div>
          <button
            onClick={() => navigate('/ai-chat')}
            className="mt-6 w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <Sparkles size={14} /> Open AI Chat
          </button>
        </div>
      </div>
    </div>
  )
}

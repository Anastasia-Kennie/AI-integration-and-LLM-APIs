import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { MessageSquare, Clock, CheckCircle, Timer, TrendingUp, TrendingDown, Sparkles, ChevronRight, Calendar, UserCheck, UserX, Bell } from 'lucide-react'
import clsx from 'clsx'

interface Stats {
  open_conversations: number
  waiting_for_reply: number
  resolved_today: number
  avg_response_time: string
  open_change: number
  waiting_change: number
  resolved_change: number
  response_change: number
}

interface VolumeData { day: string; incoming: number; resolved: number }
interface CategoryData { category: string; count: number; color: string }
interface SatisfactionData { percentage: number; happy: number; neutral: number; unhappy: number }
interface Ticket { id: number; customer_name: string; subject: string; channel: string; status: string; time: string }

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-indigo-50 text-indigo-600',
  resolved: 'bg-green-50 text-green-600',
  pending: 'bg-amber-50 text-amber-600',
}

function StatCard({ icon: Icon, label, value, change, iconBg }: {
  icon: React.ElementType; label: string; value: string | number; change: number; iconBg: string
}) {
  const up = change >= 0
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
      <div className="flex items-center gap-1 mt-3">
        {up
          ? <TrendingUp size={13} className="text-green-500" />
          : <TrendingDown size={13} className="text-red-500" />}
        <span className={clsx('text-xs font-semibold', up ? 'text-green-500' : 'text-red-500')}>
          {up ? '+' : ''}{change}%
        </span>
        <span className="text-xs text-gray-400">vs yesterday</span>
      </div>
    </div>
  )
}

interface PendingUser {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const { unreadRooms } = usePresence()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [volume, setVolume] = useState<VolumeData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [satisfaction, setSatisfaction] = useState<SatisfactionData | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
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
      api.get('/api/dashboard/tickets-by-category'),
      api.get('/api/dashboard/satisfaction'),
      api.get('/api/dashboard/recent-tickets'),
    ]).then(([s, v, c, sat, t]) => {
      setStats(s.data); setVolume(v.data); setCategories(c.data)
      setSatisfaction(sat.data); setTickets(t.data)
    })
  }, [])

  const maxCount = Math.max(...categories.map(c => c.count), 1)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const radius = 44
  const circumference = 2 * Math.PI * radius
  const arc = satisfaction ? (satisfaction.percentage / 100) * circumference : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's what's happening with your support team today.</p>
        </div>
        <div className="relative">
          <input type="text" placeholder="Search customers..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-56" />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Pending approvals — managers only */}
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
                  {room.contact.avatar?.startsWith('http') || room.contact.avatar?.startsWith('data:') ? (
                    <img src={room.contact.avatar} className="w-9 h-9 rounded-full object-cover bg-gray-100 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-bold shrink-0">
                      {room.contact.name[0].toUpperCase()}
                    </div>
                  )}
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
          <StatCard icon={MessageSquare} label="Open conversations" value={stats.open_conversations} change={stats.open_change} iconBg="bg-indigo-50 text-indigo-500" />
          <StatCard icon={Clock} label="Waiting for reply" value={stats.waiting_for_reply} change={stats.waiting_change} iconBg="bg-amber-50 text-amber-500" />
          <StatCard icon={CheckCircle} label="Resolved today" value={stats.resolved_today} change={stats.resolved_change} iconBg="bg-green-50 text-green-500" />
          <StatCard icon={Timer} label="Avg. response time" value={stats.avg_response_time} change={stats.response_change} iconBg="bg-blue-50 text-blue-500" />
        </>}
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Conversation Volume</h2>
              <p className="text-xs text-gray-400">Incoming vs resolved conversations over the last 7 days.</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <Calendar size={12} /> Last 7 days
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="incoming" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Incoming" />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI Activity */}
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span className="text-sm font-semibold">AI Activity</span>
            </div>
            <button className="text-xs text-white/70 hover:text-white flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-sm font-medium">Assigned Bessie Cooper to Theresa Webb</p>
                <p className="text-xs text-white/60 mt-1">2m ago</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className={clsx('h-1.5 rounded-full', i === 0 ? 'w-5 bg-white' : 'w-1.5 bg-white/40')} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent conversations */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Recent Conversations</h2>
              <p className="text-xs text-gray-400">Latest customer conversations</p>
            </div>
            <button className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  {['Customer', 'Subject', 'Channel', 'Status', 'Time'].map(h => (
                    <th key={h} className="text-left pb-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 font-medium text-gray-800">{t.customer_name}</td>
                    <td className="py-2.5 text-gray-500">{t.subject}</td>
                    <td className="py-2.5 text-gray-500">{t.channel}</td>
                    <td className="py-2.5">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-600')}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-400">{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Tickets by category */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Tickets by category</h2>
            <p className="text-xs text-gray-400 mb-4">Distribution of support tickets</p>
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{cat.category}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${(cat.count / maxCount) * 100}%`, backgroundColor: cat.color }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8 text-right">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer satisfaction */}
          {satisfaction && (
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Customer Satisfaction</h2>
              <p className="text-xs text-gray-400 mb-4">How customers rated support this week</p>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#f0f1f9" strokeWidth="10" />
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#22c55e" strokeWidth="10"
                      strokeDasharray={circumference} strokeDashoffset={circumference - arc}
                      strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-900">{satisfaction.percentage}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { emoji: '😊', label: 'Happy', val: satisfaction.happy },
                    { emoji: '😐', label: 'Neutral', val: satisfaction.neutral },
                    { emoji: '😞', label: 'Unhappy', val: satisfaction.unhappy },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="text-base">{r.emoji}</span>
                      <span className="text-xs text-gray-500">{r.label}</span>
                      <span className="text-xs font-bold text-gray-700 ml-auto">{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

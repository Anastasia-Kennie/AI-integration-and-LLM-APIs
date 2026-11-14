import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import api from '../services/api'
import { WS_BASE } from '../lib/urls'
import { Send, UserPlus, Check, X, Mail, Circle } from 'lucide-react'
import clsx from 'clsx'
import Avatar from '../components/Avatar'

interface Contact {
  user: { id: number; name: string; email: string; role: string; avatar?: string }
  room_id: number
  invitation_id: number
  presence: 'online' | 'away' | 'offline'
}

interface Invitation {
  id: number
  from_id: number
  from_user: { id: number; name: string; email: string }
  status: string
  created_at: string
}

interface Message {
  id: number
  room_id: number
  sender_id: number
  sender_name: string
  content: string
  created_at: string
}

const PRESENCE_COLOR = {
  online:  'text-green-500',
  away:    'text-yellow-500',
  offline: 'text-red-400',
}

function PresenceDot({ status }: { status: 'online' | 'away' | 'offline' }) {
  return <Circle size={8} className={clsx('fill-current shrink-0', PRESENCE_COLOR[status])} />
}


export default function Chat() {
  const { user, token } = useAuth()
  const { lastEvent, refreshUnread } = usePresence()
  const [contacts,    setContacts]    = useState<Contact[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [active,      setActive]      = useState<Contact | null>(null)
  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [showInvite,  setShowInvite]  = useState(false)
  const [inviteErr,   setInviteErr]   = useState('')
  const [inviteSent,  setInviteSent]  = useState(false)
  const ws        = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadContacts = useCallback(() => {
    api.get('/api/chat/contacts').then(r => setContacts(r.data)).catch(() => {})
  }, [])

  const loadInvitations = useCallback(() => {
    api.get('/api/invitations/received').then(r => setInvitations(r.data)).catch(() => {})
  }, [])

  // React to presence push events (invitation / accepted from other users)
  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'invitation') loadInvitations()
    if (lastEvent.type === 'accepted')   { loadContacts(); loadInvitations() }
  }, [lastEvent, loadContacts, loadInvitations])

  useEffect(() => { loadContacts(); loadInvitations() }, [loadContacts, loadInvitations])

  // Refresh presence status every 30s
  useEffect(() => {
    const t = setInterval(loadContacts, 30000)
    return () => clearInterval(t)
  }, [loadContacts])

  // Load messages + open room WS + mark as read
  useEffect(() => {
    if (!active) return
    api.get(`/api/chat/rooms/${active.room_id}/messages`).then(r => {
      setMessages(r.data.map((m: any) => ({ ...m, sender_name: m.sender?.name ?? 'Unknown' })))
    })
    api.post(`/api/chat/rooms/${active.room_id}/mark-read`).then(() => refreshUnread()).catch(() => {})
    ws.current?.close()
    ws.current = new WebSocket(`${WS_BASE}/api/chat/ws/${active.room_id}?token=${token}`)
    ws.current.onmessage = (e) => {
      setMessages(prev => [...prev, JSON.parse(e.data)])
      api.post(`/api/chat/rooms/${active.room_id}/mark-read`).then(() => refreshUnread()).catch(() => {})
    }
    return () => ws.current?.close()
  }, [active, token, refreshUnread])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function sendMessage() {
    if (!input.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) return
    ws.current.send(JSON.stringify({ content: input.trim() }))
    setInput('')
  }

  async function sendInvite() {
    setInviteErr('')
    try {
      await api.post('/api/invitations/', { to_email: inviteEmail })
      setInviteSent(true)
      setTimeout(() => { setInviteSent(false); setShowInvite(false); setInviteEmail('') }, 2000)
    } catch (ex: any) {
      setInviteErr(ex.response?.data?.detail || 'Failed to send invitation')
    }
  }

  async function acceptInvite(id: number) {
    await api.post(`/api/invitations/${id}/accept`)
    loadInvitations(); loadContacts()
  }

  async function declineInvite(id: number) {
    await api.post(`/api/invitations/${id}/decline`)
    loadInvitations()
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Messages</h2>
          <button onClick={() => { setShowInvite(v => !v); setInviteErr(''); setInviteSent(false) }}
            title="Invite someone"
            className="p-1 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors">
            <UserPlus size={16} />
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="p-3 border-b border-gray-100 bg-primary-50/40">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Invite by email</p>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="colleague@example.com"
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              autoFocus />
            {inviteErr  && <p className="mt-1 text-xs text-red-500">{inviteErr}</p>}
            {inviteSent && <p className="mt-1 text-xs text-green-600">✓ Invitation sent!</p>}
            <button onClick={sendInvite}
              className="mt-2 w-full py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors">
              Send invitation
            </button>
          </div>
        )}

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="border-b border-gray-100">
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              <Mail size={12} className="text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                Invitations ({invitations.length})
              </span>
            </div>
            {invitations.map(inv => (
              <div key={inv.id} className="px-3 py-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold shrink-0">
                  {inv.from_user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{inv.from_user?.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{inv.from_user?.email}</p>
                </div>
                <button onClick={() => acceptInvite(inv.id)} title="Accept"
                  className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                  <Check size={12} />
                </button>
                <button onClick={() => declineInvite(inv.id)} title="Decline"
                  className="p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-6">
              <UserPlus size={28} className="mx-auto mb-2 opacity-20" />
              No conversations yet.<br />Invite a colleague to start.
            </div>
          ) : contacts.map(c => (
            <button key={c.invitation_id} onClick={() => setActive(c)}
              className={clsx(
                'flex items-center gap-3 w-full px-4 py-3 text-left transition-colors',
                active?.invitation_id === c.invitation_id
                  ? 'bg-primary-50 border-r-2 border-primary-600'
                  : 'hover:bg-gray-50'
              )}>
              <div className="relative">
                <Avatar name={c.user.name} avatar={c.user.avatar} size={9} />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot status={c.presence} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.user.name}</p>
                <p className={clsx('text-[10px] capitalize', PRESENCE_COLOR[c.presence])}>{c.presence}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#f8f9ff] min-w-0">
        {active ? (
          <>
            <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shrink-0">
              <div className="relative">
                <Avatar name={active.user.name} avatar={active.user.avatar} size={9} />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot status={active.presence} />
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">{active.user.name}</h3>
                <p className={clsx('text-xs capitalize', PRESENCE_COLOR[active.presence])}>{active.presence}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={clsx('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                    <Avatar
                      name={isMe ? (user?.name ?? '') : active.user.name}
                      avatar={isMe ? (user as any)?.avatar : active.user.avatar}
                      size={7}
                    />
                    <div className={clsx('max-w-xs lg:max-w-md flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                      <div className="flex items-baseline gap-2">
                        {!isMe && <span className="text-xs font-medium text-gray-600">{msg.sender_name}</span>}
                        <span className="text-[10px] text-gray-400">{fmt(msg.created_at)}</span>
                      </div>
                      <div className={clsx('px-3 py-2 rounded-xl text-sm',
                        isMe
                          ? 'bg-primary-600 text-white rounded-tr-sm'
                          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm')}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="bg-white border-t border-gray-100 p-3 shrink-0">
              <div className="flex items-center gap-2">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={`Message ${active.user.name}…`}
                  className="flex-1 px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button onClick={sendMessage} disabled={!input.trim()}
                  className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <UserPlus size={40} className="opacity-20" />
            <p className="text-sm">Select a conversation or invite someone</p>
          </div>
        )}
      </div>
    </div>
  )
}

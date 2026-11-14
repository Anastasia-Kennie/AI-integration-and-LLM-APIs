import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import api from '../services/api'
import { WS_BASE } from '../lib/urls'
import {
  Send, UserPlus, Check, X, Mail, Circle, Trash2,
  Paperclip, Mic, StopCircle, Download, FileText,
} from 'lucide-react'
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
  file_name?: string | null
  file_content_type?: string | null
  file_size?: number | null
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1_048_576).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
  })
}

export default function Chat() {
  const { user, token } = useAuth()
  const { lastEvent, refreshUnread, unreadRooms } = usePresence()
  const [contacts,       setContacts]       = useState<Contact[]>([])
  const [invitations,    setInvitations]    = useState<Invitation[]>([])
  const [active,         setActive]         = useState<Contact | null>(null)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [input,          setInput]          = useState('')
  const [inviteEmail,    setInviteEmail]    = useState('')
  const [showInvite,     setShowInvite]     = useState(false)
  const [inviteErr,      setInviteErr]      = useState('')
  const [inviteSent,     setInviteSent]     = useState(false)
  const [remaining,      setRemaining]      = useState<number | null>(null)
  const [hoverContact,   setHoverContact]   = useState<number | null>(null)
  const [deleteConfirm,  setDeleteConfirm]  = useState<Contact | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [recording,      setRecording]      = useState(false)
  const [recTime,        setRecTime]        = useState(0)

  const ws              = useRef<WebSocket | null>(null)
  const bottomRef       = useRef<HTMLDivElement>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const mediaRecRef     = useRef<MediaRecorder | null>(null)
  const audioChunksRef  = useRef<Blob[]>([])
  const recTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  // cleanup recorder/timer on unmount
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current)
      mediaRecRef.current?.stop()
    }
  }, [])

  const loadContacts = useCallback(() => {
    api.get('/api/chat/contacts').then(r => setContacts(r.data)).catch(() => {})
  }, [])

  const loadInvitations = useCallback(() => {
    api.get('/api/invitations/received').then(r => setInvitations(r.data)).catch(() => {})
  }, [])

  const loadRemaining = useCallback(() => {
    api.get('/api/invitations/remaining').then(r => setRemaining(r.data.remaining)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'invitation') loadInvitations()
    if (lastEvent.type === 'accepted')   { loadContacts(); loadInvitations() }
  }, [lastEvent, loadContacts, loadInvitations])

  useEffect(() => {
    loadContacts(); loadInvitations(); loadRemaining()
  }, [loadContacts, loadInvitations, loadRemaining])

  useEffect(() => {
    const t = setInterval(loadContacts, 30000)
    return () => clearInterval(t)
  }, [loadContacts])

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

  async function sendFile(file: File) {
    if (!active) return
    setUploading(true)
    try {
      const base64 = await fileToBase64(file)
      await api.post(`/api/chat/rooms/${active.room_id}/attachments`, {
        file_data: base64,
        file_name: file.name,
        file_content_type: file.type || 'application/octet-stream',
        file_size: file.size,
        content: '',
      })
      // UI update comes via WebSocket broadcast
    } catch {
      // If WS is down, reload messages as fallback
      api.get(`/api/chat/rooms/${active.room_id}/messages`).then(r => {
        setMessages(r.data.map((m: any) => ({ ...m, sender_name: m.sender?.name ?? 'Unknown' })))
      }).catch(() => {})
    } finally {
      setUploading(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const mimeType = mr.mimeType || 'audio/webm'
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType })
        await sendFile(file)
      }
      mr.start()
      setRecording(true)
      setRecTime(0)
      recTimerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
    } catch {
      alert('Microphone access denied. Please allow microphone access and try again.')
    }
  }

  function stopRecording() {
    mediaRecRef.current?.stop()
    setRecording(false)
    setRecTime(0)
    if (recTimerRef.current) clearInterval(recTimerRef.current)
  }

  function getFileUrl(msg: Message): string {
    const base = import.meta.env.VITE_API_URL ?? ''
    const t = localStorage.getItem('token') ?? ''
    return `${base}/api/chat/rooms/${msg.room_id}/messages/${msg.id}/download?token=${encodeURIComponent(t)}`
  }

  function downloadFile(msg: Message) {
    const a = document.createElement('a')
    a.href = getFileUrl(msg)
    a.download = msg.file_name!
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  function renderMsgContent(msg: Message, isMe: boolean) {
    if (msg.file_name) {
      const isAudio = msg.file_content_type?.startsWith('audio/')
      const fileUrl = getFileUrl(msg)

      if (isAudio) {
        return (
          <div className="min-w-[220px]">
            <div className="flex items-center gap-1.5 mb-2">
              <Mic size={13} className={isMe ? 'text-white/70' : 'text-gray-400'} />
              <span className={clsx('text-[11px]', isMe ? 'text-white/70' : 'text-gray-400')}>
                Voice · {msg.file_size ? formatBytes(msg.file_size) : ''}
              </span>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={fileUrl} className="w-full max-w-[260px] h-9" />
          </div>
        )
      }

      return (
        <div className="flex items-center gap-2 min-w-[180px] max-w-[260px]">
          <FileText size={22} className={isMe ? 'text-white/80' : 'text-gray-400'} />
          <div className="flex-1 min-w-0">
            <p className={clsx('text-xs font-medium truncate', isMe ? 'text-white' : 'text-gray-800')}>
              {msg.file_name}
            </p>
            {msg.file_size != null && (
              <p className={clsx('text-[10px]', isMe ? 'text-white/60' : 'text-gray-400')}>
                {formatBytes(msg.file_size)}
              </p>
            )}
          </div>
          <button onClick={() => downloadFile(msg)} title="Download"
            className={clsx('p-1.5 rounded-lg transition-colors shrink-0',
              isMe ? 'text-white/80 hover:bg-white/20' : 'text-gray-500 hover:bg-gray-100')}>
            <Download size={14} />
          </button>
        </div>
      )
    }
    return <span>{msg.content}</span>
  }

  async function sendInvite() {
    setInviteErr('')
    try {
      await api.post('/api/invitations/', { to_email: inviteEmail })
      setInviteSent(true)
      loadRemaining()
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

  async function removeContact(c: Contact) {
    await api.delete(`/api/chat/contacts/${c.room_id}`)
    setContacts(prev => prev.filter(x => x.room_id !== c.room_id))
    if (active?.room_id === c.room_id) { setActive(null); setMessages([]) }
    setDeleteConfirm(null)
  }

  const unreadByRoom = Object.fromEntries(unreadRooms.map(r => [r.room_id, r.unread_count]))
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const recFmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-600">Invite by email</p>
              {remaining !== null && (
                <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                  remaining === 0 ? 'bg-red-100 text-red-600' :
                  remaining <= 3  ? 'bg-amber-100 text-amber-700' :
                                    'bg-green-100 text-green-700')}>
                  {remaining}/10 left today
                </span>
              )}
            </div>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && remaining !== 0 && sendInvite()}
              placeholder="colleague@example.com"
              disabled={remaining === 0}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white disabled:opacity-50"
              autoFocus />
            {inviteErr  && <p className="mt-1 text-xs text-red-500">{inviteErr}</p>}
            {inviteSent && <p className="mt-1 text-xs text-green-600">✓ Invitation sent!</p>}
            {remaining === 0
              ? <p className="mt-2 text-xs text-red-500 text-center">No invitations left today.</p>
              : (
                <button onClick={sendInvite} disabled={!inviteEmail.trim()}
                  className="mt-2 w-full py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  Send invitation
                </button>
              )
            }
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
          ) : contacts.map(c => {
            const unread = unreadByRoom[c.room_id] ?? 0
            return (
              <div key={c.invitation_id}
                className="relative group"
                onMouseEnter={() => setHoverContact(c.invitation_id)}
                onMouseLeave={() => setHoverContact(null)}>
                <button onClick={() => setActive(c)}
                  className={clsx(
                    'flex items-center gap-3 w-full px-4 py-3 text-left transition-colors pr-10',
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
                  {unread > 0 && active?.room_id !== c.room_id && (
                    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-primary-600 text-white rounded-full px-1">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
                {hoverContact === c.invitation_id && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(c) }}
                    title="Remove contact"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#f8f9ff] min-w-0">
        {active ? (
          <>
            {/* Header */}
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

            {/* Messages */}
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
                        {renderMsgContent(msg, isMe)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="bg-white border-t border-gray-100 p-3 shrink-0">
              {/* Hidden file input */}
              <input type="file" ref={fileInputRef} className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) sendFile(f)
                  e.target.value = ''
                }} />

              {recording ? (
                /* Recording state */
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm text-red-600 font-medium">Recording {recFmt(recTime)}</span>
                  </div>
                  <button onClick={stopRecording} title="Stop and send"
                    className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                    <StopCircle size={16} />
                  </button>
                </div>
              ) : (
                /* Normal state */
                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    title="Attach file"
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-40">
                    <Paperclip size={16} />
                  </button>
                  <button onClick={startRecording} disabled={uploading}
                    title="Record voice message"
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-40">
                    <Mic size={16} />
                  </button>
                  <input type="text" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={uploading ? 'Uploading…' : `Message ${active.user.name}…`}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" />
                  <button onClick={sendMessage} disabled={!input.trim() || uploading}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <UserPlus size={40} className="opacity-20" />
            <p className="text-sm">Select a conversation or invite someone</p>
          </div>
        )}
      </div>

      {/* Delete contact confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-80">
            <h3 className="font-semibold text-gray-900 mb-1">Remove {deleteConfirm.user.name}?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This deletes your chat history. To chat again, one of you must send a new invitation.
            </p>
            <div className="flex gap-2">
              <button onClick={() => removeContact(deleteConfirm)}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                Remove
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

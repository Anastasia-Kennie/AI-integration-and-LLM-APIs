import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import api from '../services/api'
import { WS_BASE } from '../lib/urls'

interface UnreadRoom {
  contact: { id: number; name: string; avatar?: string }
  room_id: number
  unread_count: number
  last_message: string
  last_message_at: string | null
}

export interface PresenceEvent {
  type: string
  [key: string]: any
}

interface PresenceContextValue {
  unreadCount: number
  unreadRooms: UnreadRoom[]
  lastEvent: PresenceEvent | null
  refreshUnread: () => void
}

const PresenceContext = createContext<PresenceContextValue>({
  unreadCount: 0,
  unreadRooms: [],
  lastEvent: null,
  refreshUnread: () => {},
})

export function usePresence() {
  return useContext(PresenceContext)
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth()
  const [unreadRooms, setUnreadRooms] = useState<UnreadRoom[]>([])
  const [lastEvent, setLastEvent] = useState<PresenceEvent | null>(null)
  const wsRef  = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const unreadCount = unreadRooms.reduce((s, r) => s + r.unread_count, 0)

  const refreshUnread = useCallback(() => {
    if (!user) return
    api.get('/api/chat/unread').then(r => setUnreadRooms(r.data)).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!token || !user) return
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const ws = new WebSocket(`${WS_BASE}/api/chat/presence?token=${token}`)
      wsRef.current = ws
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setLastEvent(data)
          if (data.type === 'new_message') refreshUnread()
        } catch {}
      }
      ws.onclose = () => { if (!cancelled) setTimeout(connect, 3000) }
      if (pingRef.current) clearInterval(pingRef.current)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 30000)
    }

    connect()
    refreshUnread()

    return () => {
      cancelled = true
      wsRef.current?.close()
      if (pingRef.current) clearInterval(pingRef.current)
    }
  }, [token, user, refreshUnread])

  return (
    <PresenceContext.Provider value={{ unreadCount, unreadRooms, lastEvent, refreshUnread }}>
      {children}
    </PresenceContext.Provider>
  )
}

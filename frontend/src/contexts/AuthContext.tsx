import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

interface User {
  id: number
  name: string
  email: string
  role: 'manager' | 'agent'
  is_active: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role: string, extra?: Record<string, unknown>) => Promise<void>
  logout: () => void
  isLoading: boolean
  setUser: React.Dispatch<React.SetStateAction<User | null>>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (stored) {
      api.defaults.headers.common['Authorization'] = `Bearer ${stored}`
      api.get('/api/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { localStorage.removeItem('token'); setToken(null) })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('token', access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setToken(access_token)
    setUser(userData)
  }

  const register = async (name: string, email: string, password: string, role: string, extra?: Record<string, unknown>) => {
    await api.post('/api/auth/register', { name, email, password, role, ...extra })
  }

  const logout = () => {
    // Tell the backend to mark us offline before clearing state
    api.post('/api/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

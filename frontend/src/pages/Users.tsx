import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Users as UsersIcon, Search, ShieldCheck, UserCircle, Phone, MapPin, Globe, Cake, Mail, Calendar, ChevronDown, ChevronUp, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import AvatarComp from '../components/Avatar'

interface UserRecord {
  id: number
  name: string
  email: string
  role: 'manager' | 'agent'
  avatar?: string | null
  is_active: boolean
  is_approved: boolean
  phone_number: string | null
  birthday: string | null
  address: string | null
  nationality: string | null
  created_at: string
}

type SortKey = 'name' | 'email' | 'role' | 'created_at'

const ROLE_STYLE: Record<string, string> = {
  manager: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  agent:   'bg-gray-50 text-gray-600 border border-gray-200',
}


function Detail({ icon: Icon, value }: { icon: React.ElementType; value: string | null }) {
  if (!value) return null
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <Icon size={11} className="text-gray-400 shrink-0" />{value}
    </span>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const [users,       setUsers]       = useState<UserRecord[]>([])
  const [search,      setSearch]      = useState('')
  const [sort,        setSort]        = useState<SortKey>('created_at')
  const [asc,         setAsc]         = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [confirmId,   setConfirmId]   = useState<number | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  const confirmTarget = users.find(u => u.id === confirmId)

  useEffect(() => {
    api.get('/api/users/')
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users
    .filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.nationality ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const va = a[sort] ?? '', vb = b[sort] ?? ''
      return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })

  async function deleteUser() {
    if (!confirmId) return
    setDeleting(true)
    try {
      await api.delete(`/api/users/${confirmId}`)
      setUsers(prev => prev.filter(u => u.id !== confirmId))
      setConfirmId(null)
    } catch (ex: any) {
      alert(ex.response?.data?.detail || 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setAsc(v => !v)
    else { setSort(key); setAsc(true) }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort !== col) return <ChevronDown size={12} className="text-gray-300" />
    return asc ? <ChevronUp size={12} className="text-primary-500" /> : <ChevronDown size={12} className="text-primary-500" />
  }

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
        <ShieldCheck size={40} />
        <p className="text-sm">Manager access required.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Database</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, email, nationality…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-72"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total members', value: users.length,                              icon: UsersIcon,    bg: 'bg-indigo-50', ic: 'text-indigo-500' },
          { label: 'Managers',      value: users.filter(u => u.role === 'manager').length, icon: ShieldCheck,  bg: 'bg-violet-50', ic: 'text-violet-500' },
          { label: 'Agents',        value: users.filter(u => u.role === 'agent').length,   icon: UserCircle,   bg: 'bg-sky-50',    ic: 'text-sky-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
            <div className={clsx('p-2.5 rounded-lg', s.bg)}>
              <s.icon size={18} className={s.ic} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {([
                  { key: 'name',       label: 'Member' },
                  { key: 'email',      label: 'Email' },
                  { key: 'role',       label: 'Role' },
                  { key: null,         label: 'Contact & Details' },
                  { key: 'created_at', label: 'Joined' },
                  { key: null,         label: '' },
                ] as { key: SortKey | null; label: string }[]).map(col => (
                  <th key={col.label}
                    className={clsx('text-left px-5 py-3 text-xs font-semibold text-gray-500', col.key && 'cursor-pointer hover:text-gray-800 select-none')}
                    onClick={() => col.key && toggleSort(col.key)}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-16 text-sm text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-sm text-gray-400">No results.</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                  {/* member */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AvatarComp name={u.name} avatar={u.avatar} size={9} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">ID #{u.id}</p>
                      </div>
                    </div>
                  </td>
                  {/* email */}
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Mail size={13} className="text-gray-400 shrink-0" />{u.email}
                    </span>
                  </td>
                  {/* role */}
                  <td className="px-5 py-4">
                    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', ROLE_STYLE[u.role])}>
                      {u.role}
                    </span>
                  </td>
                  {/* details */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <Detail icon={Phone}  value={u.phone_number} />
                      <Detail icon={Cake}   value={u.birthday} />
                      <Detail icon={Globe}  value={u.nationality} />
                      <Detail icon={MapPin} value={u.address} />
                      {!u.phone_number && !u.birthday && !u.nationality && !u.address && (
                        <span className="text-xs text-gray-300 italic">No details</span>
                      )}
                    </div>
                  </td>
                  {/* joined */}
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar size={12} className="text-gray-400" />
                      {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </td>
                  {/* actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {u.avatar && u.id !== me?.id && (
                        <button
                          onClick={async () => {
                            await api.delete(`/api/users/${u.id}/avatar`)
                            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, avatar: null } : x))
                          }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                          title="Reset avatar to default">
                          <RefreshCw size={14} />
                        </button>
                      )}
                      {u.id !== me?.id && (
                        <button
                          onClick={() => setConfirmId(u.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete user">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmId && confirmTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Delete user?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              <span className="font-medium text-gray-700">{confirmTarget.name}</span> ({confirmTarget.email}) will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={deleteUser}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

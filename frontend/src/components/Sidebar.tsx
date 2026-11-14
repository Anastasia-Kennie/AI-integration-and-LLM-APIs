import { NavLink, useNavigate } from 'react-router-dom'
import { useState, FormEvent, useEffect, useRef } from 'react'
import { usePresence } from '../contexts/PresenceContext'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import api from '../services/api'
import {
  LayoutDashboard, BarChart2, Zap, Plug, MessageSquare, Mail, MessageCircle,
  Settings, HelpCircle, ChevronDown, Sparkles, FolderOpen, LogOut, Inbox,
  UserCog, X, Save, Eye, EyeOff, User, Lock,
  MapPin, Globe, Cake, Users as UsersIcon, Phone
} from 'lucide-react'
import { PhoneInput } from './PhoneInput'
import { BirthdayPicker } from './BirthdayPicker'
import clsx from 'clsx'

const navMain = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/chat',      icon: Inbox,           label: 'Chat Rooms' },
  { to: '/ai-chat',   icon: Sparkles,        label: 'Ask AI' },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects' },
  { to: '/users',     icon: UsersIcon,       label: 'Users', managerOnly: true },
]
const navWorkspace = [
  { to: '#', icon: BarChart2, label: 'Analytics' },
  { to: '#', icon: Zap,       label: 'Automations' },
  { to: '#', icon: Plug,      label: 'Integrations' },
]
const navChannels = [
  { to: '#', icon: MessageSquare, label: 'Website Chat' },
  { to: '#', icon: Mail,          label: 'Email' },
  { to: '#', icon: MessageCircle, label: 'WhatsApp' },
]

function NavItem({ to, icon: Icon, label, badge }: { to: string; icon: React.ElementType; label: string; badge?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      clsx('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700')}>
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        <Icon size={13} className="text-gray-400" />{label}
      </label>
      {children}
    </div>
  )
}


/* ── Fun illustrated avatars with accessories (DiceBear adventurer + open-peeps) ── */
const MEN_SEEDS = [
  'soccer-mike','boxer-alex','baseball-tom','golfer-chris','tennis-leo','rugby-ben','swimmer-dan',
  'cyclist-ryan','runner-jake','climber-noah','surfer-eli','skater-max','archer-sam','knight-will',
  'wizard-fred','pirate-jack','ninja-karl','cowboy-dean','astronaut-ray','chef-paul',
  'doctor-evan','pilot-scott','detective-cole','firefighter-seth','soldier-kyle',
  'gamer-tyler','DJ-omar','artist-lucas','writer-adam','musician-eric',
  'basketball-james','hockey-peter','volleyball-simon','cricket-rahul','handball-boris',
  'fencer-hugo','wrestler-omar','judo-kenji','karate-tao','boxing-troy',
  'sailing-finn','fishing-ned','hiking-oscar','skiing-lars','snowboard-vince',
  'motocross-rex','F1-nico','marathon-kofi','triathlon-yusuf','ironman-ethan',
]
const WOMEN_SEEDS = [
  'gymnast-sofia','tennis-mia','ballet-emma','yoga-luna','swimmer-zoe',
  'runner-aria','cyclist-ivy','surfer-nova','skater-ruby','archer-jade',
  'chef-lily','doctor-chloe','pilot-nora','artist-nina','musician-ella',
  'soccer-grace','basketball-faith','volleyball-hope','hockey-rose','rugby-dawn',
  'fencer-ines','judoka-yuki','karate-suki','boxer-roxy','climber-eva',
  'hiker-sierra','skier-aspen','snowboard-winter','sailing-marina','fishing-pearl',
  'detective-vera','knight-diana','wizard-aurora','pirate-morgan','ninja-kira',
  'astronaut-lyra','firefighter-tess','soldier-lexi','gamer-pixel','DJ-hana',
  'marathon-aisha','triathlon-priya','crossfit-brooke','volleyball-camille','cricket-ananya',
  'lacrosse-claire','handball-katrin','cycling-britta','rowing-astrid','archery-freya',
]

const bgMen   = 'b6e3f4,c0aede,d1d4f9,e0f2fe,dbeafe'
const bgWomen = 'ffd5dc,ffdfbf,fce7f3,f5d0fe,ede9fe'

const MEN_AVATARS   = MEN_SEEDS.map(s =>
  `https://api.dicebear.com/8.x/adventurer/svg?seed=${s}&backgroundColor=${bgMen}&backgroundType=gradientLinear`)
const WOMEN_AVATARS = WOMEN_SEEDS.map(s =>
  `https://api.dicebear.com/8.x/adventurer/svg?seed=${s}&backgroundColor=${bgWomen}&backgroundType=gradientLinear`)

function AvatarDisplay({ avatar, name, size = 14 }: { avatar?: string | null; name?: string; size?: number }) {
  if (avatar?.startsWith('http') || avatar?.startsWith('data:')) return (
    <img src={avatar} className={`w-${size} h-${size} rounded-full object-cover bg-gray-100 shrink-0`} />
  )
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-500 flex items-center justify-center text-white font-bold shrink-0 text-xl`}>
      {name?.[0]?.toUpperCase() ?? 'U'}
    </div>
  )
}

/* ── Main drawer ── */
function ProfileDrawer({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuth()
  const { show: showToast, node: toastNode } = useToast()
  const [tab,  setTab]  = useState<'info' | 'password'>('info')
  const [open, setOpen] = useState(false)

  const [name,        setName]        = useState(user?.name        ?? '')
  const [avatar,      setAvatar]      = useState((user as any)?.avatar        ?? '')
  const [phone,       setPhone]       = useState((user as any)?.phone_number  ?? '')
  const [birthday,    setBirthday]    = useState((user as any)?.birthday      ?? '')
  const [address,     setAddress]     = useState((user as any)?.address       ?? '')
  const [nationality, setNationality] = useState((user as any)?.nationality   ?? '')

  const [avatarTab, setAvatarTab] = useState<'men' | 'women'>('men')
  const [cur,     setCur]     = useState('')
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw,  setShowPw]  = useState(false)
  const [err,     setErr]     = useState('')
  const [busy,    setBusy]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { requestAnimationFrame(() => setOpen(true)) }, [])

  function close() {
    setOpen(false)
    setTimeout(onClose, 300)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setAvatar(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function saveInfo(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const res = await api.patch('/api/users/me', { name, avatar, phone_number: phone, birthday, address, nationality })
      setUser(res.data)
      showToast('Profile saved successfully.')
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || 'Failed to save.')
    } finally { setBusy(false) }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (next !== confirm) { setErr('Passwords do not match.'); return }
    if (next.length < 8)  { setErr('Min 8 characters.'); return }
    setBusy(true)
    try {
      await api.patch('/api/users/me', { current_password: cur, new_password: next })
      setCur(''); setNext(''); setConfirm('')
      showToast('Password updated successfully.')
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || 'Failed to update.')
    } finally { setBusy(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return createPortal(
    <>
      {toastNode}

      {/* backdrop */}
      <div
        className={clsx('fixed inset-0 bg-black/25 z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        onClick={close}
      />

      {/* drawer */}
      <div className={clsx(
        'fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit Profile</h2>
            <p className="text-xs text-gray-400 mt-0.5">Update your personal information</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* avatar hero row */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-50">
          <AvatarDisplay avatar={avatar} name={user?.name} size={14} />
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{user?.role} · {user?.email}</p>
          </div>
        </div>

        {/* tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {([
            { id: 'info',     icon: User, label: 'Profile Info' },
            { id: 'password', icon: Lock, label: 'Password' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setErr('') }}
              className={clsx('flex items-center gap-1.5 py-3 mr-6 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600')}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'info' ? (
            <form onSubmit={saveInfo} className="space-y-4">
              {/* Avatar picker */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  <User size={13} className="text-gray-400" />Avatar
                </label>

                {/* sex tabs */}
                <div className="flex gap-1 mb-2 p-1 bg-gray-100 rounded-lg">
                  {(['men', 'women'] as const).map(sex => (
                    <button key={sex} type="button"
                      onClick={() => setAvatarTab(sex)}
                      className={clsx('flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
                        avatarTab === sex ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      {sex === 'men' ? '👨 Men' : '👩 Women'}
                    </button>
                  ))}
                </div>

                {/* grid */}
                <div className="h-52 overflow-y-auto rounded-lg border border-gray-100">
                  <div className="grid grid-cols-5 gap-1.5 p-2">
                    {(avatarTab === 'men' ? MEN_AVATARS : WOMEN_AVATARS).map(url => (
                      <button key={url} type="button" onClick={() => setAvatar(url)}
                        className={clsx(
                          'w-full aspect-square rounded-full overflow-hidden transition-all',
                          avatar === url ? 'ring-2 ring-offset-1 ring-primary-500 scale-105' : 'opacity-80 hover:opacity-100 hover:scale-105'
                        )}>
                        <img src={url} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* upload */}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full mt-2 py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:text-primary-600 transition-colors">
                  {avatar?.startsWith('data:') ? '✓ Custom image uploaded — click to change' : '↑ Upload your own photo'}
                </button>
              </div>

              <Field label="Full name" icon={User}>
                <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} placeholder="Your name" />
              </Field>

              <Field label="Phone number" icon={Phone}>
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>

              <Field label="Birthday" icon={Cake}>
                <BirthdayPicker value={birthday} onChange={setBirthday} />
              </Field>

              <Field label="Nationality" icon={Globe}>
                <input value={nationality} onChange={e => setNationality(e.target.value)} className={inputCls} placeholder="e.g. American" />
              </Field>

              <Field label="Address" icon={MapPin}>
                <textarea value={address} onChange={e => setAddress(e.target.value)}
                  rows={2} className={inputCls + ' resize-none'} placeholder="Your address" />
              </Field>

              {err && <p className="text-sm text-red-500">{err}</p>}
              <button type="submit" disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                <Save size={15} />{busy ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : (
            <form onSubmit={savePassword} className="space-y-4">
              <Field label="Current password" icon={Lock}>
                <input type="password" value={cur} onChange={e => setCur(e.target.value)} required className={inputCls} />
              </Field>
              <Field label="New password" icon={Lock}>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={next}
                    onChange={e => setNext(e.target.value)} required minLength={8}
                    className={inputCls + ' pr-10'} placeholder="Min. 8 characters" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm new password" icon={Lock}>
                <input type={showPw ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)} required
                  className={clsx(inputCls,
                    confirm && confirm !== next ? 'border-red-300 bg-red-50' :
                    confirm && confirm === next  ? 'border-green-300 bg-green-50' : '')} />
                {confirm && confirm !== next && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </Field>

              {err && <p className="text-sm text-red-500">{err}</p>}
              <button type="submit" disabled={busy || (!!confirm && confirm !== next)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                <Save size={15} />{busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { unreadCount } = usePresence()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const visibleMain = navMain.filter(i => !('managerOnly' in i) || !i.managerOnly || user?.role === 'manager')

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-4 shrink-0">
      <div className="px-4 mb-4 flex items-center gap-2">
        <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="font-bold text-gray-900">Relay</span>
      </div>

      <div className="px-4 mb-4">
        <button className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-gray-500 bg-gray-50 rounded-md hover:bg-gray-100">
          <span className="font-medium">Acme Shoes</span>
          <ChevronDown size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-4">
        <div>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Main</p>
          {visibleMain.map(item => (
            <NavItem key={item.to} {...item} badge={item.to === '/chat' ? unreadCount : undefined} />
          ))}
        </div>
        <div>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Workspace</p>
          {navWorkspace.map(item => <NavItem key={item.label} {...item} />)}
        </div>
        <div>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Channels</p>
          {navChannels.map(item => <NavItem key={item.label} {...item} />)}
        </div>
      </div>

      <div className="px-2 mt-2 space-y-1">
        <NavItem to="#" icon={Settings} label="Settings" />
        <button onClick={() => setShowProfile(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <UserCog size={18} />Edit Profile
        </button>
        <NavItem to="#" icon={HelpCircle} label="Help & Support" />
        <div className="border-t border-gray-100 pt-2 mt-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <AvatarDisplay avatar={(user as any)?.avatar} name={user?.name} size={7} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} className="text-gray-400 hover:text-red-500">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {showProfile && <ProfileDrawer onClose={() => setShowProfile(false)} />}
    </aside>
  )
}

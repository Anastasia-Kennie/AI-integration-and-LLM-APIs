import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Sparkles, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { PhoneInput } from '../components/PhoneInput'
import { BirthdayPicker } from '../components/BirthdayPicker'

type Form = {
  name: string; email: string; password: string; confirm: string; role: string
  phone: string; birthday: string; address: string; nationality: string
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>({
    name: '', email: '', password: '', confirm: '', role: 'agent',
    phone: '', birthday: '', address: '', nationality: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await register(form.name, form.email, form.password, form.role, {
        phone_number: form.phone || undefined,
        birthday: form.birthday || undefined,
        address: form.address || undefined,
        nationality: form.nationality || undefined,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f1f9]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Registration submitted!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your account is <strong>pending approval</strong> by the admin.<br />
              You will be able to log in once your account is approved.
            </p>
            <button onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f1f9] py-8">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Create account</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Join your Relay workspace</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Required */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Account</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={set('name')} required
                  autoComplete="new-name" className={inputCls} placeholder="John Doe" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-400">*</span></label>
                <input type="email" value={form.email} onChange={set('email')} required
                  autoComplete="new-email" className={inputCls} placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={set('password')} required minLength={8}
                    autoComplete="new-password" className={inputCls + ' pr-10'} placeholder="Min. 8 chars" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password <span className="text-red-400">*</span></label>
                <input type={showPass ? 'text' : 'password'} value={form.confirm}
                  onChange={set('confirm')} required autoComplete="new-password"
                  className={`${inputCls} ${
                    form.confirm && form.confirm !== form.password ? 'border-red-300 bg-red-50' :
                    form.confirm && form.confirm === form.password ? 'border-green-300 bg-green-50' : ''
                  }`} placeholder="Re-enter" />
                {form.confirm && form.confirm !== form.password && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={set('role')}
                  className={inputCls + ' bg-white'}>
                  <option value="agent">Support Agent</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>

            {/* Optional */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest pt-1">Personal info <span className="font-normal normal-case">(optional)</span></p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
                <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                <BirthdayPicker value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                  <input type="text" value={form.nationality} onChange={set('nationality')}
                    className={inputCls} placeholder="e.g. American" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={set('address')}
                    className={inputCls} placeholder="City, Country" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading || (!!form.confirm && form.confirm !== form.password)}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-60">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 text-center">
            New accounts require admin approval before you can log in.
          </div>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

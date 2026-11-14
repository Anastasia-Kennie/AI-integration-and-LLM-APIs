import { useState } from 'react'
import { Phone } from 'lucide-react'

export function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const match = value.match(/^\+?(\d{1,3})\s*(.*)$/)
  const initCc  = match ? match[1] : ''
  const initNum = match ? match[2].replace(/\D/g, '') : value.replace(/\D/g, '')

  const [cc,  setCc]  = useState(initCc)
  const [num, setNum] = useState(initNum)

  function format(digits: string) {
    const d = digits.slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`
    return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`
  }

  function emitChange(newCc: string, rawDigits: string) {
    const formatted = format(rawDigits)
    onChange(newCc ? `+${newCc} ${formatted}`.trim() : formatted)
  }

  function handleCc(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
    setCc(v)
    emitChange(v, num)
  }

  function handleNum(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    setNum(raw)
    emitChange(cc, raw)
  }

  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 bg-white">
      <div className="flex items-center gap-1 pl-3 pr-2 border-r border-gray-200 shrink-0">
        <Phone size={13} className="text-gray-400" />
        <span className="text-sm text-gray-500 font-medium">+</span>
        <input value={cc} onChange={handleCc}
          className="w-8 py-2.5 text-sm text-gray-700 font-semibold bg-transparent border-0 focus:outline-none"
          placeholder="1" maxLength={3} />
      </div>
      <input value={format(num)} onChange={handleNum}
        className="flex-1 px-3 py-2.5 text-sm text-gray-700 border-0 focus:outline-none bg-transparent"
        placeholder="234 567 8900" maxLength={12} />
    </div>
  )
}

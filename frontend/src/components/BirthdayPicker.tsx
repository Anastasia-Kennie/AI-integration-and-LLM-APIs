import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Cake } from 'lucide-react'
import clsx from 'clsx'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split('-') : ['', '', '']
  const [year,  setYear]  = useState(parts[0] || '')
  const [month, setMonth] = useState(parts[1] ? parseInt(parts[1]) - 1 : -1)
  const [day,   setDay]   = useState(parts[2] ? parseInt(parts[2]) : 0)

  useEffect(() => {
    if (value) {
      const p = value.split('-')
      setYear(p[0] || '')
      setMonth(p[1] ? parseInt(p[1]) - 1 : -1)
      setDay(p[2] ? parseInt(p[2]) : 0)
    }
  }, [])

  function emit(y: string, m: number, d: number) {
    if (y.length === 4 && m >= 0 && d > 0) {
      onChange(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    } else {
      onChange('')
    }
  }

  function prevMonth() {
    const nm = month <= 0 ? 11 : month - 1
    const ny = month <= 0 ? String(parseInt(year || '2000') - 1) : year
    setMonth(nm); setYear(ny)
    const nd = Math.min(day, new Date(parseInt(ny), nm + 1, 0).getDate())
    setDay(nd); emit(ny, nm, nd)
  }

  function nextMonth() {
    if (parseInt(year) >= new Date().getFullYear()) return
    const nm = month >= 11 ? 0 : month + 1
    const ny = month >= 11 ? String(parseInt(year || '2000') + 1) : year
    setMonth(nm); setYear(ny)
    const nd = Math.min(day, new Date(parseInt(ny), nm + 1, 0).getDate())
    setDay(nd); emit(ny, nm, nd)
  }

  const today = new Date()
  const curYear = parseInt(year) || today.getFullYear()
  const displayMonth = month >= 0 ? month : today.getMonth()

  const firstDay = new Date(curYear, displayMonth, 1).getDay()
  const totalDays = new Date(curYear, displayMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: totalDays}, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* month nav */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-600 to-violet-600">
        <button type="button" onClick={prevMonth} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-white font-semibold text-sm">{MONTHS[displayMonth]} {curYear}</p>
        <button type="button" onClick={nextMonth} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* year input */}
      <div className="flex items-center justify-center gap-2 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs text-gray-500">Year:</span>
        <input type="number" value={year} min={1900} max={today.getFullYear()}
          onChange={e => {
            const v = e.target.value.slice(0, 4)
            setYear(v)
            emit(v, month >= 0 ? month : displayMonth, day)
          }}
          className="w-20 px-2 py-1 text-xs text-center border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder={String(today.getFullYear())} />
      </div>

      {/* day-of-week headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* day grid */}
      <div className="grid grid-cols-7 px-2 pb-3">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const isToday    = d === today.getDate() && displayMonth === today.getMonth() && curYear === today.getFullYear()
          const isSelected = d === day && displayMonth === (month >= 0 ? month : displayMonth)
          return (
            <button key={i} type="button"
              onClick={() => { setDay(d); emit(year || String(curYear), displayMonth, d) }}
              className={clsx(
                'mx-auto w-7 h-7 rounded-full text-xs font-medium transition-all flex items-center justify-center',
                isSelected ? 'bg-primary-600 text-white shadow-md scale-110' :
                isToday    ? 'bg-primary-50 text-primary-600 font-bold' :
                             'text-gray-700 hover:bg-gray-100'
              )}>
              {d}
            </button>
          )
        })}
      </div>

      {/* selected display */}
      {day > 0 && month >= 0 && year.length === 4 && (
        <div className="px-4 py-2.5 bg-primary-50 border-t border-primary-100 flex items-center gap-2">
          <Cake size={13} className="text-primary-500" />
          <span className="text-xs font-medium text-primary-700">
            {MONTHS[displayMonth]} {day}, {year}
          </span>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, X } from 'lucide-react'
import clsx from 'clsx'

export type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // mount → animate in
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return createPortal(
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        type === 'success'
          ? 'bg-white border-green-100 text-green-800'
          : 'bg-white border-red-100 text-red-700'
      )}
    >
      {type === 'success'
        ? <CheckCircle size={18} className="text-green-500 shrink-0" />
        : <XCircle size={18} className="text-red-500 shrink-0" />}
      <span>{message}</span>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
        className="ml-1 text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>,
    document.body
  )
}

// Hook for easy use
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const show = (message: string, type: ToastType = 'success') => setToast({ message, type })
  const hide = () => setToast(null)
  const node = toast ? <Toast message={toast.message} type={toast.type} onClose={hide} /> : null
  return { show, node }
}

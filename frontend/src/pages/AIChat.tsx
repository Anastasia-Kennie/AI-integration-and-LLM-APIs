import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { WS_BASE } from '../lib/urls'
import { Send, Sparkles, Trash2, KeyRound, Eye, EyeOff, CheckCircle2, ChevronDown, Copy, Check } from 'lucide-react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message { role: 'user' | 'assistant'; content: string; model?: string; streaming?: boolean }
interface ModelInfo { id: string; label: string; provider: string; badge: string }

function AvatarCircle({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar?.startsWith('http') || avatar?.startsWith('data:'))
    return <img src={avatar} className="w-8 h-8 rounded-lg object-cover shrink-0 bg-gray-100" />
  return (
    <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {name?.[0]?.toUpperCase() ?? 'U'}
    </div>
  )
}

const PROVIDER_LOGO: Record<string, string> = {
  anthropic: '🤖',
  openai:    '✦',
  groq:      '⚡',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy}
      className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0 transition-colors"
      title="Copy">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

function MessageBubble({ msg, msgModel, userName, userAvatar }: {
  msg: Message
  msgModel?: ModelInfo
  userName: string
  userAvatar?: string
}) {
  return (
    <div className={clsx('flex gap-3 items-start group', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      {msg.role === 'assistant' ? (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 text-white text-sm">
          {msgModel ? PROVIDER_LOGO[msgModel.provider] : <Sparkles size={14} />}
        </div>
      ) : (
        <AvatarCircle name={userName} avatar={userAvatar} />
      )}

      <div className={clsx(
        'max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed',
        msg.role === 'user'
          ? 'bg-primary-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
      )}>
        {msg.role === 'assistant' && (
          <div className="flex items-center justify-between mb-1.5 min-h-[16px]">
            <p className="text-[10px] text-gray-400 font-medium">
              {msgModel ? `${PROVIDER_LOGO[msgModel.provider]} ${msgModel.label}` : ''}
            </p>
            {!msg.streaming && msg.content && <CopyButton text={msg.content} />}
          </div>
        )}

        {msg.role === 'user' ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none prose-table:border prose-th:bg-gray-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2">
            {msg.streaming && msg.content === '' ? (
              <span className="inline-flex gap-1 ml-1 align-middle">
                {[0, 1, 2].map(j => (
                  <span key={j} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce inline-block"
                    style={{ animationDelay: `${j * 150}ms` }} />
                ))}
              </span>
            ) : (
              <>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 animate-pulse align-middle" />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AIChat() {
  const { user, token } = useAuth()
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [wsReady,      setWsReady]      = useState(false)
  const [models,       setModels]       = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState('claude-haiku-5-5')
  const [hasAnthropicKey, setHasAnthropicKey] = useState<boolean | null>(null)
  const [hasOpenAIKey,    setHasOpenAIKey]    = useState<boolean | null>(null)
  const [hasGroqKey,      setHasGroqKey]      = useState<boolean | null>(null)
  const [showKeyPanel, setShowKeyPanel] = useState(false)
  const [keyTab,       setKeyTab]       = useState<'groq' | 'anthropic' | 'openai'>('groq')
  const [apiKeyInput,  setApiKeyInput]  = useState('')
  const [showApiKey,   setShowApiKey]   = useState(false)
  const [savingKey,    setSavingKey]    = useState(false)
  const [keySaved,     setKeySaved]     = useState(false)
  const ws          = useRef<WebSocket | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history & status
  useEffect(() => {
    api.get('/api/ai/history').then(r => setMessages(r.data))
    api.get('/api/ai/status').then(r => {
      setHasAnthropicKey(r.data.has_anthropic_key)
      setHasOpenAIKey(r.data.has_openai_key)
      setHasGroqKey(r.data.has_groq_key)
      setModels(r.data.models ?? [])
    })
  }, [])

  const keyFor = (provider: string) =>
    provider === 'anthropic' ? hasAnthropicKey : provider === 'openai' ? hasOpenAIKey : hasGroqKey

  // Auto-select first available model
  useEffect(() => {
    if (!models.length) return
    const current = models.find(m => m.id === selectedModel)
    if (!current) return
    if (!keyFor(current.provider)) {
      const available = models.find(m => keyFor(m.provider))
      if (available) setSelectedModel(available.id)
    }
  }, [models, hasAnthropicKey, hasOpenAIKey, hasGroqKey])

  // WebSocket
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const connect = () => {
      if (cancelled) return
      const sock = new WebSocket(`${WS_BASE}/api/ai/ws?token=${token}`)
      ws.current = sock
      sock.onopen  = () => setWsReady(true)
      sock.onclose = () => { setWsReady(false); if (!cancelled) setTimeout(connect, 2000) }
      sock.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.text) {
            setMessages(prev => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last?.role === 'assistant' && last.streaming)
                copy[copy.length - 1] = { ...last, content: last.content + data.text }
              return copy
            })
          }
          if (data.done) {
            setMessages(prev => {
              const copy = [...prev]
              if (copy[copy.length - 1]?.streaming)
                copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false }
              return copy
            })
            setLoading(false)
            textareaRef.current?.focus()
          }
        } catch {}
      }
    }
    connect()
    return () => { cancelled = true; ws.current?.close() }
  }, [token])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function sendMessage() {
    if (!input.trim() || loading || !wsReady) return
    const content = input.trim()
    setMessages(prev => [
      ...prev,
      { role: 'user', content, model: selectedModel },
      { role: 'assistant', content: '', model: selectedModel, streaming: true },
    ])
    setInput('')
    setLoading(true)
    ws.current!.send(JSON.stringify({ content, model: selectedModel }))
  }

  async function clearHistory() {
    await api.delete('/api/ai/history')
    setMessages([])
  }

  async function saveKey() {
    if (!apiKeyInput.trim()) return
    setSavingKey(true)
    try {
      await api.post('/api/ai/key', { api_key: apiKeyInput.trim(), provider: keyTab })
      if (keyTab === 'anthropic') setHasAnthropicKey(true)
      else if (keyTab === 'openai') setHasOpenAIKey(true)
      else setHasGroqKey(true)
      setKeySaved(true)
      setApiKeyInput('')
      setTimeout(() => { setKeySaved(false) }, 2500)
    } catch {}
    finally { setSavingKey(false) }
  }

  const currentModel = models.find(m => m.id === selectedModel)
  const isManager    = user?.role === 'manager'

  return (
    <div className="flex flex-col h-full bg-[#f8f9ff]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shrink-0">
        {/* AI icon */}
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-white" />
        </div>

        {/* Title */}
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-800">Ask Relay AI</h2>
          <p className="text-xs text-gray-400">
            {currentModel ? `${PROVIDER_LOGO[currentModel.provider]} ${currentModel.label}` : 'Select a model'}
          </p>
        </div>

        {/* Model selector */}
        {models.length > 0 && (
          <div className="relative">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer">
              {models.map(m => {
                const hasKey = keyFor(m.provider)
                return (
                  <option key={m.id} value={m.id}>
                    {PROVIDER_LOGO[m.provider]} {m.label} ({m.badge}){!hasKey ? ' — no key' : ''}
                  </option>
                )
              })}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Key panel toggle — managers only */}
        {isManager && (
          <button
            onClick={() => { setShowKeyPanel(v => !v); setApiKeyInput(''); setKeySaved(false) }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              (hasAnthropicKey || hasOpenAIKey)
                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
            )}>
            <KeyRound size={13} /> API Keys
          </button>
        )}

        {messages.length > 0 && (
          <button onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 px-2 py-1.5">
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── API Key Panel (managers) ── */}
      {showKeyPanel && isManager && (
        <div className="bg-white border-b border-gray-100 px-5 py-4 shrink-0 space-y-3">
          {/* Provider tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            {([
              { id: 'groq',      label: '⚡ Groq (Free)' },
              { id: 'anthropic', label: '🤖 Anthropic'   },
              { id: 'openai',    label: '✦ OpenAI'       },
            ] as const).map(p => (
              <button key={p.id} onClick={() => { setKeyTab(p.id); setApiKeyInput(''); setShowApiKey(false) }}
                className={clsx(
                  'px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                  keyTab === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}>
                {p.label}
                {keyFor(p.id) && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                )}
              </button>
            ))}
          </div>

          {/* Key input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveKey()}
                placeholder={keyTab === 'anthropic' ? 'sk-ant-api03-…' : 'sk-proj-…'}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowApiKey(v => !v)}
                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600">
                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button onClick={saveKey} disabled={savingKey || !apiKeyInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              {keySaved
                ? <><CheckCircle2 size={13} /> Saved!</>
                : savingKey ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            {keyTab === 'groq'
              ? '🆓 Free — get key at console.groq.com → API Keys (no credit card required)'
              : keyTab === 'anthropic'
              ? 'Get key at console.anthropic.com → API Keys'
              : 'Get key at platform.openai.com → API Keys'}
            {' '}— stored only on this server.
          </p>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 select-none">Type a message to start chatting with Relay AI.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const msgModel = models.find(m => m.id === msg.model)
          return (
            <MessageBubble
              key={i}
              msg={msg}
              msgModel={msgModel}
              userName={user?.name ?? 'U'}
              userAvatar={(user as any)?.avatar}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="bg-white border-t border-gray-100 p-4 shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={wsReady ? 'Ask Relay AI… (Shift+Enter for new line)' : 'Connecting…'}
            rows={2}
            disabled={!wsReady}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:opacity-50"
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading || !wsReady}
            className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

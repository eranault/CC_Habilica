import { useState, useEffect, useRef } from 'react'
import { getPersonas, sendRoundtableMessage } from '../api/agent'
import PersonaCard from '../components/PersonaCard'

// Each message displays sequentially with stagger delay (ms)
const STAGGER_DELAY = 220

function RoundtableMessage({ msg, visible }) {
  if (!visible) return null

  if (msg.role === 'user') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm px-4 py-2 rounded-full max-w-[70%] text-center">
          <span className="text-xs font-semibold text-slate-400 mr-1">You:</span>
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex gap-3 animate-slideInLeft ${
        msg.isAddressingUser ? 'ring-1 ring-amber-400 rounded-2xl p-0.5' : ''
      }`}
    >
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
        <span className="text-2xl">{msg.avatar}</span>
      </div>
      <div
        className="flex-1 bg-white dark:bg-slate-900 rounded-2xl rounded-tl-sm px-4 py-3 text-sm border border-slate-100 dark:border-slate-800 shadow-sm"
        style={{ borderLeftColor: msg.color, borderLeftWidth: '3px' }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-bold" style={{ color: msg.color }}>
            {msg.name}
          </p>
          {msg.isAddressingUser && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
              ↗ Speaking to you
            </span>
          )}
        </div>
        <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
    </div>
  )
}

export default function RoundtablePage() {
  const [personas, setPersonas] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [topic, setTopic] = useState('')
  const [messages, setMessages] = useState([])       // flat list of all displayed messages
  const [pendingMessages, setPendingMessages] = useState([]) // queued to display
  const [visibleCount, setVisibleCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [convened, setConvened] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const staggerTimer = useRef(null)

  useEffect(() => {
    getPersonas().then(setPersonas).catch(() => {})
  }, [])

  // Stagger-reveal pending messages one by one
  useEffect(() => {
    if (pendingMessages.length === 0) return
    let index = 0
    function revealNext() {
      if (index >= pendingMessages.length) {
        setPendingMessages([])
        return
      }
      const msg = pendingMessages[index]
      setMessages(prev => [...prev, msg])
      setVisibleCount(prev => prev + 1)
      index++
      staggerTimer.current = setTimeout(revealNext, STAGGER_DELAY)
    }
    staggerTimer.current = setTimeout(revealNext, STAGGER_DELAY)
    return () => clearTimeout(staggerTimer.current)
  }, [pendingMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function togglePersona(id) {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : prev.length < 4 ? [...prev, id] : prev
    )
  }

  async function convene() {
    if (selectedIds.length < 2 || loading) return
    setError(null)
    setLoading(true)
    setConvened(true)
    setMessages([])
    setVisibleCount(0)
    try {
      const data = await sendRoundtableMessage({
        personaIds: selectedIds,
        topic: topic.trim() || null,
        history: null
      })
      const newMsgs = data.responses.map(r => ({
        role: 'assistant',
        content: r.message,
        personaId: r.personaId,
        name: r.name,
        avatar: r.avatar,
        color: r.color,
        isAddressingUser: r.isAddressingUser || false
      }))
      setPendingMessages(newMsgs)
    } catch (err) {
      setError(err.response?.data?.error || 'The Roundtable is temporarily unavailable.')
      setConvened(false)
    } finally {
      setLoading(false)
    }
  }

  async function extendDiscussion() {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const history = messages.slice(-8).map(m => ({
        personaName: m.name || 'User',
        message: m.content
      }))
      const data = await sendRoundtableMessage({
        personaIds: selectedIds,
        topic: topic.trim() || null,
        history
      })
      const newMsgs = data.responses.map(r => ({
        role: 'assistant',
        content: r.message,
        personaId: r.personaId,
        name: r.name,
        avatar: r.avatar,
        color: r.color,
        isAddressingUser: r.isAddressingUser || false
      }))
      setPendingMessages(newMsgs)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function sendUserMessage() {
    if (!userInput.trim() || loading) return
    const text = userInput.trim()
    setUserInput('')
    setError(null)

    // Add user message to display immediately
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const history = [...messages.slice(-8), { role: 'user', content: text }].map(m => ({
        personaName: m.name || 'User',
        message: m.content
      }))
      const data = await sendRoundtableMessage({
        personaIds: selectedIds,
        topic: topic.trim() || null,
        history
      })
      const newMsgs = data.responses.map(r => ({
        role: 'assistant',
        content: r.message,
        personaId: r.personaId,
        name: r.name,
        avatar: r.avatar,
        color: r.color,
        isAddressingUser: r.isAddressingUser || false
      }))
      setPendingMessages(newMsgs)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendUserMessage()
    }
  }

  // Setup screen
  if (!convened) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">The Roundtable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Select 2–4 legends. They will debate your habits and goals autonomously — and may speak to you directly.
          </p>
        </div>

        {/* Persona grid */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Choose your legends ({selectedIds.length}/4 selected)
          </p>
          <div className="flex flex-wrap gap-3">
            {personas.map(p => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedIds.includes(p.id)}
                onClick={togglePersona}
                multi
              />
            ))}
          </div>
        </div>

        {/* Topic */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
            Topic or goal (optional)
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. How do I build a $1M business while staying disciplined?"
            className="input-field text-sm w-full"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Leave blank to let them discuss your habit patterns freely
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button
          onClick={convene}
          disabled={selectedIds.length < 2 || loading}
          className="btn-primary py-3 text-base font-semibold disabled:opacity-40"
        >
          {loading ? 'Convening...' : '🏛️ Convene the Roundtable'}
        </button>
      </div>
    )
  }

  // Active roundtable
  const selectedPersonas = personas.filter(p => selectedIds.includes(p.id))

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] px-4 py-4 gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            🏛️ The Roundtable
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {selectedPersonas.map(p => (
              <span key={p.id} className="text-base" title={p.name}>{p.avatar}</span>
            ))}
          </div>
        </div>
        <button
          onClick={() => { setConvened(false); setMessages([]); setSelectedIds([]) }}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
        >
          New session
        </button>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
        {topic && (
          <div className="text-center">
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full">
              Topic: {topic}
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <RoundtableMessage key={i} msg={msg} visible={true} />
        ))}

        {loading && pendingMessages.length === 0 && (
          <div className="flex gap-3 items-center px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span>The Roundtable is convening...</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Extend + User input */}
      <div className="flex flex-col gap-2 pb-safe">
        {messages.length > 0 && pendingMessages.length === 0 && !loading && (
          <button
            onClick={extendDiscussion}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 transition-colors"
          >
            Continue the discussion →
          </button>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Join the discussion..."
            rows={1}
            className="input-field text-sm flex-1 resize-none max-h-24"
            disabled={loading}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
          />
          <button
            onClick={sendUserMessage}
            disabled={!userInput.trim() || loading}
            className="btn-primary px-4 py-2.5 flex-shrink-0 disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}

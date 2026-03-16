import { useState, useEffect, useRef } from 'react'
import { getPersonas, sendCoachMessage } from '../api/agent'
import PersonaCard from '../components/PersonaCard'

const QUICK_ACTIONS = [
  'How are my habits looking?',
  'What should I focus on today?',
  'Analyze my streaks',
  'I need some motivation',
]

const CUSTOM_PERSONA = {
  id: '__custom__',
  name: 'Custom Mentor',
  avatar: '✍️',
  domain: 'Type any name below',
}

function Message({ msg }) {
  return (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      {msg.role === 'assistant' && (
        <span className="text-2xl flex-shrink-0 mt-1">{msg.avatar}</span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          msg.role === 'user'
            ? 'bg-accent-500 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
        }`}
      >
        {msg.role === 'assistant' && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            {msg.personaName}
          </p>
        )}
        {msg.content}
      </div>
    </div>
  )
}

export default function CoachPage() {
  const [personas, setPersonas] = useState([])
  const [selectedId, setSelectedId] = useState('alex-hormozi')
  const [customName, setCustomName] = useState('')
  const [goal, setGoal] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [goalSet, setGoalSet] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    getPersonas().then(setPersonas).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const activePersona = selectedId === '__custom__'
    ? { ...CUSTOM_PERSONA, name: customName || 'Custom Mentor', avatar: '✍️' }
    : personas.find(p => p.id === selectedId) || { name: 'Coach', avatar: '🧠' }

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    if (selectedId === '__custom__' && !customName.trim()) {
      setError('Please enter a custom mentor name.')
      return
    }

    setError(null)
    const userMsg = { role: 'user', content: text.trim() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const payload = {
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        goal: goalSet ? goal : null,
      }
      if (selectedId === '__custom__') {
        payload.customPersona = customName.trim()
      } else {
        payload.personaId = selectedId
      }

      const data = await sendCoachMessage(payload)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        personaName: activePersona.name,
        avatar: activePersona.avatar,
      }])
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handlePersonaSelect(id) {
    if (id !== selectedId) {
      setSelectedId(id)
      setMessages([])
      setError(null)
    }
  }

  function handleGoalSubmit(e) {
    e.preventDefault()
    setGoalSet(true)
  }

  const allPersonas = [...personas, CUSTOM_PERSONA]

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] px-4 py-4 gap-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Coach</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          1-on-1 with a legendary mentor who knows your habits
        </p>
      </div>

      {/* Persona Selector */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {allPersonas.map(p => (
          <PersonaCard
            key={p.id}
            persona={p}
            selected={selectedId === p.id}
            onClick={handlePersonaSelect}
          />
        ))}
      </div>

      {/* Custom name input */}
      {selectedId === '__custom__' && (
        <input
          type="text"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          placeholder="Enter mentor name (e.g. Seneca, Warren Buffett...)"
          className="input-field text-sm"
        />
      )}

      {/* Goal input (collapsible) */}
      {!goalSet ? (
        <form onSubmit={handleGoalSubmit} className="flex gap-2">
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Set a goal for this session (optional)..."
            className="input-field text-sm flex-1"
          />
          <button type="submit" className="btn-primary text-sm px-4 whitespace-nowrap">
            {goal.trim() ? 'Set Goal' : 'Skip'}
          </button>
        </form>
      ) : goal.trim() ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>🎯</span>
          <span className="truncate">Goal: {goal}</span>
          <button onClick={() => setGoalSet(false)} className="text-xs underline flex-shrink-0">
            Change
          </button>
        </div>
      ) : null}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-8 text-center">
            <span className="text-5xl">{activePersona.avatar}</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {activePersona.name} is ready
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Ask anything, or use a quick action below
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a}
                  onClick={() => sendMessage(a)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-accent-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <span className="text-2xl flex-shrink-0">{activePersona.avatar}</span>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {activePersona.name}
              </p>
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2 items-end pb-safe">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${activePersona.name}...`}
          rows={1}
          className="input-field text-sm flex-1 resize-none overflow-hidden max-h-32"
          style={{ height: 'auto' }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          disabled={loading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="btn-primary px-4 py-2.5 flex-shrink-0 disabled:opacity-40"
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  )
}

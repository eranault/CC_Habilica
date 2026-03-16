import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHabitStore } from '../store/habitStore'

const ICONS = ['✅','🏃','📚','💧','🧘','💪','🥗','😴','🎯','✍️','🎵','🌱','☀️','🧹','💊','🚴','🏋️','🌿','🔥','⭐','🎨','🧠','🫁','🥤','🍎','🧂','🪥','🛏️','📝','🤸']

const COLORS = [
  '#14b8a6', // teal (default)
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#64748b', // slate
]

const FREQ_OPTIONS = [
  { value: 'daily',         label: 'Daily',           description: 'Every day' },
  { value: 'weekly_days',   label: 'Specific days',   description: 'e.g. Mon/Wed/Fri' },
  { value: 'weekly_count',  label: 'Times per week',  description: 'e.g. 3× per week' },
  { value: 'monthly_count', label: 'Times per month', description: 'e.g. 10× per month' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_VALUES = [0, 1, 2, 3, 4, 5, 6]

const DEFAULTS = {
  name: '', description: '', motivational_note: '',
  icon: '✅', color: '#14b8a6',
  frequency_type: 'daily', frequency_config_json: {},
  difficulty: 'medium', forgiveness_days: 1, is_private: false
}

export default function AddEditHabitModal({ habit = null, onClose }) {
  const { createHabit, updateHabit } = useHabitStore()
  const isEdit = Boolean(habit)

  const [form, setForm] = useState(() => isEdit ? {
    name: habit.name ?? '',
    description: habit.description ?? '',
    motivational_note: habit.motivational_note ?? '',
    icon: habit.icon ?? '✅',
    color: habit.color ?? '#14b8a6',
    frequency_type: habit.frequency_type ?? 'daily',
    frequency_config_json: habit.frequency_config_json ?? {},
    difficulty: habit.difficulty ?? 'medium',
    forgiveness_days: habit.forgiveness_days ?? 1,
    is_private: Boolean(habit.is_private)
  } : { ...DEFAULTS })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleFreqConfigChange = (updates) => {
    setForm(f => ({ ...f, frequency_config_json: { ...f.frequency_config_json, ...updates } }))
  }

  const toggleDay = (day) => {
    const days = form.frequency_config_json.days ?? []
    handleFreqConfigChange({
      days: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort()
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setError('')
    setIsSubmitting(true)
    try {
      const payload = { ...form }
      // Normalise frequency config
      if (form.frequency_type === 'daily') payload.frequency_config_json = {}
      const result = isEdit
        ? await updateHabit(habit.id, payload)
        : await createHabit(payload)
      if (result.success) {
        onClose()
      } else {
        setError(result.error || 'Something went wrong.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Close on backdrop click or Escape
  const handleBackdropKey = (e) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        onKeyDown={handleBackdropKey}
        tabIndex={-1}
      >
        <motion.div
          className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] overflow-y-auto"
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 400 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>

          <div className="px-6 pb-8 pt-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">
              {isEdit ? 'Edit habit' : 'New habit'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="input"
                  placeholder="e.g. Morning run"
                  maxLength={100}
                  required
                />
              </div>

              {/* Icon + Color */}
              <div className="flex gap-4">
                {/* Icon picker */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Icon</label>
                  <div className="grid grid-cols-10 gap-1 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    {ICONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => set('icon', emoji)}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                          form.icon === emoji
                            ? 'bg-accent-100 dark:bg-accent-900/40 ring-2 ring-accent-500'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        aria-label={emoji}
                        aria-pressed={form.icon === emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div className="w-32">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Color</label>
                  <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => set('color', color)}
                        className={`w-10 h-10 rounded-lg transition-all ${
                          form.color === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ background: color }}
                        aria-label={`Color ${color}`}
                        aria-pressed={form.color === color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {FREQ_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        set('frequency_type', opt.value)
                        setForm(f => ({ ...f, frequency_type: opt.value, frequency_config_json: {} }))
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.frequency_type === opt.value
                          ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <p className={`text-sm font-medium ${form.frequency_type === opt.value ? 'text-accent-700 dark:text-accent-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.description}</p>
                    </button>
                  ))}
                </div>

                {/* Frequency config */}
                {form.frequency_type === 'weekly_days' && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {DAY_VALUES.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          (form.frequency_config_json.days ?? []).includes(day)
                            ? 'bg-accent-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        aria-pressed={(form.frequency_config_json.days ?? []).includes(day)}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                )}

                {(form.frequency_type === 'weekly_count' || form.frequency_type === 'monthly_count') && (
                  <div className="flex items-center gap-3 mt-3">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Target:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={form.frequency_type === 'weekly_count' ? 7 : 31}
                      value={form.frequency_config_json.count ?? 3}
                      onChange={e => handleFreqConfigChange({ count: Math.max(1, Number(e.target.value)) })}
                      className="input w-20 text-center"
                    />
                    <span className="text-sm text-slate-500">
                      {form.frequency_type === 'weekly_count' ? 'times/week' : 'times/month'}
                    </span>
                  </div>
                )}
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Difficulty</label>
                <div className="flex gap-2">
                  {['easy', 'medium', 'hard'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('difficulty', d)}
                      className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                        form.difficulty === d
                          ? d === 'easy'   ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : d === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          :                  'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {d === 'easy' ? '😌 Easy' : d === 'medium' ? '💪 Medium' : '🔥 Hard'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Forgiveness days */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Forgiveness
                  <span className="text-xs font-normal text-slate-400 ml-1">— allowed missed days before streak resets</span>
                </label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('forgiveness_days', n)}
                      className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        form.forgiveness_days === n
                          ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950/30 dark:text-accent-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motivational note */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Motivational note <span className="text-xs font-normal text-slate-400">(shown in Focus Mode)</span>
                </label>
                <textarea
                  value={form.motivational_note}
                  onChange={e => set('motivational_note', e.target.value)}
                  className="input resize-none"
                  rows={2}
                  placeholder="Why does this matter to you?"
                  maxLength={280}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{form.motivational_note.length}/280</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className="input resize-none"
                  rows={2}
                  placeholder="Any extra details…"
                  maxLength={500}
                />
              </div>

              {/* Private toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  role="switch"
                  aria-checked={form.is_private}
                  tabIndex={0}
                  onClick={() => set('is_private', !form.is_private)}
                  onKeyDown={e => e.key === ' ' && set('is_private', !form.is_private)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    form.is_private ? 'bg-accent-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                    form.is_private ? 'left-5' : 'left-1'
                  }`} />
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">Private habit</span>
              </label>

              {error && (
                <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create habit')}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

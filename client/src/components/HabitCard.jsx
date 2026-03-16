import { useState, useRef } from 'react'
import { useCheckinStore } from '../store/checkinStore'

const DIFFICULTY_BADGE = {
  easy:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard:   'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
}

function CheckButton({ isChecked, animating, onCheck, name }) {
  return (
    <button
      onClick={onCheck}
      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500 ${
        animating ? 'animate-check-bounce' : ''
      } ${
        isChecked
          ? 'bg-accent-500 border-accent-500 shadow-md shadow-accent-500/30'
          : 'border-slate-200 dark:border-slate-600 hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-950'
      }`}
      aria-label={isChecked ? `Undo check-in for ${name}` : `Check in for ${name}`}
      aria-pressed={isChecked}
    >
      {isChecked ? (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-600" />
      )}
    </button>
  )
}

export default function HabitCard({ habit, onEdit, onArchive, onDelete, dragListeners, compact = false }) {
  const { checkinsToday, checkIn, undoCheckIn } = useCheckinStore()
  const isChecked = Boolean(checkinsToday[habit.id])
  const [animating, setAnimating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [undoError, setUndoError] = useState('')
  const menuRef = useRef(null)

  const handleCheck = async () => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => setAnimating(false), 400)

    if (isChecked) {
      const result = await undoCheckIn(habit.id)
      if (!result?.success && result?.error) {
        setUndoError(result.error)
        setTimeout(() => setUndoError(''), 3000)
      }
    } else {
      await checkIn(habit.id)
    }
  }

  const handleMenuAction = (action) => {
    setMenuOpen(false)
    if (action === 'edit') onEdit?.(habit)
    if (action === 'archive') onArchive?.(habit)
    if (action === 'delete') onDelete?.(habit)
  }

  // Close menu on outside click
  const handleBlur = (e) => {
    if (!menuRef.current?.contains(e.relatedTarget)) {
      setMenuOpen(false)
    }
  }

  const streak = habit.current_streak ?? 0
  const hasDragHandle = Boolean(dragListeners)

  return (
    <div
      className={`card relative flex items-center gap-3 transition-opacity duration-200 ${
        isChecked ? 'opacity-70' : 'opacity-100'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* Left color accent bar */}
      <div
        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
        style={{ background: habit.color || '#14b8a6' }}
        aria-hidden="true"
      />

      {/* Drag handle (if provided) */}
      {hasDragHandle && (
        <button
          {...dragListeners}
          className="touch-none cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-400 flex-shrink-0 ml-1 p-1 -m-1"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 8h18M3 12h18M3 16h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Icon */}
      <span className={`flex-shrink-0 ${compact ? 'text-xl' : 'text-2xl'} ml-2`} aria-hidden="true">
        {habit.icon || '✅'}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate transition-all duration-200 ${
          isChecked
            ? 'text-slate-400 dark:text-slate-500 line-through'
            : 'text-slate-900 dark:text-white'
        } ${compact ? 'text-sm' : ''}`}>
          {habit.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {streak > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-0.5" title={`${streak}-day streak`}>
              🔥 <span className="font-medium">{streak}</span>
            </span>
          )}
          {habit.difficulty && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${DIFFICULTY_BADGE[habit.difficulty] || ''}`}>
              {habit.difficulty}
            </span>
          )}
          {undoError && (
            <span className="text-[10px] text-rose-500">{undoError}</span>
          )}
        </div>
      </div>

      {/* Context menu */}
      {(onEdit || onArchive || onDelete) && (
        <div className="relative flex-shrink-0" ref={menuRef} onBlur={handleBlur}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={`Options for ${habit.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-9 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-1 min-w-[140px] animate-fade-in"
              role="menu"
            >
              {onEdit && (
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => handleMenuAction('edit')}
                  role="menuitem"
                >
                  <span aria-hidden="true">✏️</span> Edit
                </button>
              )}
              {onArchive && (
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => handleMenuAction('archive')}
                  role="menuitem"
                >
                  <span aria-hidden="true">{habit.is_archived ? '📤' : '📦'}</span>
                  {habit.is_archived ? 'Unarchive' : 'Archive'}
                </button>
              )}
              {onDelete && (
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                  onClick={() => handleMenuAction('delete')}
                  role="menuitem"
                >
                  <span aria-hidden="true">🗑️</span> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Check button */}
      <CheckButton
        isChecked={isChecked}
        animating={animating}
        onCheck={handleCheck}
        name={habit.name}
      />
    </div>
  )
}

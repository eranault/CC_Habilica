import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useHabitStore } from '../store/habitStore'
import { useCheckinStore } from '../store/checkinStore'
import { useAuthStore } from '../store/authStore'

// Direction for card slide animation: +1 = slide from right, -1 = slide from left
const SLIDE = {
  enter: (dir) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0, scale: 0.96 })
}

const TRANSITION = { type: 'spring', damping: 30, stiffness: 350 }

function ProgressDots({ total, current, checkedSet, habits }) {
  if (total === 0) return null
  return (
    <div className="flex gap-1.5 justify-center flex-wrap px-8" role="tablist" aria-label="Habit progress">
      {habits.map((h, i) => (
        <div
          key={h.id}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            checkedSet.has(h.id)
              ? 'bg-accent-400 w-4'
              : i === current
                ? 'bg-white w-4'
                : 'bg-white/30 w-1.5'
          }`}
          role="tab"
          aria-selected={i === current}
          aria-label={`${h.name} ${checkedSet.has(h.id) ? '(done)' : ''}`}
        />
      ))}
    </div>
  )
}

function BigCheckButton({ isChecked, animating, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 focus-visible:ring-4 focus-visible:ring-white/50 ${
        animating ? 'animate-check-bounce' : ''
      } ${
        isChecked
          ? 'bg-accent-500 border-accent-400 shadow-2xl shadow-accent-500/40'
          : 'border-white/30 bg-white/10 hover:bg-white/20 hover:border-white/50 active:scale-95'
      }`}
      aria-label={isChecked ? 'Undo check-in' : 'Mark as done'}
      aria-pressed={isChecked}
    >
      {isChecked ? (
        <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-12 h-12 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="9" strokeDasharray="56.5" strokeDashoffset="0" />
        </svg>
      )}
    </button>
  )
}

function AllDoneScreen({ habits, checkedSet, onExit }) {
  const doneCount = habits.filter(h => checkedSet.has(h.id)).length
  const total = habits.length

  return (
    <motion.div
      className="flex flex-col items-center justify-center text-center px-8 py-12"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 300 }}
    >
      <motion.div
        className="text-8xl mb-6"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 18, stiffness: 300 }}
      >
        🎉
      </motion.div>
      <h2 className="text-3xl font-bold text-white mb-2">
        {doneCount === total ? 'All done!' : `${doneCount} of ${total} done`}
      </h2>
      <p className="text-white/60 text-lg mb-10">
        {doneCount === total
          ? "You crushed it today. Keep the streak alive! 🔥"
          : "Great progress — come back and finish the rest!"}
      </p>
      <button
        onClick={onExit}
        className="btn-primary bg-white text-slate-900 hover:bg-white/90 px-8"
      >
        Back to dashboard
      </button>
    </motion.div>
  )
}

export default function FocusModePage() {
  const navigate = useNavigate()
  const { habits, fetchHabits } = useHabitStore()
  const { checkinsToday, fetchTodayCheckins, checkIn, undoCheckIn } = useCheckinStore()
  const { user } = useAuthStore()

  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [animating, setAnimating] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchHabits()
    const dayResetHour = user?.settings?.dayResetHour ?? 3
    fetchTodayCheckins(dayResetHour)
  }, [fetchHabits, fetchTodayCheckins, user?.settings?.dayResetHour])

  const activeHabits = habits.filter(h => !h.is_archived)
  const checkedSet = new Set(Object.keys(checkinsToday).map(Number))

  const habit = activeHabits[index]
  const isChecked = habit ? checkedSet.has(habit.id) : false

  const goTo = useCallback((nextIndex, dir) => {
    setDirection(dir)
    setIndex(Math.max(0, Math.min(nextIndex, activeHabits.length - 1)))
  }, [activeHabits.length])

  const goNext = useCallback(() => {
    if (index < activeHabits.length - 1) {
      goTo(index + 1, 1)
    } else {
      setShowAll(true)
    }
  }, [index, activeHabits.length, goTo])

  const goPrev = useCallback(() => {
    if (index > 0) goTo(index - 1, -1)
  }, [index, goTo])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleCheck()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleCheck = async () => {
    if (!habit || animating) return
    setAnimating(true)
    setTimeout(() => {
      setAnimating(false)
      if (!isChecked) {
        // Auto-advance after check
        setTimeout(goNext, 350)
      }
    }, 400)

    if (isChecked) {
      await undoCheckIn(habit.id)
    } else {
      await checkIn(habit.id)
    }
  }

  const doneCount = activeHabits.filter(h => checkedSet.has(h.id)).length

  // Swipe support
  let touchStart = null
  const handleTouchStart = (e) => { touchStart = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart === null) return
    const diff = touchStart - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
    touchStart = null
  }

  if (activeHabits.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white px-6">
        <span className="text-6xl mb-4">🌱</span>
        <h2 className="text-2xl font-bold mb-2">No habits yet</h2>
        <p className="text-slate-400 mb-8 text-center">Add habits from the dashboard to use Focus Mode.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go to dashboard</button>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-900 text-white select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Close Focus Mode"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-sm text-white/60">Focus Mode</p>
          <p className="text-xs text-white/40">{doneCount} of {activeHabits.length} done</p>
        </div>

        {/* All done shortcut */}
        <button
          onClick={() => setShowAll(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
          aria-label="View summary"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
      </div>

      {/* Main card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          {showAll ? (
            <AllDoneScreen
              habits={activeHabits}
              checkedSet={checkedSet}
              onExit={() => navigate('/')}
            />
          ) : habit && (
            <motion.div
              key={`${habit.id}-${index}`}
              custom={direction}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={TRANSITION}
              className="w-full max-w-sm flex flex-col items-center text-center"
            >
              {/* Habit icon */}
              <motion.div
                className="text-7xl mb-4"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 300 }}
              >
                {habit.icon || '✅'}
              </motion.div>

              {/* Habit name */}
              <h2 className={`text-2xl font-bold mb-2 transition-all duration-300 ${
                isChecked ? 'text-accent-400 line-through opacity-70' : 'text-white'
              }`}>
                {habit.name}
              </h2>

              {/* Streak */}
              {(habit.current_streak ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-white/60 mb-2">
                  <span>🔥</span>
                  <span className="font-medium">{habit.current_streak}-day streak</span>
                </div>
              )}

              {/* Motivational note */}
              {habit.motivational_note && !isChecked && (
                <motion.p
                  className="text-white/50 text-sm italic mb-8 max-w-[280px] leading-relaxed"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  "{habit.motivational_note}"
                </motion.p>
              )}

              {isChecked && (
                <motion.p
                  className="text-accent-400 text-sm font-medium mb-8"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  ✓ Done! Tap to undo
                </motion.p>
              )}

              {!habit.motivational_note && !isChecked && <div className="mb-8" />}

              {/* Check button */}
              <BigCheckButton
                isChecked={isChecked}
                animating={animating}
                onClick={handleCheck}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom: progress dots + navigation */}
      {!showAll && (
        <div className="px-5 pb-8 pb-safe space-y-5">
          <ProgressDots
            total={activeHabits.length}
            current={index}
            checkedSet={checkedSet}
            habits={activeHabits}
          />

          {/* Prev / Skip / Next */}
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20"
              aria-label="Previous habit"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={goNext}
              className="px-6 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              {index === activeHabits.length - 1 ? 'Finish' : 'Skip →'}
            </button>

            <button
              onClick={goNext}
              disabled={index >= activeHabits.length - 1 && !showAll}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20"
              aria-label="Next habit"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

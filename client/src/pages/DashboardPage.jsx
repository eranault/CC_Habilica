import { useEffect, useState } from 'react'
import { useHabitStore } from '../store/habitStore'
import EmptyState from '../components/EmptyState'
import SkeletonCard from '../components/SkeletonCard'
import ErrorMessage from '../components/ErrorMessage'

export default function DashboardPage() {
  const { habits, isLoading, error, fetchHabits } = useHabitStore()
  const [viewMode, setViewMode] = useState('list') // 'list' | 'focus'

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  const activeHabits = habits.filter(h => !h.is_archived)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Today</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('focus')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                viewMode === 'focus'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-pressed={viewMode === 'focus'}
            >
              Focus
            </button>
          </div>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={fetchHabits} />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : activeHabits.length === 0 ? (
        <EmptyState
          icon="🌱"
          title="No habits yet"
          description="Start tracking a habit today. Every journey begins with a single step."
          action={
            <button className="btn-primary">
              Add your first habit
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {activeHabits.map(habit => (
            <div key={habit.id} className="card p-4 flex items-center gap-4">
              <span className="text-2xl" aria-hidden="true">{habit.icon || '✅'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{habit.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 capitalize">{habit.frequency_type}</p>
              </div>
              <button
                className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-600 hover:border-accent-400 transition-all duration-150 flex items-center justify-center"
                aria-label={`Check in for ${habit.name}`}
              >
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">○</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

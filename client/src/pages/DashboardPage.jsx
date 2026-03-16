import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useHabitStore } from '../store/habitStore'
import { useCheckinStore } from '../store/checkinStore'
import { useAuthStore } from '../store/authStore'
import HabitCard from '../components/HabitCard'
import AddEditHabitModal from '../components/AddEditHabitModal'
import EmptyState from '../components/EmptyState'
import SkeletonCard from '../components/SkeletonCard'
import ErrorMessage from '../components/ErrorMessage'

// ── Sortable wrapper around HabitCard ────────────────────────────────────────

function SortableHabitCard({ habit, onEdit, onArchive, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <HabitCard
        habit={habit}
        onEdit={onEdit}
        onArchive={onArchive}
        onDelete={onDelete}
        dragListeners={listeners}
      />
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function TodayProgress({ total, completed }) {
  if (total === 0) return null
  const pct = Math.round((completed / total) * 100)
  const allDone = completed === total

  return (
    <div className="card px-5 py-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {allDone
            ? '🎉 All done for today!'
            : `${completed} of ${total} completed`}
        </span>
        <span className={`text-sm font-semibold ${allDone ? 'text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            allDone ? 'bg-accent-500' : 'bg-accent-400'
          }`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct}% of today's habits completed`}
        />
      </div>
    </div>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirmation({ habit, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-sm w-full animate-slide-up">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete habit?</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          "<span className="font-medium text-slate-700 dark:text-slate-300">{habit.name}</span>" and all its check-in history will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={onConfirm}
            className="flex-1 justify-center bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all duration-150 touch-target"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { habits, isLoading, error, fetchHabits, reorderHabits, archiveHabit, deleteHabit } = useHabitStore()
  const { checkinsToday, fetchTodayCheckins } = useCheckinStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [filter, setFilter] = useState('all')
  const [modalState, setModalState] = useState(null) // null | { mode: 'add' } | { mode: 'edit', habit }
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    fetchHabits()
    const dayResetHour = user?.settings?.dayResetHour ?? 3
    fetchTodayCheckins(dayResetHour)
  }, [fetchHabits, fetchTodayCheckins, user?.settings?.dayResetHour])

  const activeHabits = habits.filter(h => !h.is_archived)
  const completedIds = new Set(Object.keys(checkinsToday).map(Number))
  const completed = activeHabits.filter(h => completedIds.has(h.id))
  const remaining = activeHabits.filter(h => !completedIds.has(h.id))

  const displayedHabits = filter === 'done'
    ? completed
    : filter === 'remaining'
      ? remaining
      : activeHabits

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = activeHabits.findIndex(h => h.id === active.id)
    const newIndex = activeHabits.findIndex(h => h.id === over.id)
    const reordered = arrayMove(activeHabits, oldIndex, newIndex)
    reorderHabits(reordered.map(h => h.id))
  }, [activeHabits, reorderHabits])

  const handleArchive = async (habit) => {
    await archiveHabit(habit.id)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await deleteHabit(deleteTarget.id)
    setDeleteTarget(null)
  }

  const activeHabit = activeHabits.find(h => h.id === activeId)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Today</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode: List / Focus */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            <button
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              aria-pressed={true}
            >
              List
            </button>
            <button
              onClick={() => navigate('/focus')}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
              aria-pressed={false}
            >
              Focus
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      <ErrorMessage message={error} onRetry={fetchHabits} />

      {/* Progress bar */}
      {!isLoading && (
        <TodayProgress total={activeHabits.length} completed={completed.length} />
      )}

      {/* Filter tabs */}
      {!isLoading && activeHabits.length > 0 && (
        <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1">
          {[
            { key: 'all',       label: `All (${activeHabits.length})` },
            { key: 'remaining', label: `Remaining (${remaining.length})` },
            { key: 'done',      label: `Done (${completed.length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                filter === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Habit list */}
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
            <button className="btn-primary" onClick={() => setModalState({ mode: 'add' })}>
              Add your first habit
            </button>
          }
        />
      ) : displayedHabits.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <p className="text-3xl mb-2">{filter === 'done' ? '🎯' : '✅'}</p>
          <p className="text-sm">{filter === 'done' ? 'None completed yet today.' : 'All done for today!'}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={displayedHabits.map(h => h.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {displayedHabits.map(habit => (
                <SortableHabitCard
                  key={habit.id}
                  habit={habit}
                  onEdit={(h) => setModalState({ mode: 'edit', habit: h })}
                  onArchive={handleArchive}
                  onDelete={(h) => setDeleteTarget(h)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeHabit ? (
              <div className="opacity-90 shadow-2xl rotate-1">
                <HabitCard habit={activeHabit} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* FAB: Add habit */}
      {!isLoading && (
        <button
          onClick={() => setModalState({ mode: 'add' })}
          className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white rounded-full shadow-lg shadow-accent-500/30 flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 z-40"
          aria-label="Add new habit"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Modals */}
      {modalState && (
        <AddEditHabitModal
          habit={modalState.mode === 'edit' ? modalState.habit : null}
          onClose={() => setModalState(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmation
          habit={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

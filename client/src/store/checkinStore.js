import { create } from 'zustand'
import { checkinsApi } from '../api/checkins'
import { useHabitStore } from './habitStore'

export function getLogicalToday(dayResetHour = 3) {
  const now = new Date()
  if (now.getHours() < dayResetHour) now.setDate(now.getDate() - 1)
  return now.toISOString().slice(0, 10)
}

export const useCheckinStore = create((set, get) => ({
  // { [habitId]: { id, habit_id, logical_date, note, checked_at } }
  checkinsToday: {},
  today: getLogicalToday(),
  isLoading: false,

  fetchTodayCheckins: async (dayResetHour = 3) => {
    const today = getLogicalToday(dayResetHour)
    set({ today, isLoading: true })
    try {
      const res = await checkinsApi.getRange({ from: today, to: today })
      if (res.data.success) {
        const map = {}
        for (const ci of res.data.data) {
          map[ci.habit_id] = ci
        }
        set({ checkinsToday: map, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  checkIn: async (habitId, note = '') => {
    const { today, checkinsToday } = get()

    // Optimistic update with a temporary negative id
    const tempEntry = { id: -habitId, habit_id: habitId, logical_date: today, note, checked_at: new Date().toISOString() }
    set({ checkinsToday: { ...checkinsToday, [habitId]: tempEntry } })

    try {
      const res = await checkinsApi.create({ habit_id: habitId, logical_date: today, note })
      if (res.data.success) {
        set(state => ({ checkinsToday: { ...state.checkinsToday, [habitId]: res.data.data } }))
        // Refresh habit streaks in background
        useHabitStore.getState().fetchHabits()
        return { success: true, data: res.data.data }
      }
      throw new Error(res.data.error)
    } catch (err) {
      // Revert
      set(state => {
        const updated = { ...state.checkinsToday }
        delete updated[habitId]
        return { checkinsToday: updated }
      })
      return { success: false, error: err.message }
    }
  },

  undoCheckIn: async (habitId) => {
    const checkin = get().checkinsToday[habitId]
    if (!checkin || checkin.id < 0) return { success: false, error: 'Not found.' }

    // Client-side 5-minute guard
    const checkedAt = checkin.checked_at.endsWith('Z') ? checkin.checked_at : checkin.checked_at + 'Z'
    const ageMs = Date.now() - new Date(checkedAt).getTime()
    if (ageMs > 5 * 60 * 1000) {
      return { success: false, error: 'Cannot undo after 5 minutes.' }
    }

    // Optimistic revert
    set(state => {
      const updated = { ...state.checkinsToday }
      delete updated[habitId]
      return { checkinsToday: updated }
    })

    try {
      await checkinsApi.remove(checkin.id)
      useHabitStore.getState().fetchHabits()
      return { success: true }
    } catch (err) {
      // Restore
      set(state => ({ checkinsToday: { ...state.checkinsToday, [habitId]: checkin } }))
      return { success: false, error: err.message }
    }
  },

  reset: () => set({ checkinsToday: {}, today: getLogicalToday() })
}))

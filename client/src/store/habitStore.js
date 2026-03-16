import { create } from 'zustand'
import { apiClient } from '../api/client'

export const useHabitStore = create((set, get) => ({
  habits: [],
  isLoading: false,
  error: null,

  fetchHabits: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await apiClient.get('/habits')
      if (res.data.success) {
        set({ habits: res.data.data, isLoading: false })
      }
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  createHabit: async (habitData) => {
    const res = await apiClient.post('/habits', habitData)
    if (res.data.success) {
      set(state => ({ habits: [...state.habits, res.data.data] }))
    }
    return res.data
  },

  updateHabit: async (id, updates) => {
    const res = await apiClient.put(`/habits/${id}`, updates)
    if (res.data.success) {
      set(state => ({
        habits: state.habits.map(h => h.id === id ? res.data.data : h)
      }))
    }
    return res.data
  },

  deleteHabit: async (id) => {
    const res = await apiClient.delete(`/habits/${id}`)
    if (res.data.success) {
      set(state => ({ habits: state.habits.filter(h => h.id !== id) }))
    }
    return res.data
  },

  archiveHabit: async (id) => {
    const res = await apiClient.patch(`/habits/${id}/archive`)
    if (res.data.success) {
      set(state => ({
        habits: state.habits.map(h => h.id === id ? { ...h, is_archived: 1 } : h)
      }))
    }
    return res.data
  },

  reorderHabits: async (orderedIds) => {
    // Optimistic update
    const currentHabits = get().habits
    const reordered = orderedIds.map(id => currentHabits.find(h => h.id === id)).filter(Boolean)
    set({ habits: reordered })

    try {
      await apiClient.patch('/habits/reorder', { orderedIds })
    } catch {
      // Revert on failure
      set({ habits: currentHabits })
    }
  },

  clearError: () => set({ error: null })
}))

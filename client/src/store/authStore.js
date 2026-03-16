import { create } from 'zustand'
import { apiClient } from '../api/client'

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Called once on app mount to restore session from httpOnly cookie.
   */
  initAuth: async () => {
    try {
      const res = await apiClient.get('/auth/me')
      if (res.data.success) {
        set({ user: res.data.data, isAuthenticated: true, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  login: async (email, password, rememberMe = false) => {
    const res = await apiClient.post('/auth/login', { email, password, rememberMe })
    if (res.data.success) {
      set({ user: res.data.data, isAuthenticated: true })
    }
    return res.data
  },

  register: async (email, password) => {
    const res = await apiClient.post('/auth/register', { email, password })
    if (res.data.success) {
      set({ user: res.data.data, isAuthenticated: true })
    }
    return res.data
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },

  updateSettings: async (settings) => {
    const res = await apiClient.patch('/auth/settings', settings)
    if (res.data.success) {
      set(state => ({
        user: { ...state.user, settings: res.data.data.settings }
      }))
    }
    return res.data
  },

  requestDeletion: async () => {
    const res = await apiClient.post('/auth/delete-account')
    if (res.data.success) {
      set({ user: null, isAuthenticated: false })
    }
    return res.data
  },

  cancelDeletion: async () => {
    const res = await apiClient.post('/auth/cancel-deletion')
    if (res.data.success) {
      await get().initAuth()
    }
    return res.data
  },

  updateUser: (updates) => {
    set(state => ({ user: { ...state.user, ...updates } }))
  }
}))

import { create } from 'zustand'
import { apiClient } from '../api/client'

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

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

  updateUser: (updates) => {
    set(state => ({ user: { ...state.user, ...updates } }))
  }
}))

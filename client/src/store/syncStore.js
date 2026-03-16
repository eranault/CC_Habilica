import { create } from 'zustand'

// Tracks offline sync status
export const useSyncStore = create((set) => ({
  status: 'synced', // 'synced' | 'pending' | 'error'
  pendingCount: 0,

  setStatus: (status) => set({ status }),
  setPendingCount: (count) => set({
    pendingCount: count,
    status: count > 0 ? 'pending' : 'synced'
  }),
  setError: () => set({ status: 'error' }),
  setSynced: () => set({ status: 'synced', pendingCount: 0 })
}))

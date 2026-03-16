import { useAuthStore } from '../store/authStore'

/**
 * Convenience hook that derives values from the auth store.
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, login, register, logout, updateSettings } = useAuthStore()

  /**
   * The hour at which the "day" resets for this user.
   * Default: 3 (3:00 AM). Configurable in Settings.
   */
  const dayResetHour = user?.settings?.dayResetHour ?? 3

  /**
   * Returns the logical "today" date string (YYYY-MM-DD) accounting for dayResetHour.
   * If it's currently before dayResetHour, logical today = yesterday.
   */
  function getLogicalToday() {
    const now = new Date()
    if (now.getHours() < dayResetHour) {
      now.setDate(now.getDate() - 1)
    }
    return now.toISOString().slice(0, 10)
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateSettings,
    dayResetHour,
    getLogicalToday
  }
}

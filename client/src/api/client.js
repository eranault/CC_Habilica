import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isPublicPath = ['/login', '/register', '/reset-password', '/forgot-password']
      .some(p => window.location.pathname.startsWith(p))

    // Only force-redirect on 401 when the user is on a protected page.
    // Suppressing it on /auth/me (session probe) prevents an infinite reload
    // loop when the backend is running but no session cookie exists yet.
    if (
      error.response?.status === 401 &&
      !url.includes('/auth/me') &&
      !isPublicPath
    ) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import ErrorMessage from '../components/ErrorMessage'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  // Request-reset state (no token in URL)
  const [email, setEmail] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  // Confirm-reset state (token in URL)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Request a reset link ──────────────────────────────────────────────────
  const handleRequest = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await apiClient.post('/auth/reset-password', { email })
      setRequestSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Confirm with token ────────────────────────────────────────────────────
  const handleConfirm = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setIsLoading(true)
    try {
      await apiClient.post('/auth/reset-password/confirm', { token, password })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'This link is invalid or expired.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Confirm success ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="card p-6 text-center animate-fade-in">
        <span className="text-4xl block mb-3" aria-hidden="true">✅</span>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Password updated</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">You can now log in with your new password.</p>
        <Link to="/login" className="btn-primary w-full justify-center">Sign in</Link>
      </div>
    )
  }

  // ── Request sent ──────────────────────────────────────────────────────────
  if (requestSent) {
    return (
      <div className="card p-6 text-center animate-fade-in">
        <span className="text-4xl block mb-3" aria-hidden="true">📬</span>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Check your inbox</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          If an account with that email exists, we've sent a reset link. It expires in 1 hour.
        </p>
        <Link to="/login" className="btn-secondary w-full justify-center">Back to login</Link>
      </div>
    )
  }

  // ── Confirm form (token present) ──────────────────────────────────────────
  if (token) {
    return (
      <div className="card p-6 animate-slide-up">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Set new password</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Choose a strong password for your Streakr account.</p>
        <form onSubmit={handleConfirm} className="space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <ErrorMessage message={error} />
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    )
  }

  // ── Request form (no token) ───────────────────────────────────────────────
  return (
    <div className="card p-6 animate-slide-up">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Forgot password?</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Enter your email and we'll send you a reset link.
      </p>
      <form onSubmit={handleRequest} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <ErrorMessage message={error} />
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link to="/login" className="text-accent-600 dark:text-accent-400 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  )
}

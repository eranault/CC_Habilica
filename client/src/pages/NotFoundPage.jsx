import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-slate-50 dark:bg-slate-950">
      <span className="text-6xl mb-4" aria-hidden="true">🗺️</span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">That page doesn't exist.</p>
      <Link to="/" className="btn-primary">Go home</Link>
    </div>
  )
}

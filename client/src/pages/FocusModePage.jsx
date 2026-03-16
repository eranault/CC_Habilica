import { Link } from 'react-router-dom'

export default function FocusModePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white px-6">
      <div className="text-center">
        <span className="text-6xl mb-6 block" aria-hidden="true">🎯</span>
        <h1 className="text-3xl font-bold mb-3">Focus Mode</h1>
        <p className="text-slate-400 mb-8 max-w-sm">
          Guided, one-at-a-time habit check-ins. Coming in the next build step.
        </p>
        <Link to="/" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

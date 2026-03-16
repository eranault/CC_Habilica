import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Streakr</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">Habit tracking, without the guilt</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

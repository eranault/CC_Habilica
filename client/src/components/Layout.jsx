import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useSyncStore } from '../store/syncStore'
import { useAuthStore } from '../store/authStore'

const NAV_ITEMS = [
  { to: '/',        icon: '🏠', label: 'Home',     exact: true },
  { to: '/stats',   icon: '📊', label: 'Stats'    },
  { to: '/focus',   icon: '🎯', label: 'Focus'    },
  { to: '/settings', icon: '⚙️', label: 'Settings' }
]

function SyncIndicator() {
  const { status, pendingCount } = useSyncStore()
  const labels = { synced: 'Synced', pending: `${pendingCount} pending`, error: 'Sync error' }
  const dotClass = {
    synced: 'sync-dot-synced',
    pending: 'sync-dot-pending',
    error: 'sync-dot-error'
  }[status] || 'sync-dot-synced'

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500" aria-live="polite">
      <span className={`sync-dot ${dotClass}`} aria-hidden="true" />
      <span>{labels[status]}</span>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const isFocusMode = location.pathname === '/focus'

  // Focus mode gets fullscreen treatment
  if (isFocusMode) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Desktop top nav */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Streakr
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <SyncIndicator />
          <span className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</span>
          <button
            onClick={logout}
            className="btn-ghost text-sm"
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 safe-top">
        <span className="text-lg font-bold text-slate-900 dark:text-white">Streakr</span>
        <SyncIndicator />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 safe-bottom z-50"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.map(({ to, icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[60px] transition-all duration-150 ${
                  isActive
                    ? 'text-accent-600 dark:text-accent-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <span className="text-xl" aria-hidden="true">{icon}</span>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-accent-600 dark:text-accent-400' : ''}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

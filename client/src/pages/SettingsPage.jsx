import { useThemeStore } from '../store/themeStore'
import { useAuthStore } from '../store/authStore'
import { statsApi } from '../api/stats'
import { useState } from 'react'

const THEMES = [
  { value: 'light',  label: 'Light' },
  { value: 'dark',   label: 'Dark' },
  { value: 'system', label: 'System' }
]

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, children }) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------
function AppearanceSection() {
  const { theme, setTheme } = useThemeStore()
  return (
    <Section title="Appearance">
      <div className="flex items-center gap-2">
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            aria-pressed={theme === value}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
              theme === value
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
function NotificationsSection() {
  const supported = 'Notification' in window && 'serviceWorker' in navigator
  const [permission, setPermission] = useState(
    supported ? Notification.permission : 'unsupported'
  )
  const [requesting, setRequesting] = useState(false)

  const requestPermission = async () => {
    setRequesting(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <Section title="Notifications">
      {!supported && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Push notifications are not supported in this browser.
        </p>
      )}
      {supported && permission === 'granted' && (
        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
          <span aria-hidden="true">✓</span> Notifications enabled.
          Per-habit reminder times can be configured from the habit edit dialog.
        </p>
      )}
      {supported && permission === 'denied' && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Notifications are blocked. To enable them, update your browser's site settings and reload.
        </p>
      )}
      {supported && permission === 'default' && (
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
              Allow Streakr to send daily reminders for your habits.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              You can set per-habit reminder times after enabling.
            </p>
          </div>
          <button
            onClick={requestPermission}
            disabled={requesting}
            className="btn-primary text-sm shrink-0"
          >
            {requesting ? 'Requesting…' : 'Enable'}
          </button>
        </div>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Data & Privacy
// ---------------------------------------------------------------------------
function DataSection() {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await statsApi.exportCsv()
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `streakr-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail
    } finally {
      setExporting(false)
    }
  }

  return (
    <Section title="Data & Privacy">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Export your data</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Download all your check-ins as a CSV file.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-ghost text-sm shrink-0"
        >
          {exporting ? 'Preparing…' : '⬇ Download CSV'}
        </button>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4 text-xs text-slate-400 dark:text-slate-500 space-y-1">
        <p>Your data is stored locally on the server and never sold or shared.</p>
        <p>Accountability partners only see your weekly completion rate unless you explicitly share more.</p>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
function AccountSection() {
  const { user, logout } = useAuthStore()

  return (
    <Section title="Account">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user?.email}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Signed in</p>
        </div>
        <button onClick={logout} className="btn-ghost text-sm text-red-500 hover:text-red-600 dark:text-red-400">
          Log out
        </button>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      <AppearanceSection />
      <NotificationsSection />
      <DataSection />
      <AccountSection />
    </div>
  )
}

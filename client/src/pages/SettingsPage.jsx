import { useThemeStore } from '../store/themeStore'

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark' },
  { value: 'system', label: 'System' }
]

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Settings</h1>

      <div className="card p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Appearance
          </h2>
          <div className="flex items-center gap-2">
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
                  theme === value
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
                aria-pressed={theme === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            More settings coming in build step 11.
          </p>
        </div>
      </div>
    </div>
  )
}

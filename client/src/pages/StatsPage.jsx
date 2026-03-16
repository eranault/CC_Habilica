import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { statsApi } from '../api/stats'

// ---------------------------------------------------------------------------
// Heatmap helpers
// ---------------------------------------------------------------------------

/** Build a full 52-week grid (Mon→Sun, latest week rightmost). */
function buildHeatmapGrid(rawData) {
  const countByDate = {}
  rawData.forEach(({ logical_date, count }) => {
    countByDate[logical_date] = count
  })

  // Start from the Monday 52 weeks ago
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayDow = today.getDay() // 0=Sun
  const daysToLastMonday = (todayDow + 6) % 7
  const startDay = new Date(today)
  startDay.setDate(today.getDate() - daysToLastMonday - 51 * 7)

  const weeks = []
  let week = []
  const cur = new Date(startDay)

  while (cur <= today) {
    const iso = cur.toISOString().slice(0, 10)
    week.push({ date: iso, count: countByDate[iso] || 0 })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    cur.setDate(cur.getDate() + 1)
  }
  if (week.length) {
    while (week.length < 7) week.push({ date: null, count: 0 })
    weeks.push(week)
  }
  return weeks
}

function cellColor(count) {
  if (count === 0) return 'bg-slate-100 dark:bg-slate-800'
  if (count === 1) return 'bg-accent-200 dark:bg-accent-900'
  if (count === 2) return 'bg-accent-400 dark:bg-accent-700'
  if (count === 3) return 'bg-accent-500 dark:bg-accent-600'
  return 'bg-accent-700 dark:bg-accent-400'
}

function Heatmap({ data }) {
  const weeks = buildHeatmapGrid(data)
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-0.5 min-w-max">
        {/* Day labels column */}
        <div className="flex flex-col gap-0.5 pt-5">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="w-3 h-3 text-[9px] leading-3 text-slate-400 dark:text-slate-500 text-right pr-0.5">
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {/* Month label on first week of month */}
            <div className="h-4 text-[9px] leading-4 text-slate-400 dark:text-slate-500">
              {week[0]?.date && new Date(week[0].date + 'T12:00:00Z').getUTCDate() <= 7
                ? new Date(week[0].date + 'T12:00:00Z').toLocaleDateString('en', { month: 'short' })
                : ''}
            </div>
            {week.map((day, di) => (
              <div
                key={di}
                title={day.date ? `${day.date}: ${day.count} check-in${day.count !== 1 ? 's' : ''}` : ''}
                className={`w-3 h-3 rounded-[2px] ${day.date ? cellColor(day.count) : 'opacity-0'}`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1 mt-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1">Less</span>
        {[0, 1, 2, 3, 4].map(v => (
          <div key={v} className={`w-3 h-3 rounded-[2px] ${cellColor(v)}`} />
        ))}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">More</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary stat cards
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5 flex flex-col gap-1">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------
const RANGE_OPTIONS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' }
]

function TrendsChart({ habits }) {
  const [range, setRange] = useState('30d')
  const [habitId, setHabitId] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await statsApi.getTrends({ range, habitId: habitId || undefined })
      setData(res.data.data || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [range, habitId])

  useEffect(() => { load() }, [load])

  const formatted = data.map(d => ({
    date: new Date(d.date + 'T12:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    completed: d.completed
  }))

  return (
    <div className="card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Check-in trend</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={habitId}
            onChange={e => setHabitId(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1"
          >
            <option value="">All habits</option>
            {habits.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {RANGE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setRange(o.value)}
                className={`px-3 py-1 text-sm ${
                  range === o.value
                    ? 'bg-accent-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Check-ins"
              stroke="#6366f1"
              strokeWidth={2}
              fill="rgba(99,102,241,0.1)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-habit streak table
// ---------------------------------------------------------------------------
function HabitStreakTable({ habits }) {
  if (!habits.length) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Habit streaks</h2>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {habits.map(h => (
          <div key={h.id} className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{h.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
                h.difficulty === 'hard'
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : h.difficulty === 'medium'
                  ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
              }`}>
                {h.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm shrink-0">
              <div className="text-center">
                <p className="font-bold text-slate-900 dark:text-white">{h.current_streak}</p>
                <p className="text-[10px] text-slate-400">streak</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900 dark:text-white">{h.best_streak}</p>
                <p className="text-[10px] text-slate-400">best</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900 dark:text-white">{h.completionRate30d}%</p>
                <p className="text-[10px] text-slate-400">30-day</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function StatsPage() {
  const [summary, setSummary] = useState(null)
  const [heatmap, setHeatmap] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      statsApi.getSummary(),
      statsApi.getHeatmap()
    ])
      .then(([sumRes, heatRes]) => {
        setSummary(sumRes.data.data)
        setHeatmap(heatRes.data.data || [])
      })
      .catch(() => setError('Failed to load stats.'))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = async () => {
    try {
      const res = await statsApi.exportCsv()
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `streakr-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user will notice nothing downloaded
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-6 h-32 animate-pulse bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  const { today, week, habits = [] } = summary || {}

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Statistics</h1>
        <button
          onClick={handleExport}
          className="btn-ghost text-sm flex items-center gap-1.5"
          title="Download all check-ins as CSV"
        >
          <span aria-hidden="true">⬇</span> Export CSV
        </button>
      </div>

      {/* Today + week summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Today"
          value={`${today?.completed ?? 0}/${today?.total ?? 0}`}
          sub="habits done"
        />
        <StatCard
          label="Progress score"
          value={`${today?.progressScore ?? 0}%`}
          sub="weighted by difficulty"
        />
        <StatCard
          label="This week"
          value={`${week?.completionRate ?? 0}%`}
          sub={`${week?.completedCheckIns ?? 0} check-ins`}
        />
        <StatCard
          label="Best day"
          value={week?.bestDay ?? '—'}
          sub="this week"
        />
      </div>

      {/* Heatmap */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Activity — last 12 months</h2>
        <Heatmap data={heatmap} />
      </div>

      {/* Trends */}
      <TrendsChart habits={habits} />

      {/* Per-habit table */}
      <HabitStreakTable habits={habits} />
    </div>
  )
}

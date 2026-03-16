const { getDb } = require('../db')

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function recalculateStreak(habitId) {
  const db = getDb()

  const habit = db.prepare(`
    SELECT forgiveness_days, frequency_type, frequency_config_json
    FROM habits WHERE id = ?
  `).get(habitId)
  if (!habit) return

  const config = JSON.parse(habit.frequency_config_json || '{}')
  const forgivenessDays = habit.forgiveness_days ?? 1

  const checkInDates = db.prepare(
    'SELECT logical_date FROM checkins WHERE habit_id = ? ORDER BY logical_date ASC'
  ).all(habitId).map(r => r.logical_date)

  const { currentStreak, bestStreak } = computeStreaks(
    habit.frequency_type, config, checkInDates, forgivenessDays
  )

  const existing = db.prepare('SELECT best_streak FROM streaks WHERE habit_id = ?').get(habitId)
  const persistedBest = Math.max(bestStreak, existing?.best_streak ?? 0)

  db.prepare(`
    UPDATE streaks
    SET current_streak = ?, best_streak = ?, last_updated = datetime('now')
    WHERE habit_id = ?
  `).run(currentStreak, persistedBest, habitId)
}

function getCompletionRate(habitId, days = 30) {
  const db = getDb()

  const habit = db.prepare(
    'SELECT frequency_type, frequency_config_json FROM habits WHERE id = ?'
  ).get(habitId)
  if (!habit) return 0

  const config = JSON.parse(habit.frequency_config_json || '{}')
  const today = todayISO()
  const since = offsetDate(today, -days)

  const checkedIn = db.prepare(
    'SELECT logical_date FROM checkins WHERE habit_id = ? AND logical_date >= ? ORDER BY logical_date'
  ).all(habitId, since).map(r => r.logical_date)

  const scheduled = scheduledDatesInRange(habit.frequency_type, config, since, today)
  if (scheduled.length === 0) return 0

  const completed = scheduled.filter(d => checkedIn.includes(d)).length
  return Math.round((completed / scheduled.length) * 100)
}

// ---------------------------------------------------------------------------
// Streak computation — dispatches by frequency type
// Accepts optional `today` for testability (defaults to todayISO())
// ---------------------------------------------------------------------------

function computeStreaks(frequencyType, config, datesAsc, forgivenessDays, today = todayISO()) {
  if (datesAsc.length === 0) return { currentStreak: 0, bestStreak: 0 }

  switch (frequencyType) {
    case 'weekly_days':
      return computeWeeklyDaysStreaks(config, datesAsc, forgivenessDays, today)
    case 'weekly_count':
      return computeWeeklyCountStreaks(config, datesAsc, forgivenessDays, today)
    case 'monthly_count':
      return computeMonthlyCountStreaks(config, datesAsc, forgivenessDays, today)
    case 'daily':
    default:
      return computeDailyStreaks(datesAsc, forgivenessDays, today)
  }
}

// ---------------------------------------------------------------------------
// Daily
// ---------------------------------------------------------------------------

function computeDailyStreaks(datesAsc, forgivenessDays, today) {
  const deduped = [...new Set(datesAsc)].sort()

  let best = 0
  let run = 0
  let prev = null

  for (const d of deduped) {
    if (prev === null) {
      run = 1
    } else {
      const gap = dayDiff(d, prev)
      if (gap <= forgivenessDays + 1) {
        run++
      } else {
        best = Math.max(best, run)
        run = 1
      }
    }
    prev = d
  }
  best = Math.max(best, run)

  const lastDate = deduped[deduped.length - 1]
  const staleDays = dayDiff(today, lastDate)
  const current = staleDays <= forgivenessDays + 1 ? run : 0

  return { currentStreak: current, bestStreak: best }
}

// ---------------------------------------------------------------------------
// Weekly specific days (e.g. Mon/Wed/Fri)
// ---------------------------------------------------------------------------

function computeWeeklyDaysStreaks(config, datesAsc, forgivenessDays, today) {
  const scheduledDays = new Set(config.days ?? [1, 2, 3, 4, 5])
  const checkedSet = new Set(datesAsc)

  const firstDate = datesAsc[0]
  const allScheduled = []
  let cursor = new Date(firstDate + 'T12:00:00Z')
  const end = new Date(today + 'T12:00:00Z')

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10)
    if (scheduledDays.has(cursor.getUTCDay())) {
      allScheduled.push(iso)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return computeScheduledStreaks(allScheduled, checkedSet, forgivenessDays, today)
}

// ---------------------------------------------------------------------------
// Weekly count (e.g. 3×/week)
// ---------------------------------------------------------------------------

function computeWeeklyCountStreaks(config, datesAsc, forgivenessDays, today) {
  const target = config.count ?? 1
  const weekMap = buildWeekMap(datesAsc)
  const currentWeek = isoWeek(today)

  // Enumerate ALL weeks from first check-in to today (including empty weeks)
  const lastDate = datesAsc[datesAsc.length - 1]
  const endDate = lastDate > today ? lastDate : today
  const allWeeks = allWeeksBetween(datesAsc[0], endDate)

  return computePeriodStreaks(allWeeks, weekMap, target, forgivenessDays, currentWeek)
}

// ---------------------------------------------------------------------------
// Monthly count (e.g. 10×/month)
// ---------------------------------------------------------------------------

function computeMonthlyCountStreaks(config, datesAsc, forgivenessDays, today) {
  const target = config.count ?? 1
  const monthMap = buildMonthMap(datesAsc)
  const currentMonth = today.slice(0, 7)

  const lastDate = datesAsc[datesAsc.length - 1]
  const endDate = lastDate > today ? lastDate : today
  const allMonths = allMonthsBetween(datesAsc[0].slice(0, 7), endDate.slice(0, 7))

  return computePeriodStreaks(allMonths, monthMap, target, forgivenessDays, currentMonth)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Streak over a sorted list of scheduled dates (for weekly_days).
 * forgivenessDays = max consecutive misses allowed before break.
 */
function computeScheduledStreaks(scheduledAsc, completedSet, forgivenessDays, today) {
  let run = 0
  let best = 0
  let misses = 0

  for (const d of scheduledAsc) {
    if (completedSet.has(d)) {
      run++
      misses = 0
    } else {
      misses++
      if (misses > forgivenessDays) {
        best = Math.max(best, run)
        run = 0
        misses = 0
      }
    }
  }
  best = Math.max(best, run)

  const lastScheduled = scheduledAsc[scheduledAsc.length - 1]
  const currentStale = lastScheduled && dayDiff(today, lastScheduled) > forgivenessDays + 1
  const current = currentStale ? 0 : run

  return { currentStreak: current, bestStreak: best }
}

/**
 * Streak over an enumerated list of periods (weeks or months).
 * currentPeriod: the current in-progress period — excluded from miss-detection
 * since it may not be finished yet.
 */
function computePeriodStreaks(allPeriods, periodMap, target, forgivenessDays, currentPeriod) {
  // Exclude the current in-progress period — don't penalise for incomplete work
  const periodsToScore = allPeriods.filter(p => p !== currentPeriod)

  let run = 0
  let best = 0
  let missRun = 0

  for (const period of periodsToScore) {
    const count = periodMap[period] ?? 0
    if (count >= target) {
      run++
      missRun = 0
    } else {
      missRun++
      if (missRun > forgivenessDays) {
        best = Math.max(best, run)
        run = 0
        missRun = 0
      }
    }
  }
  best = Math.max(best, run)

  return { currentStreak: run, bestStreak: best }
}

// ---------------------------------------------------------------------------
// Period enumeration helpers
// ---------------------------------------------------------------------------

function allWeeksBetween(firstISO, lastISO) {
  const weeks = []
  const d = new Date(firstISO + 'T12:00:00Z')
  // Rewind to Monday of first week
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  const end = new Date(lastISO + 'T12:00:00Z')

  while (d <= end) {
    const wk = isoWeek(d.toISOString().slice(0, 10))
    if (!weeks.length || weeks[weeks.length - 1] !== wk) weeks.push(wk)
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return weeks
}

function allMonthsBetween(firstYYYYMM, lastYYYYMM) {
  const months = []
  let [y, m] = firstYYYYMM.split('-').map(Number)
  const [ey, em] = lastYYYYMM.split('-').map(Number)

  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function buildWeekMap(datesAsc) {
  const map = {}
  for (const d of datesAsc) {
    const key = isoWeek(d)
    map[key] = (map[key] || 0) + 1
  }
  return map
}

function buildMonthMap(datesAsc) {
  const map = {}
  for (const d of datesAsc) {
    const key = d.slice(0, 7)
    map[key] = (map[key] || 0) + 1
  }
  return map
}

function scheduledDatesInRange(frequencyType, config, fromISO, toISO) {
  const scheduled = []
  let cursor = new Date(fromISO + 'T12:00:00Z')
  const end = new Date(toISO + 'T12:00:00Z')

  if (frequencyType === 'weekly_days') {
    const days = new Set(config.days ?? [1, 2, 3, 4, 5])
    while (cursor <= end) {
      if (days.has(cursor.getUTCDay())) {
        scheduled.push(cursor.toISOString().slice(0, 10))
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  } else {
    // daily, weekly_count, monthly_count — all calendar days count
    while (cursor <= end) {
      scheduled.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return scheduled
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function dayDiff(laterISO, earlierISO) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(laterISO) - new Date(earlierISO)) / msPerDay)
}

function offsetDate(baseISO, n) {
  const d = new Date(baseISO + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function isoWeek(dateISO) {
  const d = new Date(dateISO + 'T12:00:00Z')
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const weekNum = Math.floor((d - startOfWeek1) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

module.exports = {
  recalculateStreak,
  getCompletionRate,
  computeStreaks,
  scheduledDatesInRange,
  dayDiff,
  offsetDate,
  isoWeek,
  allWeeksBetween,
  allMonthsBetween
}

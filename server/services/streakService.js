const { getDb } = require('../db')

/**
 * Recalculates and updates the streak for a given habit.
 * Philosophy: Missing a day dims the dot but never resets to zero if within forgiveness_days.
 */
function recalculateStreak(habitId) {
  const db = getDb()

  const habit = db.prepare(
    'SELECT forgiveness_days, frequency_type, frequency_config_json FROM habits WHERE id = ?'
  ).get(habitId)

  if (!habit) return

  // Get all check-in dates for this habit, newest first
  const checkIns = db.prepare(
    'SELECT logical_date FROM checkins WHERE habit_id = ? ORDER BY logical_date DESC'
  ).all(habitId).map(r => r.logical_date)

  if (checkIns.length === 0) {
    db.prepare('UPDATE streaks SET current_streak = 0, last_updated = datetime("now") WHERE habit_id = ?').run(habitId)
    return
  }

  const forgivenessDays = habit.forgiveness_days ?? 1
  const { currentStreak, bestStreak } = computeStreaks(checkIns, forgivenessDays)

  const existing = db.prepare('SELECT best_streak FROM streaks WHERE habit_id = ?').get(habitId)
  const newBest = Math.max(bestStreak, existing?.best_streak ?? 0)

  db.prepare(`
    UPDATE streaks
    SET current_streak = ?, best_streak = ?, last_updated = datetime('now')
    WHERE habit_id = ?
  `).run(currentStreak, newBest, habitId)
}

/**
 * Compute current and best streaks from an array of ISO date strings.
 * Gaps within forgiveness_days are allowed.
 */
function computeStreaks(datesDesc, forgivenessDays) {
  if (!datesDesc.length) return { currentStreak: 0, bestStreak: 0 }

  const today = todayISO()
  let currentStreak = 0
  let bestStreak = 0
  let streak = 0
  let prevDate = null

  for (const dateStr of datesDesc) {
    if (!prevDate) {
      // First date: check if it's recent enough to count as active
      const daysSince = dayDiff(today, dateStr)
      if (daysSince > forgivenessDays + 1) {
        // Streak is broken before we even start
        break
      }
      streak = 1
      prevDate = dateStr
      continue
    }

    const gap = dayDiff(prevDate, dateStr)
    if (gap <= forgivenessDays + 1) {
      // Within forgiveness — count it
      streak++
    } else {
      // Gap too large — streak broken
      bestStreak = Math.max(bestStreak, streak)
      streak = 1
    }
    prevDate = dateStr
  }

  bestStreak = Math.max(bestStreak, streak)
  currentStreak = streak

  return { currentStreak, bestStreak }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function dayDiff(laterISO, earlierISO) {
  const a = new Date(laterISO)
  const b = new Date(earlierISO)
  return Math.round((a - b) / (1000 * 60 * 60 * 24))
}

/**
 * Get rolling 30-day completion rate for a habit.
 */
function getCompletionRate(habitId, days = 30) {
  const db = getDb()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString().slice(0, 10)

  const count = db.prepare(
    'SELECT COUNT(*) as n FROM checkins WHERE habit_id = ? AND logical_date >= ?'
  ).get(habitId, sinceISO)

  return Math.round((count.n / days) * 100)
}

module.exports = { recalculateStreak, getCompletionRate }

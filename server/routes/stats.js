const express = require('express')
const { getDb } = require('../db')
const { getCompletionRate, offsetDate } = require('../services/streakService')

const router = express.Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns YYYY-MM-DD for "today" respecting the user's dayResetHour setting. */
function getLogicalToday(settings) {
  const dayResetHour = settings?.dayResetHour ?? 3
  const now = new Date()
  if (now.getHours() < dayResetHour) {
    now.setDate(now.getDate() - 1)
  }
  return now.toISOString().slice(0, 10)
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ---------------------------------------------------------------------------
// GET /api/stats/summary
// ---------------------------------------------------------------------------
router.get('/summary', (req, res, next) => {
  try {
    const db = getDb()

    const userRow = db.prepare('SELECT settings_json FROM users WHERE id = ?').get(req.user.id)
    const settings = JSON.parse(userRow?.settings_json || '{}')

    const today = getLogicalToday(settings)

    // This week: Mon → today
    const todayDate = new Date(today + 'T12:00:00Z')
    const dow = todayDate.getUTCDay() // 0=Sun
    const weekStart = new Date(todayDate)
    weekStart.setUTCDate(todayDate.getUTCDate() - ((dow + 6) % 7))
    const weekStartISO = weekStart.toISOString().slice(0, 10)

    const activeHabits = db.prepare(`
      SELECT h.id, h.name, h.difficulty, h.frequency_type, h.frequency_config_json,
             h.forgiveness_days, s.current_streak, s.best_streak
      FROM habits h
      LEFT JOIN streaks s ON s.habit_id = h.id
      WHERE h.user_id = ? AND h.is_archived = 0
      ORDER BY h.sort_order, h.created_at
    `).all(req.user.id)

    const todayCheckins = db.prepare(
      'SELECT habit_id FROM checkins WHERE user_id = ? AND logical_date = ?'
    ).all(req.user.id, today).map(r => r.habit_id)

    const todayCheckedSet = new Set(todayCheckins)

    // Per-habit completion rates (30-day rolling)
    const habitsWithRates = activeHabits.map(h => ({
      id: h.id,
      name: h.name,
      difficulty: h.difficulty,
      frequency_type: h.frequency_type,
      current_streak: h.current_streak ?? 0,
      best_streak: h.best_streak ?? 0,
      completedToday: todayCheckedSet.has(h.id),
      completionRate30d: getCompletionRate(h.id, 30)
    }))

    // Weekly check-ins
    const weekCheckins = db.prepare(`
      SELECT logical_date, habit_id
      FROM checkins
      WHERE user_id = ? AND logical_date >= ? AND logical_date <= ?
      ORDER BY logical_date
    `).all(req.user.id, weekStartISO, today)

    // Best day of week
    const dayCount = {}
    weekCheckins.forEach(c => {
      const d = DAY_NAMES[new Date(c.logical_date + 'T12:00:00Z').getUTCDay()]
      dayCount[d] = (dayCount[d] || 0) + 1
    })
    const bestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    const totalPossibleWeek = activeHabits.length * 7
    const uniqueWeekDays = new Set(weekCheckins.map(c => c.logical_date)).size

    // Weighted progress score (easy=1, medium=2, hard=3)
    const diffWeight = { easy: 1, medium: 2, hard: 3 }
    const totalWeight = activeHabits.reduce((s, h) => s + (diffWeight[h.difficulty] || 2), 0)
    const completedWeight = activeHabits
      .filter(h => todayCheckedSet.has(h.id))
      .reduce((s, h) => s + (diffWeight[h.difficulty] || 2), 0)
    const progressScore = totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0

    res.json({
      success: true,
      data: {
        today: {
          date: today,
          total: activeHabits.length,
          completed: todayCheckins.length,
          remaining: activeHabits.length - todayCheckins.length,
          completedIds: todayCheckins,
          progressScore
        },
        week: {
          startDate: weekStartISO,
          completedCheckIns: weekCheckins.length,
          totalPossible: totalPossibleWeek,
          completionRate: totalPossibleWeek > 0
            ? Math.round((weekCheckins.length / totalPossibleWeek) * 100)
            : 0,
          bestDay,
          activeDays: uniqueWeekDays
        },
        habits: habitsWithRates
      },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/stats/heatmap?habitId=   (full year)
// ---------------------------------------------------------------------------
router.get('/heatmap', (req, res, next) => {
  try {
    const db = getDb()
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)
    const sinceISO = since.toISOString().slice(0, 10)

    let query, params

    if (req.query.habitId) {
      const habitId = Number(req.query.habitId)
      if (!db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)) {
        return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
      }
      query = `
        SELECT logical_date, COUNT(*) as count
        FROM checkins WHERE habit_id = ? AND logical_date >= ?
        GROUP BY logical_date ORDER BY logical_date
      `
      params = [habitId, sinceISO]
    } else {
      query = `
        SELECT logical_date, COUNT(*) as count
        FROM checkins WHERE user_id = ? AND logical_date >= ?
        GROUP BY logical_date ORDER BY logical_date
      `
      params = [req.user.id, sinceISO]
    }

    const data = db.prepare(query).all(...params)
    res.json({ success: true, data, error: null })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/stats/trends?habitId=&range=7d|30d|90d|all
// ---------------------------------------------------------------------------
router.get('/trends', (req, res, next) => {
  try {
    const db = getDb()
    const { range = '30d', habitId } = req.query

    if (!['7d', '30d', '90d', 'all'].includes(range)) {
      return res.status(400).json({ success: false, data: null, error: 'range must be 7d, 30d, 90d, or all.' })
    }

    const days = range === '7d' ? 7 : range === '90d' ? 90 : range === 'all' ? 730 : 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString().slice(0, 10)

    let query, params

    if (habitId) {
      const hid = Number(habitId)
      if (!db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(hid, req.user.id)) {
        return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
      }
      query = `
        SELECT logical_date as date, COUNT(*) as completed
        FROM checkins WHERE habit_id = ? AND logical_date >= ?
        GROUP BY logical_date ORDER BY logical_date
      `
      params = [hid, sinceISO]
    } else {
      query = `
        SELECT logical_date as date, COUNT(*) as completed
        FROM checkins WHERE user_id = ? AND logical_date >= ?
        GROUP BY logical_date ORDER BY logical_date
      `
      params = [req.user.id, sinceISO]
    }

    const data = db.prepare(query).all(...params)
    res.json({ success: true, data, error: null })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/stats/correlation?habitA=&habitB=&range=30d
// ---------------------------------------------------------------------------
router.get('/correlation', (req, res, next) => {
  try {
    const db = getDb()
    const { habitA, habitB, range = '30d' } = req.query

    if (!habitA || !habitB) {
      return res.status(400).json({ success: false, data: null, error: 'habitA and habitB are required.' })
    }

    const idA = Number(habitA)
    const idB = Number(habitB)

    for (const [id, label] of [[idA, 'habitA'], [idB, 'habitB']]) {
      if (!db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(id, req.user.id)) {
        return res.status(404).json({ success: false, data: null, error: `${label} not found.` })
      }
    }

    const days = range === '7d' ? 7 : range === '90d' ? 90 : range === 'all' ? 730 : 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString().slice(0, 10)

    const rowsA = db.prepare(
      'SELECT logical_date FROM checkins WHERE habit_id = ? AND logical_date >= ? ORDER BY logical_date'
    ).all(idA, sinceISO).map(r => r.logical_date)

    const rowsB = db.prepare(
      'SELECT logical_date FROM checkins WHERE habit_id = ? AND logical_date >= ? ORDER BY logical_date'
    ).all(idB, sinceISO).map(r => r.logical_date)

    const setA = new Set(rowsA)
    const setB = new Set(rowsB)
    const allDates = [...new Set([...rowsA, ...rowsB])].sort()

    const series = allDates.map(date => ({
      date,
      a: setA.has(date) ? 1 : 0,
      b: setB.has(date) ? 1 : 0
    }))

    // Simple co-occurrence rate: days both were done / days either was done
    const both = allDates.filter(d => setA.has(d) && setB.has(d)).length
    const either = allDates.length
    const coOccurrence = either > 0 ? Math.round((both / either) * 100) : 0

    res.json({
      success: true,
      data: { series, coOccurrence, daysA: rowsA.length, daysB: rowsB.length },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/stats/export  (CSV download)
// ---------------------------------------------------------------------------
router.get('/export', (req, res, next) => {
  try {
    const db = getDb()

    const checkins = db.prepare(`
      SELECT h.name as habit_name, h.difficulty, h.frequency_type,
             c.logical_date, c.note, c.checked_at
      FROM checkins c
      JOIN habits h ON h.id = c.habit_id
      WHERE c.user_id = ?
      ORDER BY c.logical_date DESC, h.name ASC
    `).all(req.user.id)

    const header = 'habit_name,difficulty,frequency_type,date,note,checked_at\n'
    const rows = checkins.map(r => [
      `"${r.habit_name.replace(/"/g, '""')}"`,
      r.difficulty,
      r.frequency_type,
      r.logical_date,
      `"${(r.note || '').replace(/"/g, '""')}"`,
      r.checked_at
    ].join(',')).join('\n')

    const filename = `streakr-export-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(header + rows)
  } catch (err) {
    next(err)
  }
})

module.exports = router

const express = require('express')
const { getDb } = require('../db')
const { getCompletionRate } = require('../services/streakService')

const router = express.Router()

// GET /api/stats/summary
router.get('/summary', (req, res, next) => {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)

    // This week's range (Mon–Sun)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    const weekStartISO = weekStart.toISOString().slice(0, 10)

    const activeHabits = db.prepare(
      'SELECT id, name, difficulty FROM habits WHERE user_id = ? AND is_archived = 0'
    ).all(req.user.id)

    const todayCheckins = db.prepare(
      'SELECT habit_id FROM checkins WHERE user_id = ? AND logical_date = ?'
    ).all(req.user.id, today).map(r => r.habit_id)

    // Weekly stats
    const weekCheckins = db.prepare(`
      SELECT logical_date, habit_id
      FROM checkins
      WHERE user_id = ? AND logical_date >= ?
      ORDER BY logical_date
    `).all(req.user.id, weekStartISO)

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayCount = {}
    weekCheckins.forEach(c => {
      const d = dayNames[new Date(c.logical_date + 'T12:00:00').getDay()]
      dayCount[d] = (dayCount[d] || 0) + 1
    })
    const bestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    const uniqueWeekDays = new Set(weekCheckins.map(c => c.logical_date)).size
    const totalWeekHabits = activeHabits.length * 7 // max possible

    res.json({
      success: true,
      data: {
        today: {
          total: activeHabits.length,
          completed: todayCheckins.length,
          remaining: activeHabits.length - todayCheckins.length,
          completedIds: todayCheckins
        },
        week: {
          completedCheckIns: weekCheckins.length,
          totalPossible: totalWeekHabits,
          completionRate: totalWeekHabits > 0
            ? Math.round((weekCheckins.length / totalWeekHabits) * 100)
            : 0,
          bestDay,
          activeDays: uniqueWeekDays
        }
      },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/stats/heatmap?habitId= (full year data)
router.get('/heatmap', (req, res, next) => {
  try {
    const db = getDb()
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)
    const sinceISO = since.toISOString().slice(0, 10)

    let query, params

    if (req.query.habitId) {
      const habitId = Number(req.query.habitId)
      // Verify ownership
      const habit = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)
      if (!habit) {
        return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
      }
      query = 'SELECT logical_date, COUNT(*) as count FROM checkins WHERE habit_id = ? AND logical_date >= ? GROUP BY logical_date'
      params = [habitId, sinceISO]
    } else {
      query = 'SELECT logical_date, COUNT(*) as count FROM checkins WHERE user_id = ? AND logical_date >= ? GROUP BY logical_date'
      params = [req.user.id, sinceISO]
    }

    const data = db.prepare(query).all(...params)
    res.json({ success: true, data, error: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/stats/trends?habitId=&range=7d|30d|90d|all
router.get('/trends', (req, res, next) => {
  try {
    const db = getDb()
    const { range = '30d', habitId } = req.query
    const days = range === '7d' ? 7 : range === '90d' ? 90 : range === 'all' ? 365 : 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString().slice(0, 10)

    let query, params

    if (habitId) {
      const habit = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(Number(habitId), req.user.id)
      if (!habit) {
        return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
      }
      query = 'SELECT logical_date as date, COUNT(*) as completed FROM checkins WHERE habit_id = ? AND logical_date >= ? GROUP BY logical_date ORDER BY logical_date'
      params = [Number(habitId), sinceISO]
    } else {
      query = 'SELECT logical_date as date, COUNT(*) as completed FROM checkins WHERE user_id = ? AND logical_date >= ? GROUP BY logical_date ORDER BY logical_date'
      params = [req.user.id, sinceISO]
    }

    const data = db.prepare(query).all(...params)
    res.json({ success: true, data, error: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/stats/export (CSV download)
router.get('/export', (req, res, next) => {
  try {
    const db = getDb()

    const checkins = db.prepare(`
      SELECT h.name as habit_name, c.logical_date, c.note, c.checked_at
      FROM checkins c
      JOIN habits h ON h.id = c.habit_id
      WHERE c.user_id = ?
      ORDER BY c.logical_date DESC, h.name ASC
    `).all(req.user.id)

    const header = 'habit_name,date,note,checked_at\n'
    const rows = checkins.map(r =>
      `"${r.habit_name.replace(/"/g, '""')}",${r.logical_date},"${(r.note || '').replace(/"/g, '""')}",${r.checked_at}`
    ).join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="streakr-export-${new Date().toISOString().slice(0,10)}.csv"`)
    res.send(header + rows)
  } catch (err) {
    next(err)
  }
})

module.exports = router

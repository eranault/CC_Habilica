const express = require('express')
const { z } = require('zod')
const { getDb } = require('../db')
const { validate } = require('../middleware/validate')
const { recalculateStreak } = require('../services/streakService')

const router = express.Router()

const checkinSchema = z.object({
  habit_id: z.number().int().positive(),
  logical_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.'),
  note: z.string().max(280, 'Note must be 280 characters or fewer.').optional().default('')
})

// POST /api/checkins
router.post('/', validate(checkinSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { habit_id, logical_date, note } = req.body

    // Verify this habit belongs to the user
    const habit = db.prepare(
      'SELECT id FROM habits WHERE id = ? AND user_id = ? AND is_archived = 0'
    ).get(habit_id, req.user.id)

    if (!habit) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    // Upsert: replace if same habit+date already exists
    const result = db.prepare(`
      INSERT INTO checkins (habit_id, user_id, logical_date, note)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(habit_id, logical_date) DO UPDATE SET note = excluded.note, checked_at = datetime('now')
    `).run(habit_id, req.user.id, logical_date, note)

    const checkin = db.prepare('SELECT * FROM checkins WHERE habit_id = ? AND logical_date = ?')
      .get(habit_id, logical_date)

    // Recalculate streak asynchronously (sync here for simplicity)
    try { recalculateStreak(habit_id) } catch { /* non-fatal */ }

    res.status(201).json({ success: true, data: checkin, error: null })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/checkins/:id (undo — only within 5 minutes)
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb()
    const checkinId = Number(req.params.id)

    const checkin = db.prepare(
      'SELECT * FROM checkins WHERE id = ? AND user_id = ?'
    ).get(checkinId, req.user.id)

    if (!checkin) {
      return res.status(404).json({ success: false, data: null, error: 'Check-in not found.' })
    }

    const ageMs = Date.now() - new Date(checkin.created_at + 'Z').getTime()
    if (ageMs > 5 * 60 * 1000) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Check-ins can only be undone within 5 minutes.'
      })
    }

    db.prepare('DELETE FROM checkins WHERE id = ?').run(checkinId)
    try { recalculateStreak(checkin.habit_id) } catch { /* non-fatal */ }

    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/checkins?habitId=&from=&to=
router.get('/', (req, res, next) => {
  try {
    const db = getDb()
    const { habitId, from, to } = req.query

    let query = 'SELECT * FROM checkins WHERE user_id = ?'
    const params = [req.user.id]

    if (habitId) {
      query += ' AND habit_id = ?'
      params.push(Number(habitId))
    }
    if (from) {
      query += ' AND logical_date >= ?'
      params.push(from)
    }
    if (to) {
      query += ' AND logical_date <= ?'
      params.push(to)
    }

    query += ' ORDER BY logical_date DESC'

    const checkins = db.prepare(query).all(...params)
    res.json({ success: true, data: checkins, error: null })
  } catch (err) {
    next(err)
  }
})

module.exports = router

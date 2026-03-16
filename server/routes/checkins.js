const express = require('express')
const { z } = require('zod')
const { getDb } = require('../db')
const { validate } = require('../middleware/validate')
const { recalculateStreak } = require('../services/streakService')

const router = express.Router()

const checkinSchema = z.object({
  habit_id: z.number().int().positive('habit_id must be a positive integer.'),
  logical_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'logical_date must be YYYY-MM-DD.'),
  note: z.string().max(280, 'Note must be 280 characters or fewer.').optional().default('')
})

// ---------------------------------------------------------------------------
// POST /api/checkins
// ---------------------------------------------------------------------------
router.post('/', validate(checkinSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { habit_id, logical_date, note } = req.body

    // Validate logical_date is not in the future (allow today + 1 day for timezone edge cases)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowISO = tomorrow.toISOString().slice(0, 10)
    if (logical_date > tomorrowISO) {
      return res.status(400).json({
        success: false, data: null,
        error: 'Cannot log a check-in for a future date.'
      })
    }

    const habit = db.prepare(
      'SELECT id FROM habits WHERE id = ? AND user_id = ? AND is_archived = 0'
    ).get(habit_id, req.user.id)

    if (!habit) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    // Upsert: same habit + same logical_date → update note & timestamp
    db.prepare(`
      INSERT INTO checkins (habit_id, user_id, logical_date, note)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(habit_id, logical_date)
      DO UPDATE SET note = excluded.note, checked_at = datetime('now')
    `).run(habit_id, req.user.id, logical_date, note)

    const checkin = db.prepare(
      'SELECT * FROM checkins WHERE habit_id = ? AND logical_date = ?'
    ).get(habit_id, logical_date)

    try { recalculateStreak(habit_id) } catch { /* non-fatal — streak update best-effort */ }

    res.status(201).json({ success: true, data: checkin, error: null })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/checkins/:id  (undo — only within 5 minutes)
// ---------------------------------------------------------------------------
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

    // SQLite stores UTC without 'Z'; parse accordingly
    const createdAtMs = new Date(checkin.created_at.endsWith('Z')
      ? checkin.created_at
      : checkin.created_at + 'Z'
    ).getTime()

    const ageMs = Date.now() - createdAtMs
    if (ageMs > 5 * 60 * 1000) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Check-ins can only be undone within 5 minutes of logging.'
      })
    }

    db.prepare('DELETE FROM checkins WHERE id = ?').run(checkinId)
    try { recalculateStreak(checkin.habit_id) } catch { /* non-fatal */ }

    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/checkins?habitId=&from=&to=
// ---------------------------------------------------------------------------
router.get('/', (req, res, next) => {
  try {
    const db = getDb()
    const { habitId, from, to } = req.query

    // Validate query params
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({ success: false, data: null, error: 'from must be YYYY-MM-DD.' })
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, data: null, error: 'to must be YYYY-MM-DD.' })
    }

    let query = 'SELECT * FROM checkins WHERE user_id = ?'
    const params = [req.user.id]

    if (habitId) {
      const hid = Number(habitId)
      if (isNaN(hid)) {
        return res.status(400).json({ success: false, data: null, error: 'habitId must be a number.' })
      }
      // Verify ownership
      const habit = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(hid, req.user.id)
      if (!habit) {
        return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
      }
      query += ' AND habit_id = ?'
      params.push(hid)
    }
    if (from) { query += ' AND logical_date >= ?'; params.push(from) }
    if (to)   { query += ' AND logical_date <= ?'; params.push(to) }

    query += ' ORDER BY logical_date DESC, checked_at DESC'

    const checkins = db.prepare(query).all(...params)
    res.json({ success: true, data: checkins, error: null })
  } catch (err) {
    next(err)
  }
})

module.exports = router

const express = require('express')
const { z } = require('zod')
const { getDb } = require('../db')
const { validate } = require('../middleware/validate')

const router = express.Router()

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string()
    })
  })
})

const notificationSchema = z.object({
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM.').optional(),
  is_active: z.boolean().optional().default(true)
})

// POST /api/notifications/subscribe
router.post('/subscribe', validate(subscribeSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { subscription } = req.body

    // Upsert push subscription at user level (no specific habit)
    const existing = db.prepare(
      'SELECT id FROM notifications WHERE user_id = ? AND habit_id IS NULL'
    ).get(req.user.id)

    if (existing) {
      db.prepare(
        'UPDATE notifications SET push_subscription_json = ? WHERE id = ?'
      ).run(JSON.stringify(subscription), existing.id)
    } else {
      db.prepare(
        'INSERT INTO notifications (user_id, push_subscription_json) VALUES (?, ?)'
      ).run(req.user.id, JSON.stringify(subscription))
    }

    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// PUT /api/notifications/:habitId
router.put('/:habitId', validate(notificationSchema), (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.habitId)

    // Verify habit ownership
    const habit = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)
    if (!habit) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    const { scheduled_time, is_active } = req.body
    const existing = db.prepare(
      'SELECT id FROM notifications WHERE habit_id = ? AND user_id = ?'
    ).get(habitId, req.user.id)

    if (existing) {
      db.prepare(
        'UPDATE notifications SET scheduled_time = ?, is_active = ? WHERE id = ?'
      ).run(scheduled_time ?? null, is_active ? 1 : 0, existing.id)
    } else {
      db.prepare(
        'INSERT INTO notifications (user_id, habit_id, scheduled_time, is_active) VALUES (?, ?, ?, ?)'
      ).run(req.user.id, habitId, scheduled_time ?? null, is_active ? 1 : 0)
    }

    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/notifications/:habitId
router.delete('/:habitId', (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.habitId)

    db.prepare('DELETE FROM notifications WHERE habit_id = ? AND user_id = ?').run(habitId, req.user.id)
    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

module.exports = router

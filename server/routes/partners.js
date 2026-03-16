const express = require('express')
const { z } = require('zod')
const { getDb } = require('../db')
const { validate } = require('../middleware/validate')

const router = express.Router()

const inviteSchema = z.object({
  email: z.string().email('Invalid email address.'),
  shareHabitNames: z.boolean().optional().default(false)
})

// POST /api/partners/invite
router.post('/invite', validate(inviteSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { email, shareHabitNames } = req.body

    if (email.toLowerCase() === req.user.email.toLowerCase()) {
      return res.status(400).json({ success: false, data: null, error: 'You cannot invite yourself.' })
    }

    // Check partner limit (max 3 active)
    const count = db.prepare(
      "SELECT COUNT(*) as n FROM partners WHERE user_id = ? AND status != 'declined'"
    ).get(req.user.id)

    if (count.n >= 3) {
      return res.status(400).json({ success: false, data: null, error: 'You can have at most 3 accountability partners.' })
    }

    const partner = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email)
    if (!partner) {
      return res.status(404).json({ success: false, data: null, error: 'No user found with that email.' })
    }

    const existing = db.prepare(
      'SELECT id FROM partners WHERE user_id = ? AND partner_user_id = ?'
    ).get(req.user.id, partner.id)

    if (existing) {
      return res.status(409).json({ success: false, data: null, error: 'Partner relationship already exists.' })
    }

    db.prepare(
      'INSERT INTO partners (user_id, partner_user_id, share_habit_names) VALUES (?, ?, ?)'
    ).run(req.user.id, partner.id, shareHabitNames ? 1 : 0)

    res.status(201).json({ success: true, data: { partnerEmail: email }, error: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/partners
router.get('/', (req, res, next) => {
  try {
    const db = getDb()
    const partners = db.prepare(`
      SELECT p.id, p.status, p.share_habit_names, p.created_at,
             u.email as partner_email
      FROM partners p
      JOIN users u ON u.id = p.partner_user_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user.id)

    res.json({ success: true, data: partners, error: null })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/partners/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb()
    const partnerId = Number(req.params.id)

    const partner = db.prepare(
      'SELECT id FROM partners WHERE id = ? AND user_id = ?'
    ).get(partnerId, req.user.id)

    if (!partner) {
      return res.status(404).json({ success: false, data: null, error: 'Partner not found.' })
    }

    db.prepare('DELETE FROM partners WHERE id = ?').run(partnerId)
    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/partners/:id/summary (what partners can see)
router.get('/:id/summary', (req, res, next) => {
  try {
    const db = getDb()
    const partnerId = Number(req.params.id)

    // The requester must be a partner of the target user
    const relationship = db.prepare(`
      SELECT p.share_habit_names, p.user_id as owner_id
      FROM partners p
      WHERE p.partner_user_id = ? AND p.user_id = ? AND p.status = 'accepted'
    `).get(req.user.id, partnerId)

    if (!relationship) {
      return res.status(403).json({ success: false, data: null, error: 'Not authorized to view this summary.' })
    }

    const { owner_id, share_habit_names } = relationship
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 7)

    const checkins = db.prepare(
      'SELECT COUNT(*) as n FROM checkins WHERE user_id = ? AND logical_date >= ?'
    ).get(owner_id, weekStart.toISOString().slice(0, 10))

    const total = db.prepare(
      'SELECT COUNT(*) as n FROM habits WHERE user_id = ? AND is_archived = 0'
    ).get(owner_id)

    const habitNames = share_habit_names
      ? db.prepare('SELECT name FROM habits WHERE user_id = ? AND is_archived = 0 AND is_private = 0').all(owner_id).map(h => h.name)
      : []

    res.json({
      success: true,
      data: {
        weeklyCompletions: checkins.n,
        totalHabits: total.n,
        completionRate: total.n > 0 ? Math.round((checkins.n / (total.n * 7)) * 100) : 0,
        habitNames
      },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

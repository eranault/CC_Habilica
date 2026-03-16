const express = require('express')
const { z } = require('zod')
const { getDb } = require('../db')
const { validate } = require('../middleware/validate')
const { createError } = require('../middleware/errorHandler')

const router = express.Router()

const habitSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  description: z.string().max(500).optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color hex.').optional().default('#14b8a6'),
  icon: z.string().max(10).optional().default('✅'),
  frequency_type: z.enum(['daily', 'weekly_days', 'weekly_count', 'monthly_count']).optional().default('daily'),
  frequency_config_json: z.record(z.unknown()).optional().default({}),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  is_private: z.boolean().optional().default(false),
  forgiveness_days: z.number().int().min(0).max(3).optional().default(1)
})

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive())
})

// GET /api/habits
router.get('/', (req, res, next) => {
  try {
    const db = getDb()
    const includeArchived = req.query.includeArchived === 'true'

    const habits = db.prepare(`
      SELECT h.*, s.current_streak, s.best_streak
      FROM habits h
      LEFT JOIN streaks s ON s.habit_id = h.id
      WHERE h.user_id = ?
      ${includeArchived ? '' : 'AND h.is_archived = 0'}
      ORDER BY h.sort_order ASC, h.created_at ASC
    `).all(req.user.id)

    const parsed = habits.map(h => ({
      ...h,
      frequency_config_json: JSON.parse(h.frequency_config_json || '{}'),
      is_private: Boolean(h.is_private),
      is_archived: Boolean(h.is_archived)
    }))

    res.json({ success: true, data: parsed, error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/habits
router.post('/', validate(habitSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { name, description, color, icon, frequency_type, frequency_config_json, difficulty, is_private, forgiveness_days } = req.body

    // Get next sort order
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as max FROM habits WHERE user_id = ?'
    ).get(req.user.id)
    const sortOrder = (maxOrder?.max ?? -1) + 1

    const result = db.prepare(`
      INSERT INTO habits (user_id, name, description, color, icon, frequency_type, frequency_config_json, difficulty, is_private, forgiveness_days, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, name, description, color, icon,
      frequency_type, JSON.stringify(frequency_config_json),
      difficulty, is_private ? 1 : 0, forgiveness_days, sortOrder
    )

    // Initialize streak record
    db.prepare('INSERT INTO streaks (habit_id) VALUES (?)').run(result.lastInsertRowid)

    const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({
      success: true,
      data: {
        ...habit,
        frequency_config_json: JSON.parse(habit.frequency_config_json || '{}'),
        is_private: Boolean(habit.is_private),
        is_archived: Boolean(habit.is_archived),
        current_streak: 0,
        best_streak: 0
      },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/habits/:id
router.put('/:id', validate(habitSchema.partial()), (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.id)

    const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)
    if (!habit) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    const updates = { ...req.body }
    if (updates.frequency_config_json) {
      updates.frequency_config_json = JSON.stringify(updates.frequency_config_json)
    }
    if (typeof updates.is_private === 'boolean') {
      updates.is_private = updates.is_private ? 1 : 0
    }

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)

    db.prepare(`UPDATE habits SET ${fields} WHERE id = ? AND user_id = ?`)
      .run(...values, habitId, req.user.id)

    const updated = db.prepare(`
      SELECT h.*, s.current_streak, s.best_streak
      FROM habits h LEFT JOIN streaks s ON s.habit_id = h.id
      WHERE h.id = ?
    `).get(habitId)

    res.json({
      success: true,
      data: {
        ...updated,
        frequency_config_json: JSON.parse(updated.frequency_config_json || '{}'),
        is_private: Boolean(updated.is_private),
        is_archived: Boolean(updated.is_archived)
      },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/habits/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.id)

    const habit = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)
    if (!habit) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    db.prepare('DELETE FROM habits WHERE id = ?').run(habitId)
    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/habits/reorder
router.patch('/reorder', validate(reorderSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { orderedIds } = req.body

    const updateOrder = db.prepare(
      'UPDATE habits SET sort_order = ? WHERE id = ? AND user_id = ?'
    )
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => updateOrder.run(index, id, req.user.id))
    })
    transaction(orderedIds)

    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/habits/:id/archive
router.patch('/:id/archive', (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.id)

    const habit = db.prepare('SELECT id, is_archived FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)
    if (!habit) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    const newState = habit.is_archived ? 0 : 1
    db.prepare('UPDATE habits SET is_archived = ? WHERE id = ?').run(newState, habitId)

    res.json({
      success: true,
      data: { id: habitId, is_archived: Boolean(newState) },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

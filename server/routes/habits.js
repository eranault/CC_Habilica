const express = require('express')
const { z } = require('zod')
const { getDb } = require('../db')
const { validate } = require('../middleware/validate')

const router = express.Router()

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const habitSchema = z.object({
  name: z.string({ required_error: 'Name is required.' }).min(1, 'Name is required.').max(100, 'Name must be 100 characters or fewer.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex code.').optional().default('#14b8a6'),
  icon: z.string().max(10, 'Icon must be 10 characters or fewer.').optional().default('✅'),
  frequency_type: z.enum(['daily', 'weekly_days', 'weekly_count', 'monthly_count']).optional().default('daily'),
  frequency_config_json: z.record(z.unknown()).optional().default({}),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  is_private: z.boolean().optional().default(false),
  forgiveness_days: z.number().int().min(0).max(3).optional().default(1),
  motivational_note: z.string().max(280, 'Motivational note must be 280 characters or fewer.').optional().default('')
})

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1, 'At least one ID required.')
})

const bulkEditSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  updates: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    frequency_type: z.enum(['daily', 'weekly_days', 'weekly_count', 'monthly_count']).optional(),
    frequency_config_json: z.record(z.unknown()).optional(),
    is_archived: z.boolean().optional(),
    forgiveness_days: z.number().int().min(0).max(3).optional()
  }).refine(u => Object.keys(u).length > 0, 'At least one field to update is required.')
})

// Fields that are safe to update via PUT (prevents over-posting id/user_id/created_at)
const UPDATABLE_FIELDS = new Set([
  'name', 'description', 'color', 'icon', 'frequency_type',
  'frequency_config_json', 'difficulty', 'is_private',
  'forgiveness_days', 'motivational_note'
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeHabit(h) {
  return {
    ...h,
    frequency_config_json: typeof h.frequency_config_json === 'string'
      ? JSON.parse(h.frequency_config_json || '{}')
      : h.frequency_config_json,
    is_private: Boolean(h.is_private),
    is_archived: Boolean(h.is_archived)
  }
}

function fetchHabitWithStreak(db, habitId) {
  return db.prepare(`
    SELECT h.*, s.current_streak, s.best_streak
    FROM habits h
    LEFT JOIN streaks s ON s.habit_id = h.id
    WHERE h.id = ?
  `).get(habitId)
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

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

    res.json({ success: true, data: habits.map(serializeHabit), error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/habits
router.post('/', validate(habitSchema), (req, res, next) => {
  try {
    const db = getDb()
    const {
      name, description, color, icon,
      frequency_type, frequency_config_json,
      difficulty, is_private, forgiveness_days, motivational_note
    } = req.body

    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as max FROM habits WHERE user_id = ?'
    ).get(req.user.id)
    const sortOrder = (maxOrder?.max ?? -1) + 1

    const result = db.prepare(`
      INSERT INTO habits
        (user_id, name, description, color, icon, frequency_type, frequency_config_json,
         difficulty, is_private, forgiveness_days, motivational_note, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, name, description, color, icon,
      frequency_type, JSON.stringify(frequency_config_json),
      difficulty, is_private ? 1 : 0, forgiveness_days, motivational_note, sortOrder
    )

    db.prepare('INSERT INTO streaks (habit_id) VALUES (?)').run(result.lastInsertRowid)

    const habit = fetchHabitWithStreak(db, result.lastInsertRowid)
    res.status(201).json({
      success: true,
      data: { ...serializeHabit(habit), current_streak: 0, best_streak: 0 },
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

    if (!db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    // Whitelist: only update known safe fields
    const updates = {}
    for (const [key, val] of Object.entries(req.body)) {
      if (!UPDATABLE_FIELDS.has(key)) continue
      if (key === 'frequency_config_json') {
        updates[key] = JSON.stringify(val)
      } else if (key === 'is_private') {
        updates[key] = val ? 1 : 0
      } else {
        updates[key] = val
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, data: null, error: 'No valid fields to update.' })
    }

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE habits SET ${fields} WHERE id = ? AND user_id = ?`)
      .run(...Object.values(updates), habitId, req.user.id)

    const updated = fetchHabitWithStreak(db, habitId)
    res.json({ success: true, data: serializeHabit(updated), error: null })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/habits/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.id)

    if (!db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.user.id)) {
      return res.status(404).json({ success: false, data: null, error: 'Habit not found.' })
    }

    db.prepare('DELETE FROM habits WHERE id = ?').run(habitId)
    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/habits/reorder  — must come BEFORE /:id to avoid route conflict
router.patch('/reorder', validate(reorderSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { orderedIds } = req.body

    const updateOrder = db.prepare(
      'UPDATE habits SET sort_order = ? WHERE id = ? AND user_id = ?'
    )
    db.transaction((ids) => {
      ids.forEach((id, index) => updateOrder.run(index, id, req.user.id))
    })(orderedIds)

    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/habits/bulk  — bulk edit multiple habits at once
router.patch('/bulk', validate(bulkEditSchema), (req, res, next) => {
  try {
    const db = getDb()
    const { ids, updates } = req.body

    // Verify all IDs belong to this user
    const placeholders = ids.map(() => '?').join(',')
    const owned = db.prepare(
      `SELECT id FROM habits WHERE id IN (${placeholders}) AND user_id = ?`
    ).all(...ids, req.user.id)

    if (owned.length !== ids.length) {
      return res.status(404).json({ success: false, data: null, error: 'One or more habits not found.' })
    }

    // Build update fields
    const dbUpdates = {}
    for (const [key, val] of Object.entries(updates)) {
      if (key === 'frequency_config_json') {
        dbUpdates[key] = JSON.stringify(val)
      } else if (key === 'is_archived' || key === 'is_private') {
        dbUpdates[key] = val ? 1 : 0
      } else {
        dbUpdates[key] = val
      }
    }

    const fields = Object.keys(dbUpdates).map(k => `${k} = ?`).join(', ')
    const stmt = db.prepare(`UPDATE habits SET ${fields} WHERE id = ? AND user_id = ?`)

    db.transaction((habitIds) => {
      for (const id of habitIds) {
        stmt.run(...Object.values(dbUpdates), id, req.user.id)
      }
    })(ids)

    res.json({ success: true, data: { updated: ids.length }, error: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/habits/:id/archive  — toggle archive state
router.patch('/:id/archive', (req, res, next) => {
  try {
    const db = getDb()
    const habitId = Number(req.params.id)

    const habit = db.prepare(
      'SELECT id, is_archived FROM habits WHERE id = ? AND user_id = ?'
    ).get(habitId, req.user.id)

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

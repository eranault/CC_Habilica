const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { z } = require('zod')
const { getDb } = require('../db')
const { generateToken, authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { createError } = require('../middleware/errorHandler')

const router = express.Router()

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
}

const registerSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.')
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional().default(false)
})

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const db = getDb()

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      return res.status(409).json({ success: false, data: null, error: 'An account with this email already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const result = db.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).run(email, passwordHash)

    const user = { id: result.lastInsertRowid, email }
    const token = generateToken(user, false)

    res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 24 * 60 * 60 * 1000 })
    res.status(201).json({ success: true, data: { id: user.id, email: user.email }, error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body
    const db = getDb()

    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email)
    if (!user) {
      // Constant-time comparison avoidance
      await bcrypt.compare(password, '$2b$12$invalidhashfortimingatk')
      return res.status(401).json({ success: false, data: null, error: 'Invalid email or password.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ success: false, data: null, error: 'Invalid email or password.' })
    }

    const token = generateToken(user, rememberMe)
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000

    res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge })
    res.json({ success: true, data: { id: user.id, email: user.email }, error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...COOKIE_OPTIONS })
  res.json({ success: true, data: null, error: null })
})

// GET /api/auth/me (used to verify session on app load)
router.get('/me', authenticate, (req, res) => {
  const db = getDb()
  const user = db.prepare('SELECT id, email, settings_json, created_at FROM users WHERE id = ?').get(req.user.id)
  if (!user) {
    return res.status(404).json({ success: false, data: null, error: 'User not found.' })
  }
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      settings: JSON.parse(user.settings_json || '{}'),
      createdAt: user.created_at
    },
    error: null
  })
})

// POST /api/auth/reset-password (request reset)
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)
    const db = getDb()
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)

    // Always respond success to prevent email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

      db.prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
      ).run(user.id, tokenHash, expiresAt)

      // TODO: Send email via notificationService when email is configured
      console.log(`[DEV] Password reset token for ${email}: ${token}`)
    }

    res.json({ success: true, data: { message: 'If that email exists, a reset link has been sent.' }, error: null })
  } catch (err) {
    next(err)
  }
})

module.exports = router

const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { z } = require('zod')
const { getDb } = require('../db')
const { generateToken, authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { rateLimit } = require('../middleware/rateLimit')
const { sendPasswordResetEmail } = require('../services/emailService')

const router = express.Router()

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------
const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
}

function setAuthCookie(res, token, rememberMe) {
  const maxAge = rememberMe
    ? 30 * 24 * 60 * 60 * 1000  // 30 days
    :      24 * 60 * 60 * 1000  // 24 hours
  res.cookie('token', token, { ...COOKIE_BASE, maxAge })
}

function clearAuthCookie(res) {
  res.clearCookie('token', COOKIE_BASE)
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.')
})

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional().default(false)
})

const requestResetSchema = z.object({
  email: z.string().email('Please enter a valid email address.')
})

const confirmResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.')
})

const updateSettingsSchema = z.object({
  dayResetHour: z.number().int().min(0).max(23).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notificationsEnabled: z.boolean().optional(),
  vacationMode: z.object({
    enabled: z.boolean(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).optional()
}).strict()

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post(
  '/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many registration attempts. Please try again later.' }),
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body
      const db = getDb()

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
      if (existing) {
        return res.status(409).json({
          success: false,
          data: null,
          error: 'An account with this email already exists.'
        })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const result = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run(email, passwordHash)

      const user = { id: result.lastInsertRowid, email }
      const token = generateToken(user, false)
      setAuthCookie(res, token, false)

      res.status(201).json({
        success: true,
        data: { id: user.id, email: user.email },
        error: null
      })
    } catch (err) {
      next(err)
    }
  }
)

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please wait 15 minutes.' }),
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password, rememberMe } = req.body
      const db = getDb()

      const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email)

      // Always run bcrypt compare to prevent timing attacks on email enumeration
      const hashToCompare = user?.password_hash ?? '$2b$12$invalidhashfortimingattackprevention'
      const valid = await bcrypt.compare(password, hashToCompare)

      if (!user || !valid) {
        return res.status(401).json({
          success: false,
          data: null,
          error: 'Invalid email or password.'
        })
      }

      const token = generateToken(user, rememberMe)
      setAuthCookie(res, token, rememberMe)

      res.json({
        success: true,
        data: { id: user.id, email: user.email },
        error: null
      })
    } catch (err) {
      next(err)
    }
  }
)

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ success: true, data: null, error: null })
})

// ---------------------------------------------------------------------------
// GET /api/auth/me  — verify session and return user profile
// ---------------------------------------------------------------------------
router.get('/me', authenticate, (req, res, next) => {
  try {
    const db = getDb()
    const user = db.prepare(
      'SELECT id, email, settings_json, created_at FROM users WHERE id = ?'
    ).get(req.user.id)

    if (!user) {
      clearAuthCookie(res)
      return res.status(401).json({ success: false, data: null, error: 'User not found.' })
    }

    // Check if account is pending deletion
    const deletionRequest = db.prepare(
      "SELECT scheduled_at FROM account_deletion_requests WHERE user_id = ? AND cancelled = 0"
    ).get(req.user.id)

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        settings: JSON.parse(user.settings_json || '{}'),
        createdAt: user.created_at,
        pendingDeletion: deletionRequest ? deletionRequest.scheduled_at : null
      },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password  — request a reset link
// ---------------------------------------------------------------------------
router.post(
  '/reset-password',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many password reset requests. Please wait an hour.' }),
  validate(requestResetSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body
      const db = getDb()
      const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email)

      if (user) {
        // Expire any existing unused tokens for this user
        db.prepare(
          "UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0"
        ).run(user.id)

        const rawToken = crypto.randomBytes(32).toString('hex')
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

        db.prepare(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
        ).run(user.id, tokenHash, expiresAt)

        // Fire-and-forget: don't block response on email send
        sendPasswordResetEmail(user.email, rawToken).catch(err => {
          console.error('[EMAIL] Failed to send password reset email:', err.message)
        })
      }

      // Always return the same response to prevent email enumeration
      res.json({
        success: true,
        data: { message: 'If an account with that email exists, a reset link has been sent.' },
        error: null
      })
    } catch (err) {
      next(err)
    }
  }
)

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password/confirm  — verify token + set new password
// ---------------------------------------------------------------------------
router.post(
  '/reset-password/confirm',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  validate(confirmResetSchema),
  async (req, res, next) => {
    try {
      const { token, password } = req.body
      const db = getDb()

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const record = db.prepare(
        "SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = ?"
      ).get(tokenHash)

      if (!record || record.used) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'This reset link is invalid or has already been used.'
        })
      }

      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'This reset link has expired. Please request a new one.'
        })
      }

      const passwordHash = await bcrypt.hash(password, 12)

      // Use a transaction: update password + mark token used atomically
      const tx = db.transaction(() => {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, record.user_id)
        db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(record.id)
      })
      tx()

      res.json({
        success: true,
        data: { message: 'Password updated successfully. You can now log in.' },
        error: null
      })
    } catch (err) {
      next(err)
    }
  }
)

// ---------------------------------------------------------------------------
// PATCH /api/auth/settings  — update user settings (day reset hour, theme, etc.)
// ---------------------------------------------------------------------------
router.patch('/settings', authenticate, validate(updateSettingsSchema), (req, res, next) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT settings_json FROM users WHERE id = ?').get(req.user.id)
    const current = JSON.parse(user.settings_json || '{}')
    const merged = { ...current, ...req.body }

    db.prepare('UPDATE users SET settings_json = ? WHERE id = ?').run(
      JSON.stringify(merged),
      req.user.id
    )

    res.json({ success: true, data: { settings: merged }, error: null })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/auth/delete-account  — request account deletion (7-day grace period)
// ---------------------------------------------------------------------------
router.post('/delete-account', authenticate, (req, res, next) => {
  try {
    const db = getDb()

    const existing = db.prepare(
      "SELECT id FROM account_deletion_requests WHERE user_id = ? AND cancelled = 0"
    ).get(req.user.id)

    if (existing) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'An account deletion request is already pending.'
      })
    }

    const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(
      'INSERT INTO account_deletion_requests (user_id, scheduled_at) VALUES (?, ?)'
    ).run(req.user.id, scheduledAt)

    clearAuthCookie(res)
    res.json({
      success: true,
      data: { scheduledAt, message: 'Your account will be deleted in 7 days. Log back in to cancel.' },
      error: null
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/auth/cancel-deletion  — cancel a pending account deletion
// ---------------------------------------------------------------------------
router.post('/cancel-deletion', authenticate, (req, res, next) => {
  try {
    const db = getDb()
    const result = db.prepare(
      "UPDATE account_deletion_requests SET cancelled = 1 WHERE user_id = ? AND cancelled = 0"
    ).run(req.user.id)

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No pending deletion request found.'
      })
    }

    res.json({ success: true, data: { message: 'Account deletion cancelled.' }, error: null })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/auth/export  — full JSON data export
// ---------------------------------------------------------------------------
router.get('/export', authenticate, (req, res, next) => {
  try {
    const db = getDb()

    const habits = db.prepare(
      'SELECT * FROM habits WHERE user_id = ?'
    ).all(req.user.id).map(h => ({
      ...h,
      frequency_config_json: JSON.parse(h.frequency_config_json || '{}')
    }))

    const checkins = db.prepare(
      'SELECT * FROM checkins WHERE user_id = ? ORDER BY logical_date DESC'
    ).all(req.user.id)

    const user = db.prepare(
      'SELECT id, email, settings_json, created_at FROM users WHERE id = ?'
    ).get(req.user.id)

    const payload = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email, createdAt: user.created_at },
      settings: JSON.parse(user.settings_json || '{}'),
      habits,
      checkins
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="streakr-backup-${new Date().toISOString().slice(0, 10)}.json"`
    )
    res.json(payload)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Google OAuth stub — uncomment and configure GOOGLE_CLIENT_ID / SECRET to enable
// ---------------------------------------------------------------------------
/*
const passport = require('passport')
const { Strategy: GoogleStrategy } = require('passport-google-oauth20')

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const db = getDb()
      const email = profile.emails?.[0]?.value
      if (!email) return done(new Error('No email from Google profile'))

      let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email)
      if (!user) {
        // Auto-register via Google
        const result = db.prepare(
          "INSERT INTO users (email, password_hash) VALUES (?, ?)"
        ).run(email, 'GOOGLE_OAUTH_NO_PASSWORD')
        user = { id: result.lastInsertRowid, email }
      }
      done(null, user)
    } catch (err) {
      done(err)
    }
  }
))

router.get('/google', passport.authenticate('google', { scope: ['email', 'profile'], session: false }))

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  (req, res) => {
    const token = generateToken(req.user, true)
    setAuthCookie(res, token, true)
    res.redirect('/')
  }
)
*/

module.exports = router

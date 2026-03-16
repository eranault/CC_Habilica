/**
 * In-memory sliding-window rate limiter.
 * No external dependencies — fully free.
 *
 * Usage:
 *   const { rateLimit } = require('./rateLimit')
 *   router.post('/login', rateLimit({ windowMs: 15*60*1000, max: 10 }), handler)
 */

// Map<key, { count, resetAt }>
const store = new Map()

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (record.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000).unref() // .unref() so this timer doesn't prevent process exit

/**
 * @param {object} options
 * @param {number} options.windowMs   - Time window in ms (default: 15 min)
 * @param {number} options.max        - Max requests per window (default: 100)
 * @param {string} [options.keyBy]    - 'ip' (default) or 'user' (uses req.user.id)
 * @param {string} [options.message]  - Error message shown to client
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, keyBy = 'ip', message } = {}) {
  return (req, res, next) => {
    const key = buildKey(req, keyBy)
    const now = Date.now()
    const record = store.get(key)

    if (!record || record.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    record.count++

    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfterSec)
      return res.status(429).json({
        success: false,
        data: null,
        error: message || `Too many requests. Please wait ${Math.ceil(retryAfterSec / 60)} minute(s) and try again.`
      })
    }

    next()
  }
}

function buildKey(req, keyBy) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  if (keyBy === 'user' && req.user?.id) {
    return `user:${req.user.id}:${req.path}`
  }
  return `ip:${ip}:${req.path}`
}

module.exports = { rateLimit }

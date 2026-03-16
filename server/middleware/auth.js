const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production.')
}

const SECRET = JWT_SECRET || 'dev-secret-change-in-production'

/**
 * Express middleware: verifies the httpOnly cookie JWT.
 * Attaches { id, email } to req.user on success.
 */
function authenticate(req, res, next) {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Authentication required.'
    })
  }

  try {
    const payload = jwt.verify(token, SECRET)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    // Clear invalid/expired cookie so the browser doesn't keep resending it
    res.clearCookie('token', { httpOnly: true, path: '/' })

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Your session has expired. Please log in again.'
      })
    }

    return res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid session. Please log in again.'
    })
  }
}

/**
 * Optional auth — same as authenticate but doesn't reject unauthenticated requests.
 * Sets req.user if a valid token is present, otherwise req.user = null.
 */
function optionalAuthenticate(req, res, next) {
  const token = req.cookies?.token
  if (!token) {
    req.user = null
    return next()
  }
  try {
    const payload = jwt.verify(token, SECRET)
    req.user = { id: payload.sub, email: payload.email }
  } catch {
    req.user = null
  }
  next()
}

/**
 * Generate a signed JWT for a user.
 * @param {{ id: number, email: string }} user
 * @param {boolean} rememberMe - true => 30d, false => 24h
 */
function generateToken(user, rememberMe = false) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    SECRET,
    { expiresIn: rememberMe ? '30d' : '24h' }
  )
}

module.exports = { authenticate, optionalAuthenticate, generateToken }

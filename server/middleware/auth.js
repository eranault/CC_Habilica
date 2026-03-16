const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

function authenticate(req, res, next) {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ success: false, data: null, error: 'Authentication required.' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    res.clearCookie('token')
    return res.status(401).json({ success: false, data: null, error: 'Session expired. Please log in again.' })
  }
}

function generateToken(user, rememberMe = false) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: rememberMe ? '30d' : '24h' }
  )
}

module.exports = { authenticate, generateToken }

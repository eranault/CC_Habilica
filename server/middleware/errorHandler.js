const { ZodError } = require('zod')

function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err instanceof ZodError) {
    const message = err.errors.map(e => e.message).join(', ')
    return res.status(400).json({ success: false, data: null, error: message })
  }

  // Known operational errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, data: null, error: err.message })
  }

  // SQLite unique constraint
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ success: false, data: null, error: 'This record already exists.' })
  }

  // Unknown errors — don't leak internals
  console.error('[ERROR]', err)
  return res.status(500).json({ success: false, data: null, error: 'An unexpected error occurred.' })
}

function createError(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

module.exports = { errorHandler, createError }

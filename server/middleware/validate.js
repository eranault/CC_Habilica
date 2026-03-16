// Zod schema validation middleware
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      const message = result.error.errors.map(e => e.message).join(', ')
      return res.status(400).json({ success: false, data: null, error: message })
    }
    req[target] = result.data
    next()
  }
}

module.exports = { validate }

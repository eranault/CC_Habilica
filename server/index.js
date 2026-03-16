require('dotenv').config()
const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path')

const { initDb } = require('./db')
const authRoutes = require('./routes/auth')
const habitRoutes = require('./routes/habits')
const checkinRoutes = require('./routes/checkins')
const statsRoutes = require('./routes/stats')
const partnerRoutes = require('./routes/partners')
const notificationRoutes = require('./routes/notifications')
const { authenticate } = require('./middleware/auth')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()
const PORT = process.env.PORT || 3001

// Trust proxy (needed for rate limiting behind nginx/docker)
app.set('trust proxy', 1)

// Middleware
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', ts: new Date().toISOString() } })
})

// Auth routes (public)
app.use('/api/auth', authRoutes)

// Protected routes
app.use('/api/habits', authenticate, habitRoutes)
app.use('/api/checkins', authenticate, checkinRoutes)
app.use('/api/stats', authenticate, statsRoutes)
app.use('/api/partners', authenticate, partnerRoutes)
app.use('/api/notifications', authenticate, notificationRoutes)

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })
}

// Global error handler
app.use(errorHandler)

// Initialize DB then start server
initDb()
app.listen(PORT, () => {
  console.log(`Streakr API running on port ${PORT}`)
})

module.exports = app

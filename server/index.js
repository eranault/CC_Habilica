const { initDb } = require('./db')
const app = require('./app')

const PORT = process.env.PORT || 3001

initDb()
app.listen(PORT, () => {
  console.log(`Streakr API running on port ${PORT}`)
})

module.exports = app

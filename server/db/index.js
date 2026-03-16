const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/streakr.db')

let db

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

function initDb() {
  // Ensure data directory exists
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(DB_PATH)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Run migrations
  runMigrations()

  console.log(`Database initialized at ${DB_PATH}`)
  return db
}

function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  // Track applied migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename)

  for (const file of migrationFiles) {
    if (applied.includes(file)) continue

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file)
    console.log(`Migration applied: ${file}`)
  }
}

module.exports = { getDb, initDb }

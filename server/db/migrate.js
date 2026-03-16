#!/usr/bin/env node
/**
 * Standalone migration CLI.
 * Usage: node server/db/migrate.js
 * Runs any pending migrations and exits.
 */
require('dotenv').config()
const { initDb } = require('./index')

try {
  initDb()
  console.log('All migrations applied successfully.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}

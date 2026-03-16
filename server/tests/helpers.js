/**
 * Test helpers — spin up a real Express server against a temp SQLite file.
 * Uses Node 22 built-in fetch (no dependencies).
 */
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

// Point to a per-test-run temp DB so tests are fully isolated
const tmpDb = path.join(os.tmpdir(), `streakr-test-${crypto.randomBytes(6).toString('hex')}.db`)
process.env.DB_PATH = tmpDb
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!'
process.env.NODE_ENV = 'test'

const { initDb, getDb } = require('../db')
const app = require('../app')

let server
let baseUrl

/** Start the test server. Call once before your test suite. */
async function startServer() {
  initDb()
  server = http.createServer(app)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
  return baseUrl
}

/** Stop the test server and clean up the temp DB. */
async function stopServer() {
  if (server) await new Promise(resolve => server.close(resolve))
  try { fs.unlinkSync(tmpDb) } catch {}
  try { fs.unlinkSync(tmpDb + '-wal') } catch {}
  try { fs.unlinkSync(tmpDb + '-shm') } catch {}
}

/**
 * Make an HTTP request to the test server.
 * Automatically handles cookies (stored in-memory per session).
 */
class TestClient {
  constructor() {
    this.cookies = {}
  }

  _cookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  _saveCookies(res) {
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const c of setCookie) {
      const [pair] = c.split(';')
      const [name, value] = pair.split('=')
      if (value === undefined || value.toLowerCase() === 'deleted') {
        delete this.cookies[name.trim()]
      } else {
        this.cookies[name.trim()] = value.trim()
      }
    }
  }

  async request(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: this._cookieHeader()
      }
    }
    if (body !== undefined) opts.body = JSON.stringify(body)

    const res = await fetch(`${baseUrl}${path}`, opts)
    this._saveCookies(res)

    let data
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json') || ct.includes('text/')) {
      data = ct.includes('application/json') ? await res.json() : await res.text()
    } else {
      data = null
    }
    return { status: res.status, body: data, headers: res.headers }
  }

  get(path)              { return this.request('GET', path) }
  post(path, body)       { return this.request('POST', path, body) }
  put(path, body)        { return this.request('PUT', path, body) }
  patch(path, body)      { return this.request('PATCH', path, body) }
  delete(path)           { return this.request('DELETE', path) }
}

/** Register + login a test user, returns an authenticated TestClient. */
async function authenticatedClient(email = `u${Date.now()}@test.com`, password = 'password123') {
  const client = new TestClient()
  const res = await client.post('/api/auth/register', { email, password })
  if (!res.body.success) throw new Error(`Register failed: ${res.body.error}`)
  return client
}

module.exports = { startServer, stopServer, TestClient, authenticatedClient, getDb }

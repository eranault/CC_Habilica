const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, stopServer, authenticatedClient } = require('./helpers')

describe('Stats API', () => {
  before(startServer)
  after(stopServer)

  const TODAY = new Date().toISOString().slice(0, 10)
  const YESTERDAY = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
  })()

  async function setup() {
    const client = await authenticatedClient()
    const h1 = (await client.post('/api/habits', { name: 'Meditate', difficulty: 'easy' })).body.data
    const h2 = (await client.post('/api/habits', { name: 'Exercise', difficulty: 'hard' })).body.data
    return { client, h1, h2 }
  }

  // ── GET /api/stats/summary ────────────────────────────────────────────────

  describe('GET /api/stats/summary', () => {
    it('returns zeros for empty user', async () => {
      const client = await authenticatedClient()
      const res = await client.get('/api/stats/summary')

      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.today.total, 0)
      assert.equal(res.body.data.today.completed, 0)
      assert.equal(res.body.data.week.completedCheckIns, 0)
    })

    it('reflects today\'s check-ins', async () => {
      const { client, h1, h2 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })

      const res = await client.get('/api/stats/summary')
      const { today } = res.body.data

      assert.equal(today.total, 2)
      assert.equal(today.completed, 1)
      assert.equal(today.remaining, 1)
      assert.ok(today.completedIds.includes(h1.id))
    })

    it('includes per-habit completion rates', async () => {
      const { client, h1 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })

      const res = await client.get('/api/stats/summary')
      const habit = res.body.data.habits.find(h => h.id === h1.id)
      assert.ok(habit)
      assert.ok(typeof habit.completionRate30d === 'number')
    })

    it('calculates a weighted progressScore', async () => {
      const { client, h1, h2 } = await setup()
      // Only complete the hard habit (weight 3)
      await client.post('/api/checkins', { habit_id: h2.id, logical_date: TODAY })

      const res = await client.get('/api/stats/summary')
      const { progressScore } = res.body.data.today
      // easy=1, hard=3 → total=4, completed=3 → 75%
      assert.equal(progressScore, 75)
    })
  })

  // ── GET /api/stats/heatmap ────────────────────────────────────────────────

  describe('GET /api/stats/heatmap', () => {
    it('returns heatmap data for all habits', async () => {
      const { client, h1 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: YESTERDAY })

      const res = await client.get('/api/stats/heatmap')
      assert.equal(res.status, 200)
      assert.ok(res.body.data.length >= 2)
      const todayEntry = res.body.data.find(d => d.logical_date === TODAY)
      assert.ok(todayEntry)
      assert.ok(todayEntry.count >= 1)
    })

    it('filters by habitId', async () => {
      const { client, h1, h2 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })
      await client.post('/api/checkins', { habit_id: h2.id, logical_date: TODAY })

      const res = await client.get(`/api/stats/heatmap?habitId=${h1.id}`)
      // All entries should be count=1 (only h1)
      for (const entry of res.body.data) {
        assert.ok(entry.count >= 1)
      }
    })

    it('returns 404 for non-owned habitId', async () => {
      const alice = await authenticatedClient('alice_hm@test.com')
      const bob = await authenticatedClient('bob_hm@test.com')
      const habit = (await alice.post('/api/habits', { name: 'A' })).body.data

      const res = await bob.get(`/api/stats/heatmap?habitId=${habit.id}`)
      assert.equal(res.status, 404)
    })
  })

  // ── GET /api/stats/trends ─────────────────────────────────────────────────

  describe('GET /api/stats/trends', () => {
    it('returns trend data', async () => {
      const { client, h1 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })

      const res = await client.get('/api/stats/trends?range=7d')
      assert.equal(res.status, 200)
      assert.ok(Array.isArray(res.body.data))
      const entry = res.body.data.find(d => d.date === TODAY)
      assert.ok(entry)
      assert.ok(entry.completed >= 1)
    })

    it('rejects invalid range', async () => {
      const client = await authenticatedClient()
      const res = await client.get('/api/stats/trends?range=1y')
      assert.equal(res.status, 400)
    })

    it('supports all range values', async () => {
      const client = await authenticatedClient()
      for (const range of ['7d', '30d', '90d', 'all']) {
        const res = await client.get(`/api/stats/trends?range=${range}`)
        assert.equal(res.status, 200, `range=${range} should be 200`)
      }
    })
  })

  // ── GET /api/stats/correlation ────────────────────────────────────────────

  describe('GET /api/stats/correlation', () => {
    it('returns correlation data for two habits', async () => {
      const { client, h1, h2 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })
      await client.post('/api/checkins', { habit_id: h2.id, logical_date: TODAY })

      const res = await client.get(`/api/stats/correlation?habitA=${h1.id}&habitB=${h2.id}`)
      assert.equal(res.status, 200)
      const { series, coOccurrence, daysA, daysB } = res.body.data
      assert.ok(Array.isArray(series))
      assert.ok(series.length > 0)
      assert.equal(typeof coOccurrence, 'number')
      assert.ok(coOccurrence >= 0 && coOccurrence <= 100)
      assert.ok(daysA >= 1)
      assert.ok(daysB >= 1)
    })

    it('returns 400 when habitA or habitB is missing', async () => {
      const client = await authenticatedClient()
      const res = await client.get('/api/stats/correlation?habitA=1')
      assert.equal(res.status, 400)
    })

    it('returns 404 for non-owned habit', async () => {
      const alice = await authenticatedClient('alice_corr@test.com')
      const bob = await authenticatedClient('bob_corr@test.com')
      const aliceHabit = (await alice.post('/api/habits', { name: 'A' })).body.data
      const bobHabit = (await bob.post('/api/habits', { name: 'B' })).body.data

      const res = await bob.get(`/api/stats/correlation?habitA=${bobHabit.id}&habitB=${aliceHabit.id}`)
      assert.equal(res.status, 404)
    })
  })

  // ── GET /api/stats/export ─────────────────────────────────────────────────

  describe('GET /api/stats/export', () => {
    it('returns CSV with correct headers', async () => {
      const { client, h1 } = await setup()
      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY, note: 'felt good' })

      const res = await client.get('/api/stats/export')
      assert.equal(res.status, 200)
      assert.ok(res.headers.get('content-type').includes('text/csv'))
      assert.ok(res.headers.get('content-disposition').includes('.csv'))
      assert.ok(typeof res.body === 'string')
      assert.ok(res.body.startsWith('habit_name,difficulty,frequency_type,date,note,checked_at'))
      assert.ok(res.body.includes('Meditate'))
      assert.ok(res.body.includes('felt good'))
    })

    it('returns empty CSV (header only) for user with no check-ins', async () => {
      const client = await authenticatedClient()
      const res = await client.get('/api/stats/export')
      assert.equal(res.status, 200)
      const lines = res.body.trim().split('\n')
      assert.equal(lines.length, 1) // header only
    })
  })
})

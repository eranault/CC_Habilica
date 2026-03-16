const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, stopServer, authenticatedClient, TestClient, getDb } = require('./helpers')

describe('Check-ins API', () => {
  before(startServer)
  after(stopServer)

  const TODAY = new Date().toISOString().slice(0, 10)
  const YESTERDAY = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
  })()

  async function createHabit(client, name = 'Test habit') {
    const res = await client.post('/api/habits', { name })
    return res.body.data
  }

  // ── POST /api/checkins ────────────────────────────────────────────────────

  describe('POST /api/checkins', () => {
    it('creates a check-in for today', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      const res = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: TODAY
      })

      assert.equal(res.status, 201)
      assert.equal(res.body.success, true)
      const ci = res.body.data
      assert.equal(ci.habit_id, habit.id)
      assert.equal(ci.logical_date, TODAY)
      assert.ok(typeof ci.id === 'number')
    })

    it('creates a check-in with a note', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      const res = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: TODAY,
        note: 'Felt great today!'
      })
      assert.equal(res.body.data.note, 'Felt great today!')
    })

    it('upserts on same date — note is updated', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      await client.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY, note: 'First' })
      const second = await client.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY, note: 'Updated' })

      assert.equal(second.status, 201)
      assert.equal(second.body.data.note, 'Updated')

      // Should still be just one check-in for today
      const list = await client.get(`/api/checkins?habitId=${habit.id}`)
      const forToday = list.body.data.filter(c => c.logical_date === TODAY)
      assert.equal(forToday.length, 1)
    })

    it('updates streak after check-in', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)
      await client.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY })

      const habits = await client.get('/api/habits')
      const updated = habits.body.data.find(h => h.id === habit.id)
      assert.equal(updated.current_streak, 1)
      assert.equal(updated.best_streak, 1)
    })

    it('rejects future dates', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      const future = new Date(); future.setDate(future.getDate() + 5)
      const res = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: future.toISOString().slice(0, 10)
      })
      assert.equal(res.status, 400)
      assert.ok(res.body.error.toLowerCase().includes('future'))
    })

    it('rejects archived habits', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)
      await client.patch(`/api/habits/${habit.id}/archive`)

      const res = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: TODAY
      })
      assert.equal(res.status, 404)
    })

    it('rejects another user\'s habit', async () => {
      const alice = await authenticatedClient('alice_ci@test.com')
      const bob = await authenticatedClient('bob_ci@test.com')

      const habit = await createHabit(alice)
      const res = await bob.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY })
      assert.equal(res.status, 404)
    })

    it('rejects note over 280 chars', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)
      const res = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: TODAY,
        note: 'x'.repeat(281)
      })
      assert.equal(res.status, 400)
    })

    it('rejects invalid date format', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)
      const res = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: '2026/03/16'
      })
      assert.equal(res.status, 400)
    })
  })

  // ── DELETE /api/checkins/:id ──────────────────────────────────────────────

  describe('DELETE /api/checkins/:id (undo)', () => {
    it('undoes a check-in made just now', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      const created = await client.post('/api/checkins', {
        habit_id: habit.id,
        logical_date: TODAY
      })
      const id = created.body.data.id

      const del = await client.delete(`/api/checkins/${id}`)
      assert.equal(del.status, 200)
      assert.equal(del.body.success, true)

      // Streak should reset to 0
      const habits = await client.get('/api/habits')
      const h = habits.body.data.find(x => x.id === habit.id)
      assert.equal(h.current_streak, 0)
    })

    it('rejects undo of another user\'s check-in', async () => {
      const alice = await authenticatedClient('alice_undo@test.com')
      const bob = await authenticatedClient('bob_undo@test.com')

      const habit = await createHabit(alice)
      const ci = await alice.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY })
      const id = ci.body.data.id

      const res = await bob.delete(`/api/checkins/${id}`)
      assert.equal(res.status, 404)
    })

    it('rejects undo of a stale check-in (simulated via DB)', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      const ci = await client.post('/api/checkins', { habit_id: habit.id, logical_date: YESTERDAY })
      const id = ci.body.data.id

      // Backdate the created_at directly in DB to simulate 10 minutes ago
      const db = getDb()
      db.prepare("UPDATE checkins SET created_at = datetime('now', '-10 minutes') WHERE id = ?").run(id)

      const res = await client.delete(`/api/checkins/${id}`)
      assert.equal(res.status, 403)
      assert.ok(res.body.error.toLowerCase().includes('5 minutes'))
    })
  })

  // ── GET /api/checkins ─────────────────────────────────────────────────────

  describe('GET /api/checkins', () => {
    it('returns all check-ins for authenticated user', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      await client.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY })
      await client.post('/api/checkins', { habit_id: habit.id, logical_date: YESTERDAY })

      const res = await client.get('/api/checkins')
      assert.equal(res.status, 200)
      assert.equal(res.body.data.length, 2)
    })

    it('filters by habitId', async () => {
      const client = await authenticatedClient()
      const h1 = await createHabit(client, 'H1')
      const h2 = await createHabit(client, 'H2')

      await client.post('/api/checkins', { habit_id: h1.id, logical_date: TODAY })
      await client.post('/api/checkins', { habit_id: h2.id, logical_date: TODAY })

      const res = await client.get(`/api/checkins?habitId=${h1.id}`)
      assert.equal(res.body.data.length, 1)
      assert.equal(res.body.data[0].habit_id, h1.id)
    })

    it('filters by from/to date range', async () => {
      const client = await authenticatedClient()
      const habit = await createHabit(client)

      await client.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY })
      await client.post('/api/checkins', { habit_id: habit.id, logical_date: YESTERDAY })

      const res = await client.get(`/api/checkins?from=${TODAY}&to=${TODAY}`)
      assert.equal(res.body.data.length, 1)
      assert.equal(res.body.data[0].logical_date, TODAY)
    })

    it('rejects invalid date format in query params', async () => {
      const client = await authenticatedClient()
      const res = await client.get('/api/checkins?from=bad-date')
      assert.equal(res.status, 400)
    })

    it('does not return other users\' check-ins', async () => {
      const alice = await authenticatedClient('alice_get@test.com')
      const bob = await authenticatedClient('bob_get@test.com')

      const habit = await createHabit(alice)
      await alice.post('/api/checkins', { habit_id: habit.id, logical_date: TODAY })

      const res = await bob.get('/api/checkins')
      assert.equal(res.body.data.length, 0)
    })
  })
})

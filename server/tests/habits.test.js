const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, stopServer, authenticatedClient, TestClient } = require('./helpers')

describe('Habits API', () => {
  before(startServer)
  after(stopServer)

  // ── GET /api/habits ───────────────────────────────────────────────────────

  describe('GET /api/habits', () => {
    it('returns empty array for new user', async () => {
      const client = await authenticatedClient()
      const res = await client.get('/api/habits')
      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.deepEqual(res.body.data, [])
    })

    it('requires authentication', async () => {
      const client = new TestClient()
      const res = await client.get('/api/habits')
      assert.equal(res.status, 401)
      assert.equal(res.body.success, false)
    })
  })

  // ── POST /api/habits ──────────────────────────────────────────────────────

  describe('POST /api/habits', () => {
    it('creates a habit with defaults', async () => {
      const client = await authenticatedClient()
      const res = await client.post('/api/habits', { name: 'Morning run' })

      assert.equal(res.status, 201)
      assert.equal(res.body.success, true)
      const h = res.body.data
      assert.equal(h.name, 'Morning run')
      assert.equal(h.frequency_type, 'daily')
      assert.equal(h.difficulty, 'medium')
      assert.equal(h.is_private, false)
      assert.equal(h.is_archived, false)
      assert.equal(h.forgiveness_days, 1)
      assert.equal(h.current_streak, 0)
      assert.equal(h.best_streak, 0)
      assert.ok(typeof h.id === 'number')
    })

    it('creates a habit with all fields', async () => {
      const client = await authenticatedClient()
      const res = await client.post('/api/habits', {
        name: 'Read',
        description: 'Read 20 pages',
        color: '#6366f1',
        icon: '📚',
        frequency_type: 'weekly_count',
        frequency_config_json: { count: 5 },
        difficulty: 'hard',
        is_private: true,
        forgiveness_days: 2,
        motivational_note: 'Feed your mind'
      })

      assert.equal(res.status, 201)
      const h = res.body.data
      assert.equal(h.name, 'Read')
      assert.equal(h.color, '#6366f1')
      assert.equal(h.difficulty, 'hard')
      assert.equal(h.is_private, true)
      assert.equal(h.forgiveness_days, 2)
      assert.equal(h.motivational_note, 'Feed your mind')
      assert.deepEqual(h.frequency_config_json, { count: 5 })
    })

    it('rejects missing name', async () => {
      const client = await authenticatedClient()
      const res = await client.post('/api/habits', { description: 'no name' })
      assert.equal(res.status, 400)
      assert.equal(res.body.success, false)
      assert.ok(res.body.error.toLowerCase().includes('name'))
    })

    it('rejects invalid color', async () => {
      const client = await authenticatedClient()
      const res = await client.post('/api/habits', { name: 'x', color: 'notahex' })
      assert.equal(res.status, 400)
      assert.ok(res.body.error.toLowerCase().includes('color'))
    })

    it('rejects invalid frequency_type', async () => {
      const client = await authenticatedClient()
      const res = await client.post('/api/habits', { name: 'x', frequency_type: 'hourly' })
      assert.equal(res.status, 400)
    })

    it('assigns increasing sort_order', async () => {
      const client = await authenticatedClient()
      const a = await client.post('/api/habits', { name: 'A' })
      const b = await client.post('/api/habits', { name: 'B' })
      const c = await client.post('/api/habits', { name: 'C' })
      assert.ok(a.body.data.sort_order < b.body.data.sort_order)
      assert.ok(b.body.data.sort_order < c.body.data.sort_order)
    })
  })

  // ── PUT /api/habits/:id ───────────────────────────────────────────────────

  describe('PUT /api/habits/:id', () => {
    it('updates a habit', async () => {
      const client = await authenticatedClient()
      const created = await client.post('/api/habits', { name: 'Walk' })
      const id = created.body.data.id

      const res = await client.put(`/api/habits/${id}`, {
        name: 'Walk 30 min',
        difficulty: 'easy',
        color: '#22c55e'
      })

      assert.equal(res.status, 200)
      assert.equal(res.body.data.name, 'Walk 30 min')
      assert.equal(res.body.data.difficulty, 'easy')
      assert.equal(res.body.data.color, '#22c55e')
    })

    it('returns 404 for non-existent habit', async () => {
      const client = await authenticatedClient()
      const res = await client.put('/api/habits/99999', { name: 'x' })
      assert.equal(res.status, 404)
    })

    it('cannot update another user\'s habit', async () => {
      const alice = await authenticatedClient('alice@test.com')
      const bob = await authenticatedClient('bob@test.com')

      const created = await alice.post('/api/habits', { name: 'Alice habit' })
      const id = created.body.data.id

      const res = await bob.put(`/api/habits/${id}`, { name: 'hacked' })
      assert.equal(res.status, 404)
    })

    it('returns 400 when no valid fields provided', async () => {
      const client = await authenticatedClient()
      const created = await client.post('/api/habits', { name: 'Test' })
      const id = created.body.data.id
      // Send only unknown fields
      const res = await client.put(`/api/habits/${id}`, { user_id: 999 })
      assert.equal(res.status, 400)
    })
  })

  // ── DELETE /api/habits/:id ────────────────────────────────────────────────

  describe('DELETE /api/habits/:id', () => {
    it('deletes a habit', async () => {
      const client = await authenticatedClient()
      const created = await client.post('/api/habits', { name: 'Temp' })
      const id = created.body.data.id

      const del = await client.delete(`/api/habits/${id}`)
      assert.equal(del.status, 200)
      assert.equal(del.body.success, true)

      const list = await client.get('/api/habits')
      assert.ok(!list.body.data.find(h => h.id === id))
    })

    it('returns 404 for non-existent habit', async () => {
      const client = await authenticatedClient()
      const res = await client.delete('/api/habits/99999')
      assert.equal(res.status, 404)
    })
  })

  // ── PATCH /api/habits/reorder ─────────────────────────────────────────────

  describe('PATCH /api/habits/reorder', () => {
    it('reorders habits', async () => {
      const client = await authenticatedClient()
      const a = (await client.post('/api/habits', { name: 'A' })).body.data
      const b = (await client.post('/api/habits', { name: 'B' })).body.data
      const c = (await client.post('/api/habits', { name: 'C' })).body.data

      // Reverse order
      const res = await client.patch('/api/habits/reorder', {
        orderedIds: [c.id, b.id, a.id]
      })
      assert.equal(res.status, 200)

      const list = await client.get('/api/habits')
      const ids = list.body.data.map(h => h.id)
      assert.equal(ids[0], c.id)
      assert.equal(ids[1], b.id)
      assert.equal(ids[2], a.id)
    })

    it('rejects empty orderedIds', async () => {
      const client = await authenticatedClient()
      const res = await client.patch('/api/habits/reorder', { orderedIds: [] })
      assert.equal(res.status, 400)
    })
  })

  // ── PATCH /api/habits/bulk ────────────────────────────────────────────────

  describe('PATCH /api/habits/bulk', () => {
    it('bulk updates color and difficulty', async () => {
      const client = await authenticatedClient()
      const a = (await client.post('/api/habits', { name: 'A' })).body.data
      const b = (await client.post('/api/habits', { name: 'B' })).body.data

      const res = await client.patch('/api/habits/bulk', {
        ids: [a.id, b.id],
        updates: { color: '#ef4444', difficulty: 'hard' }
      })
      assert.equal(res.status, 200)
      assert.equal(res.body.data.updated, 2)

      const list = await client.get('/api/habits')
      const updatedA = list.body.data.find(h => h.id === a.id)
      const updatedB = list.body.data.find(h => h.id === b.id)
      assert.equal(updatedA.color, '#ef4444')
      assert.equal(updatedB.difficulty, 'hard')
    })

    it('returns 404 if any id is not owned by user', async () => {
      const alice = await authenticatedClient('alice2@test.com')
      const bob = await authenticatedClient('bob2@test.com')

      const aliceHabit = (await alice.post('/api/habits', { name: 'A' })).body.data

      const res = await bob.patch('/api/habits/bulk', {
        ids: [aliceHabit.id],
        updates: { color: '#000000' }
      })
      assert.equal(res.status, 404)
    })
  })

  // ── PATCH /api/habits/:id/archive ─────────────────────────────────────────

  describe('PATCH /api/habits/:id/archive', () => {
    it('archives a habit', async () => {
      const client = await authenticatedClient()
      const created = (await client.post('/api/habits', { name: 'To archive' })).body.data

      const res = await client.patch(`/api/habits/${created.id}/archive`)
      assert.equal(res.status, 200)
      assert.equal(res.body.data.is_archived, true)

      // Should not appear in default list
      const list = await client.get('/api/habits')
      assert.ok(!list.body.data.find(h => h.id === created.id))

      // Should appear with includeArchived
      const all = await client.get('/api/habits?includeArchived=true')
      assert.ok(all.body.data.find(h => h.id === created.id && h.is_archived))
    })

    it('unarchives a habit (toggle)', async () => {
      const client = await authenticatedClient()
      const created = (await client.post('/api/habits', { name: 'Toggle' })).body.data

      await client.patch(`/api/habits/${created.id}/archive`) // archive
      const res = await client.patch(`/api/habits/${created.id}/archive`) // unarchive
      assert.equal(res.body.data.is_archived, false)
    })
  })
})

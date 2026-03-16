const express = require('express')
const router = express.Router()
const { PERSONAS, runCoach, runRoundtable } = require('../services/agentService')

// GET /api/agent/personas — returns list of available personas
router.get('/personas', (req, res) => {
  const list = Object.values(PERSONAS).map(({ id, name, avatar, color, domain }) => ({
    id, name, avatar, color, domain
  }))
  res.json({ success: true, data: list, error: null })
})

// POST /api/agent/chat — 1-on-1 Role Model Coach
router.post('/chat', async (req, res) => {
  const { personaId, customPersona, goal, messages } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, data: null, error: 'messages array is required' })
  }

  if (!personaId && !customPersona) {
    return res.status(400).json({ success: false, data: null, error: 'personaId or customPersona is required' })
  }

  try {
    const response = await runCoach(req.user.id, personaId, customPersona || null, goal || null, messages)
    res.json({ success: true, data: { response }, error: null })
  } catch (err) {
    console.error('[agent/chat] Error:', err.message)
    if (err.message.includes('GROQ_API_KEY')) {
      return res.status(503).json({ success: false, data: null, error: err.message })
    }
    res.status(500).json({ success: false, data: null, error: 'The mentor is temporarily unavailable. Please try again.' })
  }
})

// POST /api/agent/roundtable — autonomous multi-persona discussion
router.post('/roundtable', async (req, res) => {
  const { personaIds, topic, history } = req.body

  if (!personaIds || !Array.isArray(personaIds) || personaIds.length < 2) {
    return res.status(400).json({ success: false, data: null, error: 'At least 2 personaIds are required' })
  }

  if (personaIds.length > 4) {
    return res.status(400).json({ success: false, data: null, error: 'Maximum 4 personas per roundtable' })
  }

  try {
    const responses = await runRoundtable(req.user.id, personaIds, topic || null, history || null)
    res.json({ success: true, data: { responses }, error: null })
  } catch (err) {
    console.error('[agent/roundtable] Error:', err.message)
    if (err.message.includes('GROQ_API_KEY')) {
      return res.status(503).json({ success: false, data: null, error: err.message })
    }
    res.status(500).json({ success: false, data: null, error: 'The Roundtable is temporarily unavailable. Please try again.' })
  }
})

module.exports = router

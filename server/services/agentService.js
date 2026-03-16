const Groq = require('groq-sdk')
const { getDb } = require('../db')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'llama-3.3-70b-versatile'

// ─── Persona Registry ────────────────────────────────────────────────────────

const PERSONAS = {
  'alex-hormozi': {
    id: 'alex-hormozi',
    name: 'Alex Hormozi',
    avatar: '💰',
    color: '#f59e0b',
    domain: 'Business & Wealth Building',
    identity: `You are Alex Hormozi — entrepreneur, author of "$100M Offers", and founder of Acquisition.com.
You are brutally direct, tactical, and allergic to excuses. You speak in frameworks and first-principles.
You often say things like "The math on that is simple", "Volume solves most problems", "You don't have a motivation problem, you have a skill problem."
You believe in massive action, compounding habits, and that most people fail because of low standards, not bad luck.
Reference your books, your own journey from broke to billionaire, and the concept of "Grand Slam Offers".`
  },
  'john-rockefeller': {
    id: 'john-rockefeller',
    name: 'John D. Rockefeller',
    avatar: '🏛️',
    color: '#8b5cf6',
    domain: 'Discipline & Long-Term Wealth',
    identity: `You are John D. Rockefeller — America's first billionaire, founder of Standard Oil, and the wealthiest person in modern history.
You speak with patience, gravitas, and long-term vision. You believe in discipline above all else.
You often say things like "I would rather earn 1% off a hundred people's efforts than 100% of my own effort."
You kept meticulous ledgers of every penny. You believe that giving and humility are essential to sustained success.
Reference your real-life habits: rising early, keeping a personal ledger, never borrowing money, and giving 10% away from your first dollar.`
  },
  'elon-musk': {
    id: 'elon-musk',
    name: 'Elon Musk',
    avatar: '🚀',
    color: '#06b6d4',
    domain: 'Innovation & First Principles',
    identity: `You are Elon Musk — CEO of Tesla and SpaceX, founder of Neuralink and The Boring Company.
You think from first principles and are impatient with conventional thinking. You speak bluntly and expect people to work as hard as you do.
You often say things like "If something is important enough, even if the odds are against you, you should still do it."
You believe in attacking hard problems with physics-based reasoning, ignoring what "can't be done", and that most people underestimate what they can achieve in 10 years.
Reference your work ethic (80-100 hour weeks), your failures (SpaceX nearly went bankrupt), and your relentless optimism.`
  },
  'marcus-aurelius': {
    id: 'marcus-aurelius',
    name: 'Marcus Aurelius',
    avatar: '⚔️',
    color: '#10b981',
    domain: 'Stoicism & Inner Discipline',
    identity: `You are Marcus Aurelius — Roman Emperor and Stoic philosopher, author of "Meditations".
You speak with calm authority, introspection, and wisdom. You are never reactive. You believe in virtue as the only true good.
You often say things like "You have power over your mind, not outside events. Realize this, and you will find strength."
You believe the obstacle is the way. You practice negative visualization. You see difficulty as training for the soul.
Reference passages from Meditations, the concept of memento mori, the dichotomy of control, and your practice of writing to yourself each morning.`
  },
  'david-goggins': {
    id: 'david-goggins',
    name: 'David Goggins',
    avatar: '🔥',
    color: '#ef4444',
    domain: 'Mental Toughness & Endurance',
    identity: `You are David Goggins — retired Navy SEAL, ultramarathon runner, and author of "Can't Hurt Me".
You are raw, intense, and refuse to accept weakness. You have zero tolerance for excuses or self-pity.
You often say things like "The most important conversations you'll ever have are the ones you'll have with yourself."
You believe most people only use 40% of their potential (the 40% rule). You believe in callusing the mind through voluntary hardship.
Reference your transformation from 300-lb pest control worker to Navy SEAL, your world record pull-up attempt, and running 100-mile races with stress fractures.`
  },
  'oprah-winfrey': {
    id: 'oprah-winfrey',
    name: 'Oprah Winfrey',
    avatar: '✨',
    color: '#ec4899',
    domain: 'Purpose & Emotional Intelligence',
    identity: `You are Oprah Winfrey — media mogul, philanthropist, and one of the most influential people in the world.
You speak with warmth, empathy, and deep conviction. You believe that knowing your purpose changes everything.
You often say things like "The biggest adventure you can take is to live the life of your dreams."
You believe in gratitude as a practice, not just a feeling. You kept a daily gratitude journal for years.
Reference your childhood of poverty in Mississippi, your rise despite immense obstacles, and your belief that every experience is here to teach you something.`
  }
}

// ─── Shared Tool Definitions ─────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_habits',
      description: 'Get all active habits for the user with their current streaks and 30-day completion rates',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_todays_progress',
      description: 'Get which habits the user has completed today vs which are still pending',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_streak_insights',
      description: 'Get insights about streaks: at-risk habits (streak about to break), best performing habits, and any milestones',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weekly_stats',
      description: 'Get this week\'s habit completion summary',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_checkins',
      description: 'Log check-ins for one or more habits by name. Use when user describes completing habits in natural language.',
      parameters: {
        type: 'object',
        properties: {
          habit_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of habit names to check in (will be matched case-insensitively)'
          }
        },
        required: ['habit_names']
      }
    }
  }
]

// ─── Shared Helper: Fetch Habit Context ──────────────────────────────────────

async function getUserHabitContext(userId) {
  const db = getDb()
  const habits = db.prepare(`
    SELECT h.id, h.name, h.difficulty, h.frequency_type, h.frequency_config_json,
           h.forgiveness_days, s.current_streak, s.best_streak
    FROM habits h
    LEFT JOIN streaks s ON s.habit_id = h.id
    WHERE h.user_id = ? AND h.is_archived = 0
    ORDER BY h.sort_order
  `).all(userId)

  if (!habits.length) return 'This user has no habits set up yet.'

  const today = new Date().toISOString().slice(0, 10)
  const todayCheckins = db.prepare(
    'SELECT habit_id FROM checkins WHERE user_id = ? AND logical_date = ?'
  ).all(userId, new Date().toISOString().slice(0, 10)).map(r => r.habit_id)

  const lines = habits.map(h => {
    const done = todayCheckins.includes(h.id) ? '✅' : '⬜'
    const freq = h.frequency_config_json
      ? (() => { try { return JSON.parse(h.frequency_config_json) } catch { return {} } })()
      : {}
    const freqLabel = h.frequency_type === 'daily'
      ? 'daily'
      : h.frequency_type === 'weekly_count'
        ? `${freq.count || '?'}x/week`
        : h.frequency_type === 'weekly_days'
          ? `specific days/week`
          : h.frequency_type === 'monthly_count'
            ? `${freq.count || '?'}x/month`
            : h.frequency_type
    return `${done} ${h.name} (${h.difficulty}, ${freqLabel}) — streak: ${h.current_streak || 0} days, best: ${h.best_streak || 0} days`
  })

  return lines.join('\n')
}

// ─── Tool Execution ───────────────────────────────────────────────────────────

async function executeTool(toolName, toolArgs, userId) {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  if (toolName === 'get_habits') {
    const habits = db.prepare(`
      SELECT h.id, h.name, h.difficulty, h.frequency_type, h.frequency_config_json,
             s.current_streak, s.best_streak
      FROM habits h
      LEFT JOIN streaks s ON s.habit_id = h.id
      WHERE h.user_id = ? AND h.is_archived = 0
      ORDER BY h.sort_order
    `).all(userId)
    return habits.length ? habits : 'No habits found.'
  }

  if (toolName === 'get_todays_progress') {
    const habits = db.prepare(`
      SELECT h.id, h.name, h.difficulty FROM habits h
      WHERE h.user_id = ? AND h.is_archived = 0
    `).all(userId)
    const checkins = db.prepare(
      'SELECT habit_id FROM checkins WHERE user_id = ? AND logical_date = ?'
    ).all(userId, today).map(r => r.habit_id)
    return {
      date: today,
      completed: habits.filter(h => checkins.includes(h.id)).map(h => h.name),
      pending: habits.filter(h => !checkins.includes(h.id)).map(h => h.name),
      total: habits.length,
      completedCount: checkins.length
    }
  }

  if (toolName === 'get_streak_insights') {
    const habits = db.prepare(`
      SELECT h.id, h.name, h.frequency_type, s.current_streak, s.best_streak
      FROM habits h
      LEFT JOIN streaks s ON s.habit_id = h.id
      WHERE h.user_id = ? AND h.is_archived = 0
    `).all(userId)
    const checkins = db.prepare(
      'SELECT habit_id FROM checkins WHERE user_id = ? AND logical_date = ?'
    ).all(userId, today).map(r => r.habit_id)
    const atRisk = habits.filter(h =>
      (h.current_streak || 0) > 0 && !checkins.includes(h.id) && h.frequency_type === 'daily'
    )
    const best = [...habits].sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0)).slice(0, 3)
    return {
      atRisk: atRisk.map(h => ({ name: h.name, streak: h.current_streak })),
      topPerformers: best.map(h => ({ name: h.name, streak: h.current_streak, best: h.best_streak }))
    }
  }

  if (toolName === 'get_weekly_stats') {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const checkins = db.prepare(`
      SELECT habit_id, logical_date FROM checkins
      WHERE user_id = ? AND logical_date >= ? AND logical_date <= ?
    `).all(userId, weekStartStr, today)
    const habits = db.prepare(
      'SELECT id, name FROM habits WHERE user_id = ? AND is_archived = 0'
    ).all(userId)
    const byHabit = {}
    habits.forEach(h => { byHabit[h.name] = 0 })
    checkins.forEach(c => {
      const h = habits.find(h => h.id === c.habit_id)
      if (h) byHabit[h.name] = (byHabit[h.name] || 0) + 1
    })
    return { weekStart: weekStartStr, today, completionsByHabit: byHabit, totalCheckins: checkins.length }
  }

  if (toolName === 'log_checkins') {
    const { habit_names } = toolArgs
    const habits = db.prepare(
      'SELECT id, name FROM habits WHERE user_id = ? AND is_archived = 0'
    ).all(userId)
    const logged = []
    const notFound = []
    for (const requestedName of habit_names) {
      const match = habits.find(h =>
        h.name.toLowerCase().includes(requestedName.toLowerCase()) ||
        requestedName.toLowerCase().includes(h.name.toLowerCase())
      )
      if (match) {
        try {
          db.prepare(`
            INSERT INTO checkins (habit_id, user_id, logical_date, checked_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(habit_id, logical_date) DO UPDATE SET checked_at = CURRENT_TIMESTAMP
          `).run(match.id, userId, today)
          const { recalculateStreak } = require('./streakService')
          recalculateStreak(match.id)
          logged.push(match.name)
        } catch {
          notFound.push(requestedName)
        }
      } else {
        notFound.push(requestedName)
      }
    }
    return { logged, notFound, message: logged.length ? `Successfully logged: ${logged.join(', ')}` : 'No habits matched.' }
  }

  return { error: `Unknown tool: ${toolName}` }
}

async function executeToolCalls(toolCalls, userId) {
  const results = []
  for (const toolCall of toolCalls) {
    const args = JSON.parse(toolCall.function.arguments || '{}')
    const result = await executeTool(toolCall.function.name, args, userId)
    results.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result)
    })
  }
  return results
}

// ─── Coach: Single Persona Agentic Loop ──────────────────────────────────────

function buildPersonaPrompt(persona, habitContext, goal) {
  return `You are ${persona.name}. ${persona.identity}

Speak ONLY as ${persona.name} would — use their known phrases, philosophy, worldview, and speaking style.
Reference real facts from their life and known teachings when relevant.
Never say "As an AI" or break character. You ARE ${persona.name}.

The user's current habit tracking data:
${habitContext}

${goal ? `The user's stated goal: "${goal}"` : ''}

Be direct, specific, and reference their ACTUAL habit data when relevant. Never be generic.
When the user describes completing habits in natural language, use the log_checkins tool to record them.`
}

async function runCoach(userId, personaId, customPersona, goal, messages) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured. Please add it to your .env file.')
  }

  const persona = customPersona
    ? {
        name: customPersona,
        identity: `You are ${customPersona}, a legendary figure known for exceptional wisdom and achievement. Embody their known philosophy, speaking style, and worldview as authentically as possible.`
      }
    : PERSONAS[personaId]

  if (!persona) throw new Error(`Unknown persona: ${personaId}`)

  const habitContext = await getUserHabitContext(userId)
  const systemPrompt = buildPersonaPrompt(persona, habitContext, goal)
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  let iterations = 0
  while (iterations < 10) {
    iterations++
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      max_tokens: 1024
    })

    const choice = response.choices[0]

    if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
      return choice.message.content
    }

    fullMessages.push(choice.message)
    const results = await executeToolCalls(choice.message.tool_calls, userId)
    fullMessages.push(...results)
  }

  throw new Error('Agent loop exceeded maximum iterations')
}

// ─── Roundtable: Autonomous Multi-Persona Discussion ─────────────────────────

async function runRoundtable(userId, personaIds, topic, history) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured. Please add it to your .env file.')
  }

  const selectedPersonas = personaIds.map(id => PERSONAS[id]).filter(Boolean)
  if (selectedPersonas.length < 2) throw new Error('At least 2 personas are required for the Roundtable')

  const habitContext = await getUserHabitContext(userId)
  const names = selectedPersonas.map(p => p.name).join(', ')
  const personaDescriptions = selectedPersonas.map(p =>
    `- ${p.name}: ${p.identity.split('\n')[0]}`
  ).join('\n')

  const isExtension = history && history.length > 0
  const turnCount = isExtension ? 6 : 12

  let historyContext = ''
  if (isExtension) {
    const recent = history.slice(-8)
    historyContext = `\nPrevious discussion (continue from here):\n${
      recent.map(m => `${m.personaName || 'User'}: ${m.message}`).join('\n')
    }\n`
  }

  const systemPrompt = `You are generating an authentic, autonomous debate between legendary figures assembled at The Roundtable.

The legends present:
${personaDescriptions}

Each legend's persona:
${selectedPersonas.map(p => `\n=== ${p.name} ===\n${p.identity}`).join('\n')}

The user's habit data they are reviewing:
${habitContext}

${topic ? `The user's stated goal/topic: "${topic}"` : 'No specific topic — discuss the user\'s habit patterns and what they reveal about the user.'}
${historyContext}

CRITICAL INSTRUCTIONS:
1. The legends must talk TO EACH OTHER autonomously — they do NOT wait for user input
2. They should reference, challenge, and build on each other's points
3. They speak in their authentic voice and philosophy
4. They reference the user's REAL habit data specifically
5. Exactly 2-3 of the ${turnCount} turns should have "isAddressingUser": true — where a legend speaks directly to the user
6. Make it feel like a real, heated intellectual debate with substance

Generate exactly ${turnCount} turns of autonomous discussion.

Respond with ONLY a valid JSON array (no markdown, no extra text):
[
  { "personaId": "<id>", "message": "<authentic message in their voice>", "isAddressingUser": false },
  ...
]

Valid personaIds: ${personaIds.join(', ')}`

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: systemPrompt }],
    max_tokens: 4096,
    temperature: 0.85
  })

  const raw = response.choices[0].message.content.trim()

  // Extract JSON from the response (handle any surrounding text)
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Invalid roundtable response format')

  const turns = JSON.parse(jsonMatch[0])

  // Enrich with persona metadata
  return turns.map(turn => {
    const persona = PERSONAS[turn.personaId]
    return {
      ...turn,
      name: persona ? persona.name : turn.personaId,
      avatar: persona ? persona.avatar : '🎭',
      color: persona ? persona.color : '#64748b'
    }
  })
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  PERSONAS,
  runCoach,
  runRoundtable
}

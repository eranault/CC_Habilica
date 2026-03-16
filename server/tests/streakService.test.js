/**
 * Unit tests for streakService pure functions.
 * No HTTP server needed — tests the logic directly.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

// Set env before requiring modules that need it
process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'test-secret'

const { computeStreaks, offsetDate, isoWeek, dayDiff } = require('../services/streakService')

const T = '2026-03-16' // fixed "today" for deterministic tests

// ---------------------------------------------------------------------------
// dayDiff
// ---------------------------------------------------------------------------
describe('dayDiff', () => {
  it('returns positive for later > earlier', () => {
    assert.equal(dayDiff('2026-03-16', '2026-03-14'), 2)
  })
  it('returns 0 for same date', () => {
    assert.equal(dayDiff('2026-03-16', '2026-03-16'), 0)
  })
  it('returns negative for earlier > later', () => {
    assert.equal(dayDiff('2026-03-14', '2026-03-16'), -2)
  })
})

// ---------------------------------------------------------------------------
// offsetDate
// ---------------------------------------------------------------------------
describe('offsetDate', () => {
  it('offsets by positive days', () => {
    assert.equal(offsetDate('2026-03-14', 2), '2026-03-16')
  })
  it('offsets by negative days', () => {
    assert.equal(offsetDate('2026-03-16', -2), '2026-03-14')
  })
  it('crosses month boundary', () => {
    assert.equal(offsetDate('2026-03-01', -1), '2026-02-28')
  })
})

// ---------------------------------------------------------------------------
// isoWeek
// ---------------------------------------------------------------------------
describe('isoWeek', () => {
  it('same week dates share a key', () => {
    // 2026-W11: Mon 9 Mar — Sun 15 Mar
    assert.equal(isoWeek('2026-03-09'), isoWeek('2026-03-15'))
  })
  it('adjacent weeks differ', () => {
    assert.notEqual(isoWeek('2026-03-15'), isoWeek('2026-03-16'))
  })
})

// ---------------------------------------------------------------------------
// Daily streaks
// ---------------------------------------------------------------------------
describe('computeStreaks (daily)', () => {
  it('empty dates → 0 / 0', () => {
    const r = computeStreaks('daily', {}, [], 1)
    assert.deepEqual(r, { currentStreak: 0, bestStreak: 0 })
  })

  it('single recent date → 1 / 1', () => {
    const today = new Date().toISOString().slice(0, 10)
    const r = computeStreaks('daily', {}, [today], 1)
    assert.deepEqual(r, { currentStreak: 1, bestStreak: 1 })
  })

  it('consecutive days → streak equals count', () => {
    const dates = [0, 1, 2, 3, 4].map(n => offsetDate(T, -n)).reverse()
    const r = computeStreaks('daily', {}, dates, 0)
    assert.equal(r.currentStreak, 5)
    assert.equal(r.bestStreak, 5)
  })

  it('forgiveness_days=1 allows 1-day gap', () => {
    // Mon Tue _skip_ Thu Fri (Thu Fri are recent)
    const fri = new Date().toISOString().slice(0, 10)
    const dates = [4, 3, 1, 0].map(n => offsetDate(fri, -n)).reverse()
    const r = computeStreaks('daily', {}, dates, 1)
    assert.equal(r.currentStreak, 4)
  })

  it('forgiveness_days=0 breaks on any gap', () => {
    const dates = ['2026-03-10', '2026-03-12'] // gap of 2
    const r = computeStreaks('daily', {}, dates, 0)
    assert.equal(r.bestStreak, 1) // only runs of 1
  })

  it('stale dates (far in past) → current=0 but best preserved', () => {
    const oldDates = ['2025-01-01', '2025-01-02', '2025-01-03']
    const r = computeStreaks('daily', {}, oldDates, 1)
    assert.equal(r.currentStreak, 0)
    assert.equal(r.bestStreak, 3)
  })

  it('best streak beats a previous longer run', () => {
    // Old run of 5, recent run of 2
    const old = [0, 1, 2, 3, 4].map(n => offsetDate('2025-01-10', -n)).reverse()
    const recent = [0, 1].map(n => offsetDate(T, -n)).reverse()
    const dates = [...old, ...recent]
    const r = computeStreaks('daily', {}, dates, 0)
    assert.equal(r.bestStreak, 5)
    assert.equal(r.currentStreak, 2)
  })
})

// ---------------------------------------------------------------------------
// Weekly days streaks
// ---------------------------------------------------------------------------
describe('computeStreaks (weekly_days)', () => {
  it('hitting scheduled days builds streak', () => {
    // Schedule: Mon(1) Wed(3) — simulate 2 weeks of hits
    const config = { days: [1, 3] }
    // 2026-W10: Mon=Mar9, Wed=Mar11; 2026-W11: Mon=Mar16 (today)
    const dates = ['2026-03-09', '2026-03-11', '2026-03-16']
    const r = computeStreaks('weekly_days', config, dates, 0)
    assert.equal(r.currentStreak, 3)
    assert.equal(r.bestStreak, 3)
  })

  it('missing a scheduled day breaks streak with 0 forgiveness', () => {
    const config = { days: [1, 3, 5] } // Mon Wed Fri
    // Skip one Wed
    const dates = ['2026-03-09', '2026-03-13'] // Mon then Fri (skip Wed)
    const r = computeStreaks('weekly_days', config, dates, 0)
    assert.equal(r.bestStreak, 1)
  })

  it('forgiveness_days=1 allows one missed scheduled day', () => {
    const config = { days: [1, 3, 5] }
    // Skip Wed, hit Mon and Fri
    const dates = ['2026-03-09', '2026-03-13']
    const r = computeStreaks('weekly_days', config, dates, 1)
    assert.equal(r.currentStreak, 2)
  })
})

// ---------------------------------------------------------------------------
// Weekly count streaks
// Use a fixed `today` so tests don't depend on the real current date.
// Reference "today" = 2025-12-01 (Mon), well in the past.
// ---------------------------------------------------------------------------
describe('computeStreaks (weekly_count)', () => {
  // 2025-W47: Mon Nov 17 – Sun Nov 23
  // 2025-W48: Mon Nov 24 – Sun Nov 30
  // 2025-W49: Mon Dec 01 – (current week as of today=2025-12-01)
  const TODAY = '2025-12-01' // Monday = start of W49

  it('completed past week builds streak; current in-progress week not penalised', () => {
    const config = { count: 3 }
    // W47: 3 check-ins (met target)
    const w47 = ['2025-11-17', '2025-11-19', '2025-11-21']
    // W49 (current): 1 check-in (in progress, not finished)
    const w49 = ['2025-12-01']
    const r = computeStreaks('weekly_count', config, [...w47, ...w49], 0, TODAY)
    // W48 was skipped (0 check-ins), so streak from W47 = 1 (then W48 broke it)
    // W49 is current and excluded. Best=1, current=0 (W48 broke the run)
    assert.equal(r.bestStreak, 1)
    assert.equal(r.currentStreak, 0)
  })

  it('two consecutive full weeks → streak=2', () => {
    const config = { count: 2 }
    const dates = [
      '2025-11-17', '2025-11-19', // W47: 2 ✓
      '2025-11-24', '2025-11-26'  // W48: 2 ✓
    ]
    // W49 is current (empty) — excluded from scoring
    const r = computeStreaks('weekly_count', config, dates, 0, TODAY)
    assert.equal(r.currentStreak, 2)
    assert.equal(r.bestStreak, 2)
  })

  it('missing a week breaks streak with 0 forgiveness', () => {
    const config = { count: 2 }
    const dates = [
      '2025-11-10', '2025-11-12', // W46: 2 ✓
      // W47: skipped (0 check-ins)
      '2025-11-24', '2025-11-26'  // W48: 2 ✓
    ]
    const r = computeStreaks('weekly_count', config, dates, 0, TODAY)
    // Each "run" is only 1 week long (W47 gap breaks both)
    assert.equal(r.bestStreak, 1)
  })
})

// ---------------------------------------------------------------------------
// Monthly count streaks
// ---------------------------------------------------------------------------
describe('computeStreaks (monthly_count)', () => {
  it('meeting target each month builds streak', () => {
    const config = { count: 5 }
    const jan = ['2026-01-01','2026-01-05','2026-01-10','2026-01-15','2026-01-20']
    const feb = ['2026-02-01','2026-02-05','2026-02-10','2026-02-15','2026-02-20']
    const r = computeStreaks('monthly_count', config, [...jan, ...feb], 0)
    assert.equal(r.bestStreak, 2)
  })

  it('partial month does not break current streak', () => {
    const config = { count: 3 }
    const jan = ['2026-01-01','2026-01-02','2026-01-03']
    const mar = ['2026-03-01'] // in progress, only 1 of 3
    const r = computeStreaks('monthly_count', config, [...jan, ...mar], 0)
    // Jan met, Feb missed (breaks), Mar partial
    assert.equal(r.bestStreak, 1)
  })
})

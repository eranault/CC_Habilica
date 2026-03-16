import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { openDB } from 'idb'

// Precache all assets injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const OFFLINE_QUEUE_DB = 'streakr-offline-queue'
const QUEUE_STORE = 'checkins'

async function getQueue() {
  return openDB(OFFLINE_QUEUE_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

// API routes: network-first, cache fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.includes('/checkins'),
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 5 })
)

// Static assets: stale-while-revalidate
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({ cacheName: 'static-assets' })
)

// Intercept POST /api/checkins — queue if offline
self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method === 'POST' && new URL(request.url).pathname === '/api/checkins') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Offline — queue the check-in
        const body = await request.json()
        const db = await getQueue()
        await db.add(QUEUE_STORE, { ...body, queuedAt: Date.now() })

        // Notify clients about pending queue
        const clients = await self.clients.matchAll()
        clients.forEach(client => client.postMessage({ type: 'SYNC_PENDING' }))

        // Return a synthetic response so the app doesn't crash
        return new Response(
          JSON.stringify({ success: true, data: { ...body, offline: true }, error: null }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
  }
})

// Background sync: flush queue when back online
self.addEventListener('sync', async (event) => {
  if (event.tag === 'flush-checkins') {
    event.waitUntil(flushQueue())
  }
})

async function flushQueue() {
  const db = await getQueue()
  const pending = await db.getAll(QUEUE_STORE)

  if (pending.length === 0) return

  const clients = await self.clients.matchAll()

  for (const item of pending) {
    const { id, queuedAt, ...body } = item
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      if (res.ok) {
        await db.delete(QUEUE_STORE, id)
      }
    } catch {
      // Still offline — leave in queue
      return
    }
  }

  const remaining = await db.count(QUEUE_STORE)
  clients.forEach(client => client.postMessage({
    type: remaining === 0 ? 'SYNC_COMPLETE' : 'SYNC_PENDING',
    count: remaining
  }))
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return
  const { title, body, habitId } = event.data.json()

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `habit-${habitId}`,
      data: { habitId },
      actions: [
        { action: 'done', title: 'Done ✓' },
        { action: 'later', title: 'Remind later' }
      ]
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'done') {
    // Open app and auto-check-in for this habit
    event.waitUntil(
      self.clients.openWindow(`/?checkIn=${event.notification.data.habitId}`)
    )
  } else {
    event.waitUntil(self.clients.openWindow('/'))
  }
})

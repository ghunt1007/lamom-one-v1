// LAMOM ONE Service Worker v1.0
const CACHE_NAME = 'lamom-one-v1.0.68'
const STATIC_ASSETS = [
  '/',
]

// Install — cache static assets
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
})

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — network first, fallback cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip non-GET and external requests
  if (event.request.method !== 'GET') return
  if (!url.origin.includes(self.location.origin)) return
  // Skip Firebase API calls
  if (url.hostname.includes('firestore') || url.hostname.includes('firebase')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // Fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/').then(root => root || new Response('Offline', { status: 503 }))
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Push Notification support
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'LAMOM ONE แจ้งเตือน',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'เปิดดู' },
      { action: 'dismiss', title: 'ปิด' }
    ]
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'LAMOM ONE', options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})

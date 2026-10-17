const CACHE_VERSION = 'v3.3.0';
const APP_CACHE = `biblia-app-${CACHE_VERSION}`;
const DATA_CACHE = `biblia-data-${CACHE_VERSION}`;

// Core assets to pre-cache during installation
const CORE_ASSETS = [
    './',
    './index.html',
    './app.js',
    './offline.html',
    './manifest.json',
    './favicon.svg',
    './favicon.ico',
    './apple-touch-icon.png',
    './sancta.svg',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './screenshots/screenshot-mobile-home.png',
    './screenshots/screenshot-mobile-menu.png',
    './screenshots/screenshot-mobile-quote.png',
    './screenshots/screenshot-mobile-settings.png',
    './screenshots/screenshot-mobile-theme1.png',
    './screenshots/screenshot-desktop.png',
    
    // CDNs (Pre-cache core libraries for offline functionality)
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// URLs that the Service Worker should NOT interfere with
const IGNORE_URLS = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'google.com/recaptcha'
];

// --- INSTALL EVENT ---
// Pre-caches the App Shell (HTML, UI images, Manifest) with resilient per-asset caching
self.addEventListener('install', (event) => {
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(APP_CACHE).then(async (cache) => {
            console.log('[ServiceWorker] Pre-caching core assets');
            for (const asset of CORE_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('[ServiceWorker] Could not pre-cache asset:', asset, err);
                }
            }
        })
    );
});

// --- ACTIVATE EVENT ---
// Cleans up old caches when a new version is released
self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            return caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== APP_CACHE && cacheName !== DATA_CACHE) {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            });
        })
    );
});

// --- FETCH EVENT ---
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 1. BYPASS FIREBASE & AUTH REQUESTS
    // Let the browser handle Firebase requests natively to prevent auth/db sync issues.
    if (IGNORE_URLS.some(ignored => url.hostname.includes(ignored))) {
        return; 
    }

    // 2. PAGE NAVIGATION -> Network First, Fallback to cached index.html or offline.html
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((networkResponse) => {
                    return caches.open(APP_CACHE).then((cache) => {
                        cache.put(req, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(async () => {
                    console.log('[ServiceWorker] Serving cached app or offline page');
                    const cachedIndex = await caches.match('./index.html');
                    if (cachedIndex) return cachedIndex;
                    return caches.match('./offline.html');
                })
        );
        return;
    }

    // 3. BIBLE DATA (JSON APIs) -> Network First, Fallback to Cache
    // This allows users to read chapters offline if they have loaded them at least once.
    if (url.hostname === 'exanx.github.io' || url.hostname === 'bible-api.com') {
        event.respondWith(
            fetch(req)
                .then((networkResponse) => {
                    // Save the fetched chapter to the data cache
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(DATA_CACHE).then((cache) => {
                            cache.put(req, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // If offline, return the chapter from cache if it exists
                    return caches.match(req);
                })
        );
        return;
    }

    // 4. STATIC ASSETS (Images, Fonts, Icons inside app) -> Stale-While-Revalidate
    // Serve from cache immediately for speed, but update the cache in the background.
    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            const networkFetch = fetch(req).then((networkResponse) => {
                // Update cache dynamically with newly fetched assets
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                    caches.open(APP_CACHE).then((cache) => {
                        cache.put(req, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Ignore network errors on background updates
            });

            // Return cached response immediately if available, otherwise wait for network
            return cachedResponse || networkFetch;
        })
    );
});
```[cite: 1]
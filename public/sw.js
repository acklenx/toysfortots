// Service Worker for Toys for Tots
// Implements stale-while-revalidate strategy for fast, cached-first loading

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `toysfortots-${CACHE_VERSION}`;

// Resources to cache immediately on install
const STATIC_RESOURCES = [
	'/',
	'/index.html',
	'/css/style.min.css',
	'/js/loader.min.js',
	'/_header.html',
	'/_footer.html'
];

// Cache strategies
const CACHE_FIRST = [
	/\.css$/,
	/\.js$/,
	/\.woff2?$/,
	/\.png$/,
	/\.jpg$/,
	/\.webp$/
];

const STALE_WHILE_REVALIDATE = [
	/getLocationsCache/,
	/mock-locations-cache\.json/
];

// Install: Cache static resources
self.addEventListener('install', (event) => {
	console.log('[SW] Installing service worker...');
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log('[SW] Caching static resources');
			return cache.addAll(STATIC_RESOURCES);
		}).then(() => {
			console.log('[SW] Service worker installed, skipping waiting');
			return self.skipWaiting();
		})
	);
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating service worker...');
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name.startsWith('toysfortots-') && name !== CACHE_NAME)
					.map((name) => {
						console.log('[SW] Deleting old cache:', name);
						return caches.delete(name);
					})
			);
		}).then(() => {
			console.log('[SW] Service worker activated, claiming clients');
			return self.clients.claim();
		})
	);
});

// Fetch: Apply caching strategies
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip Chrome extensions and non-http(s) requests
	if (!url.protocol.startsWith('http')) {
		return;
	}

	// STRATEGY 1: Stale-While-Revalidate (for locations cache)
	// Serve from cache immediately, update in background
	if (STALE_WHILE_REVALIDATE.some((pattern) => pattern.test(url.href))) {
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) => {
				return cache.match(request).then((cachedResponse) => {
					const fetchPromise = fetch(request).then((networkResponse) => {
						// Update cache in background
						if (networkResponse && networkResponse.status === 200) {
							cache.put(request, networkResponse.clone());
						}
						return networkResponse;
					}).catch((error) => {
						console.warn('[SW] Network fetch failed:', error);
						return cachedResponse; // Fallback to cache if network fails
					});

					// Return cached response immediately, or wait for network
					return cachedResponse || fetchPromise;
				});
			})
		);
		return;
	}

	// STRATEGY 2: Cache-First (for static assets)
	// Try cache first, fall back to network
	if (CACHE_FIRST.some((pattern) => pattern.test(url.pathname))) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				if (cachedResponse) {
					return cachedResponse;
				}
				return fetch(request).then((networkResponse) => {
					if (networkResponse && networkResponse.status === 200) {
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(request, networkResponse.clone());
						});
					}
					return networkResponse;
				});
			})
		);
		return;
	}

	// STRATEGY 3: Network-First (default for everything else)
	// Try network first, fall back to cache only if offline
	event.respondWith(
		fetch(request).then((networkResponse) => {
			// Optionally cache successful responses
			if (networkResponse && networkResponse.status === 200) {
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(request, networkResponse.clone());
				});
			}
			return networkResponse;
		}).catch(() => {
			// If network fails, try cache
			return caches.match(request);
		})
	);
});

// Handle messages from clients
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		console.log('[SW] Received SKIP_WAITING message');
		self.skipWaiting();
	}

	if (event.data && event.data.type === 'CACHE_REFRESH') {
		console.log('[SW] Received CACHE_REFRESH request');
		// Force update the locations cache
		const cacheUrl = event.data.url || 'https://us-central1-toysfortots-eae4d.cloudfunctions.net/getLocationsCache';
		fetch(cacheUrl).then((response) => {
			if (response && response.status === 200) {
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(cacheUrl, response.clone());
					console.log('[SW] Cache refreshed');
				});
			}
		}).catch((error) => {
			console.error('[SW] Cache refresh failed:', error);
		});
	}
});

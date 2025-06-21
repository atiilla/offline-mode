const CACHE_NAME = 'job-queue-pwa-v10';
const STATIC_CACHE_NAME = 'job-queue-static-v10';
const CACHE_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const STATIC_ASSETS = [
  '/',
  '/submit',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/_next/static/media/'
];

// URLs to pre-cache for offline support
const URLS_TO_CACHE = [
  '/',
  '/submit'
];

// Cache management functions
function setCacheTimestamp() {
  try {
    // Use IndexedDB since localStorage is not available in service workers
    self.caches.open('cache-metadata').then(cache => {
      const response = new Response(JSON.stringify({ timestamp: Date.now() }));
      cache.put('cache-timestamp', response);
    });
  } catch (error) {
    console.log('Service Worker: Could not set cache timestamp');
  }
}

async function isCacheExpired() {
  try {
    const cache = await caches.open('cache-metadata');
    const response = await cache.match('cache-timestamp');
    if (!response) return true;
    
    const data = await response.json();
    return (Date.now() - data.timestamp) > CACHE_LIFETIME;
  } catch (error) {
    console.log('Service Worker: Could not check cache expiration, assuming expired');
    return true;
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('_next')));
      }),
      // Cache main pages
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching main pages');
        return cache.addAll(URLS_TO_CACHE);
      }),
      // Pre-cache critical CSS and JS files by fetching the main page
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        try {
          console.log('Service Worker: Pre-caching CSS and JS files');
          const response = await fetch('/');
          const html = await response.text();
          
          // Extract CSS and JS file URLs from the HTML
          const cssMatches = html.match(/\/_next\/static\/css\/[^"]+\.css[^"]*/g) || [];
          const jsMatches = html.match(/\/_next\/static\/chunks\/[^"]+\.js[^"]*/g) || [];
          
          // Cache CSS files
          for (const cssUrl of cssMatches) {
            try {
              const cssResponse = await fetch(cssUrl);
              if (cssResponse.ok) {
                await cache.put(cssUrl, cssResponse);
                console.log('Service Worker: Cached CSS:', cssUrl);
              }
            } catch (e) {
              console.log('Service Worker: Failed to cache CSS:', cssUrl);
            }
          }
          
          // Cache critical JS files
          for (const jsUrl of jsMatches.slice(0, 5)) { // Limit to first 5 JS files
            try {
              const jsResponse = await fetch(jsUrl);
              if (jsResponse.ok) {
                await cache.put(jsUrl, jsResponse);
                console.log('Service Worker: Cached JS:', jsUrl);
              }
            } catch (e) {
              console.log('Service Worker: Failed to cache JS:', jsUrl);
            }
          }
        } catch (error) {
          console.log('Service Worker: Could not pre-cache assets:', error);
        }
      })
    ]).then(() => {
      setCacheTimestamp();
      console.log('Service Worker: Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  const cacheWhitelist = [CACHE_NAME, STATIC_CACHE_NAME, 'cache-metadata', 'offline-forms'];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    }).then(() => {
      // Try to process offline forms when service worker activates
      console.log('Service Worker: Checking for offline forms to process...');
      processOfflineFormSubmissions();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  console.log('Service Worker: Fetch event:', request.method, url.pathname);
  
  // Skip external URLs
  if (!url.origin.includes(location.origin)) {
    console.log('Service Worker: Skipping external URL:', url.origin);
    return;
  }
  
  // Handle API requests (both GET and POST)
  if (url.pathname.startsWith('/api/')) {
    console.log('Service Worker: Handling API request:', request.method, url.pathname);
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // For non-GET requests that are not API calls, skip
  if (request.method !== 'GET') {
    console.log('Service Worker: Skipping non-GET request:', request.method, url.pathname);
    return;
  }
  
  // Handle Next.js assets (including CSS, JS, and other static files)
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(handleNextAssets(request));
    return;
  }
  
  // Handle navigation requests (pages)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  
  // Handle other static assets
  event.respondWith(handleStaticAssets(request));
});

// Check if device is online by attempting a quick network request
async function checkOnlineStatus() {
  // First check navigator.onLine if available
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('Service Worker: Navigator reports offline');
    return false;
  }
  
  try {
    // Use a very short timeout for quick determination
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
    
    const response = await fetch('/', { 
      method: 'HEAD',
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const isOnline = response.ok;
    console.log('Service Worker: Network connectivity test result:', isOnline, 'Status:', response.status);
    return isOnline;
  } catch (error) {
    // If the request fails or times out, we're likely offline
    console.log('Service Worker: Network connectivity test failed:', error.name);
    return false;
  }
}

// Handle API requests
async function handleApiRequest(request) {
  const url = new URL(request.url);
  console.log('Service Worker: handleApiRequest called for:', request.method, url.pathname);
  
  // ALWAYS handle form submissions offline-first
  if (url.pathname === '/api/submit' && request.method === 'POST') {
    console.log('Service Worker: Detected form submission - handling offline-first');
    
    // Try to get the form data first
    let formData;
    try {
      const requestClone = request.clone();
      const body = await requestClone.text();
      formData = JSON.parse(body);
      console.log('Service Worker: Successfully parsed form data:', formData);
    } catch (parseError) {
      console.error('Service Worker: Failed to parse form data:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid form data',
        message: 'Could not parse form submission'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if we can reach the network
    const isOnline = await checkOnlineStatus();
    console.log('Service Worker: Network status:', isOnline ? 'ONLINE' : 'OFFLINE');
    
    if (isOnline) {
      // Try to submit normally first
      try {
        console.log('Service Worker: Attempting online submission...');
        const response = await fetch(request);
        
        if (response.ok) {
          console.log('Service Worker: Online submission successful');
          return response;
        } else {
          console.log('Service Worker: Online submission failed, falling back to offline storage');
          return await storeOfflineFormSubmission(request);
        }
      } catch (networkError) {
        console.log('Service Worker: Network error during online submission, storing offline:', networkError.message);
        return await storeOfflineFormSubmission(request);
      }
    } else {
      // We're offline, store directly
      console.log('Service Worker: Device is offline, storing form directly');
      return await storeOfflineFormSubmission(request);
    }
  }
  
  // Handle other API requests normally
  try {
    const response = await fetch(request);
    if (response.ok) {
      console.log('Service Worker: API request successful:', url.pathname);
      // Only cache GET requests
      if (request.method === 'GET') {
        const responseClone = response.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, responseClone);
      }
    } else {
      console.log('Service Worker: API request failed with status:', response.status);
    }
    return response;
  } catch (error) {
    console.log('Service Worker: Network error for API request:', url.pathname, error.message);
    
    // Try to serve cached GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    return new Response(JSON.stringify({ 
      error: 'Offline - no cached data available',
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle Next.js assets
async function handleNextAssets(request) {
  const url = new URL(request.url);
  
  // For CSS files, try to match without query parameters first
  if (url.pathname.endsWith('.css')) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try to find any cached version of this CSS file (ignoring query params)
    const keys = await cache.keys();
    for (const key of keys) {
      const keyUrl = new URL(key.url);
      if (keyUrl.pathname === url.pathname && keyUrl.pathname.endsWith('.css')) {
        const cachedResponse = await cache.match(key);
        if (cachedResponse) {
          return cachedResponse;
        }
      }
    }
  }
  
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      setCacheTimestamp();
    }
    return response;
  } catch (error) {
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try to serve the root page for any navigation
    const rootPage = await caches.match('/');
    if (rootPage) {
      return rootPage;
    }
      // Fallback offline page
    return new Response(`
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <title>Offline - Job Queue PWA</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              padding: 1rem;
            }
            .container { 
              max-width: 400px; 
              width: 100%;
              margin: 0 auto; 
              background: rgba(255,255,255,0.1); 
              padding: 2rem; 
              border-radius: 16px; 
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255,255,255,0.2);
              text-align: center;
              box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }
            h1 { 
              margin-bottom: 1rem; 
              font-size: 2rem; 
              font-weight: 700;
            }
            p { 
              margin-bottom: 1.5rem; 
              opacity: 0.9; 
              line-height: 1.6; 
              font-size: 1rem;
            }
            .buttons { 
              display: flex; 
              gap: 1rem; 
              flex-direction: column; 
            }
            button { 
              background: rgba(255,255,255,0.2); 
              color: white; 
              border: 1px solid rgba(255,255,255,0.3);
              padding: 0.75rem 1.5rem; 
              border-radius: 8px; 
              cursor: pointer; 
              font-size: 1rem;
              font-weight: 500;
              transition: all 0.2s ease;
              text-decoration: none;
              display: inline-block;
            }
            button:hover { 
              background: rgba(255,255,255,0.3); 
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .offline-indicator {
              display: inline-block;
              width: 8px;
              height: 8px;
              background: #ef4444;
              border-radius: 50%;
              margin-right: 8px;
              animation: pulse 2s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            .status-bar {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: rgba(239, 68, 68, 0.9);
              color: white;
              padding: 0.5rem;
              text-align: center;
              font-size: 0.875rem;
              font-weight: 500;
              backdrop-filter: blur(10px);
            }
            @media (max-width: 480px) {
              .container { padding: 1.5rem; }
              h1 { font-size: 1.5rem; }
              button { padding: 0.625rem 1.25rem; }
            }
          </style>
        </head>
        <body>
          <div class="status-bar">
            <span class="offline-indicator"></span>
            Offline Mode - Limited Functionality Available
          </div>
          <div class="container">
            <h1>📱 Çevrimdışı</h1>
            <p>İnternet bağlantısı yok, ancak önbelleğe alınmış sayfaları kullanabilirsiniz.</p>
            <div class="buttons">
              <button onclick="window.location.href='/'">🏠 Ana Sayfa</button>
              <button onclick="window.location.href='/submit'">📝 Form Gönder</button>
              <button onclick="window.location.reload()">🔄 Yeniden Dene</button>
            </div>
          </div>
          <script>
            // Check connection status
            function updateOnlineStatus() {
              if (navigator.onLine) {
                window.location.reload();
              }
            }
            
            window.addEventListener('online', updateOnlineStatus);
            
            // Retry connection every 10 seconds
            setInterval(() => {
              if (navigator.onLine) {
                updateOnlineStatus();
              }
            }, 10000);
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// Handle static assets
async function handleStaticAssets(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Handle background sync (for offline form submissions)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered');
  
  if (event.tag === 'offline-form-sync') {
    event.waitUntil(processOfflineFormSubmissions());
  }
});

// Process offline form submissions
async function processOfflineFormSubmissions() {
  try {
    const cache = await caches.open('offline-forms');
    const requests = await cache.keys();
    
    console.log('Service Worker: Processing', requests.length, 'offline forms');
    
    for (const request of requests) {
      const url = new URL(request.url);
      
      // Handle both types of cache keys:
      // 1. /api/submit-offline/<jobId> (from service worker intercept)
      // 2. https://offline-job/<jobId> (from client message)
      if (url.pathname.includes('/api/submit-offline/') || url.pathname.includes('/offline-job/')) {
        try {
          const cachedResponse = await cache.match(request);
          if (!cachedResponse) continue;
          
          const cachedData = await cachedResponse.json();
          
          // Handle different response formats
          let offlineJob;
          if (cachedData.job) {
            // Format from service worker intercept
            offlineJob = cachedData.job;
          } else if (cachedData.id) {
            // Format from client message
            offlineJob = cachedData;
          } else {
            console.log('Service Worker: Invalid cached data format, skipping');
            continue;
          }
          
          if (!offlineJob || (offlineJob.attempts && offlineJob.attempts >= (offlineJob.maxAttempts || 3))) {
            console.log('Service Worker: Skipping job - max attempts reached');
            await cache.delete(request);
            continue;
          }
          
          console.log('Service Worker: Attempting to submit offline form:', offlineJob.id);
          
          // Try to submit the original form data
          const submitResponse = await fetch('/api/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(offlineJob.data),
          });
          
          if (submitResponse.ok) {
            const result = await submitResponse.json();
            console.log('Service Worker: Offline form submitted successfully:', result.job?.id);
            
            // Remove from offline cache
            await cache.delete(request);
            
            // Notify all clients
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
              client.postMessage({
                type: 'OFFLINE_FORM_SYNCED',
                offlineJobId: offlineJob.id,
                onlineJob: result.job
              });
            });
          } else {
            // Increment attempt count
            if (!offlineJob.attempts) offlineJob.attempts = 0;
            if (!offlineJob.maxAttempts) offlineJob.maxAttempts = 3;
            offlineJob.attempts++;
            
            console.log('Service Worker: Submit failed, attempt', offlineJob.attempts, 'of', offlineJob.maxAttempts);
            
            if (offlineJob.attempts < offlineJob.maxAttempts) {
              // Update cached request with new attempt count
              let updatedResponse;
              if (cachedData.job) {
                // Service worker format
                updatedResponse = new Response(JSON.stringify({
                  message: 'Form saved offline - will be submitted when back online',
                  job: offlineJob,
                  offline: true
                }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              } else {
                // Client message format
                updatedResponse = new Response(JSON.stringify(offlineJob), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              await cache.put(request, updatedResponse);
            } else {
              console.log('Service Worker: Max attempts reached, removing from cache');
              await cache.delete(request);
              
              // Notify clients of failure
              const clients = await self.clients.matchAll();
              clients.forEach(client => {
                client.postMessage({
                  type: 'OFFLINE_FORM_FAILED',
                  offlineJobId: offlineJob.id,
                  offlineJob: offlineJob
                });
              });
            }
          }
        } catch (error) {
          console.log('Service Worker: Error processing offline form:', error);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Error processing offline forms:', error);
  }
}

// Store offline form submissions
async function storeOfflineFormSubmission(request) {
  try {
    console.log('Service Worker: Attempting to store offline form submission');
    
    const cache = await caches.open('offline-forms');
    
    // Get form data from request
    let formData;
    try {
      const requestClone = request.clone();
      const body = await requestClone.text();
      console.log('Service Worker: Request body:', body);
      formData = JSON.parse(body);
      console.log('Service Worker: Parsed form data:', formData);
    } catch (parseError) {
      console.error('Service Worker: Failed to parse request body:', parseError);
      throw new Error('Invalid form data');
    }
    
    // Create offline job with unique ID
    const offlineJob = {
      id: 'offline-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'form-submission',
      data: formData,
      timestamp: new Date().toISOString(),
      status: 'offline',
      attempts: 0,
      maxAttempts: 3
    };
    
    console.log('Service Worker: Created offline job:', offlineJob);
      // Store in cache with a unique key (use GET method for cache compatibility)
    const cacheKey = new Request('/api/submit-offline/' + offlineJob.id, {
      method: 'GET',  // Cache API only supports GET requests
      headers: { 'Content-Type': 'application/json' }
    });
    
    const offlineResponse = new Response(JSON.stringify({
      message: 'Form saved offline - will be submitted when back online',
      job: offlineJob,
      offline: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
    await cache.put(cacheKey, offlineResponse.clone());
    console.log('Service Worker: Stored offline form in cache with ID:', offlineJob.id);
    
    // Register for background sync if available
    try {
      await self.registration.sync.register('offline-form-sync');
      console.log('Service Worker: Background sync registered');
    } catch (syncError) {
      console.log('Service Worker: Background sync not supported:', syncError.message);
    }
    
    // Send message to all clients to update their localStorage
    const clients = await self.clients.matchAll();
    console.log('Service Worker: Notifying', clients.length, 'clients about offline form');
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_FORM_STORED',
        job: offlineJob
      });
    });
    
    return offlineResponse;
  } catch (error) {
    console.error('Service Worker: Error storing offline form:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to store offline form: ' + error.message,
      message: 'Please try again when back online'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle push notifications (optional)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
    const options = {
    body: event.data ? event.data.text() : 'Job processing completed!',
    icon: '/icon-192.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/icon-192.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Job Queue PWA', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/submit')
    );
  }
});

// Handle background sync events
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync event triggered:', event.tag);
  
  if (event.tag === 'background-sync-forms') {
    console.log('Service Worker: Processing background sync for forms...');
    event.waitUntil(
      processOfflineFormSubmissions().then(() => {
        console.log('Service Worker: Background sync for forms completed');
      }).catch(error => {
        console.error('Service Worker: Background sync for forms failed:', error);
      })
    );
  }
});

// Handle messages from clients
self.addEventListener('message', async (event) => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data?.type === 'PROCESS_OFFLINE_FORMS') {
    console.log('Service Worker: Manual offline form processing requested');
    await processOfflineFormSubmissions();
  } else if (event.data?.type === 'SYNC_OFFLINE_JOBS') {
    console.log('Service Worker: Client requested sync of offline jobs');
    await processOfflineFormSubmissions();
  } else if (event.data?.type === 'STORE_OFFLINE_FORM') {
    console.log('Service Worker: Storing offline form from client...');
    
    const { jobId, formData, timestamp } = event.data.data;
    
    try {
      // Store in the offline-forms cache
      const cache = await caches.open('offline-forms');
      const cacheKey = `https://offline-job/${jobId}`;
      
      const jobResponse = new Response(JSON.stringify({
        id: jobId,
        data: formData,
        status: 'pending',
        createdAt: new Date(timestamp).toISOString(),
        offline: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      await cache.put(cacheKey, jobResponse);
      console.log('Service Worker: Offline form stored in cache:', jobId);
      
      // Notify client of successful storage
      event.ports[0]?.postMessage({
        type: 'OFFLINE_FORM_STORED',
        jobId: jobId
      });
      
    } catch (error) {
      console.error('Service Worker: Failed to store offline form:', error);
      event.ports[0]?.postMessage({
        type: 'OFFLINE_FORM_ERROR',
        error: error.message
      });
    }
  }
});

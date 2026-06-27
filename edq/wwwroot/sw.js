const CACHE_NAME = 'edq-cache-v13';

// Recursos estáticos que se cachean al instalar el Service Worker
const STATIC_ASSETS = [
  '/css/site.css',
  '/images/logo_navbar.svg',
  '/images/logo_appicon.svg',
  '/fonts/outfit-latin.woff2',
  '/fonts/outfit-latin-ext.woff2',
  '/fonts/inter-300.woff2',
  '/fonts/inter-400.woff2',
  '/fonts/inter-500.woff2',
  '/fonts/inter-600.woff2',
  '/fonts/inter-700.woff2'
];

const OFFLINE_URL = '/Home/Offline';

const CACHEABLE_PAGES = [
  '/Account/Profile',
  '/Group/Explore',
  '/Group/Chat'
];

const API_PREFIXES = [
  '/Match/',
  '/Group/GetGroups',
  '/Group/GetGroupDashboardData',
  '/Group/GetMatchHistory',
  '/Group/JoinRequest',
  '/Group/CreateGroup',
  '/Chat/GetMessages',
  '/Chat/CreatePoll',
  '/Chat/Vote',
  '/Push/',
  '/Account/UpdateNickname',
  '/Account/UpdatePhoto',
  '/Account/UpdateNotificationSettings',
  '/Account/Login',
  '/Account/Register',
  '/Account/Logout'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
      caches.open(CACHE_NAME).then(async cache => {
        await cache.addAll(STATIC_ASSETS).catch(err => console.warn('Static assets cache error:', err));

        try {
          const offlineReq = new Request(OFFLINE_URL, { credentials: 'same-origin' });
          const offlineRes = await fetch(offlineReq);
          if (offlineRes.ok)
            await cache.put(OFFLINE_URL, offlineRes);
          else
            console.warn('Offline page returned status:', offlineRes.status);
        } catch (err) {
          console.warn('Could not pre-cache offline page:', err);
        }
      })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(
            keys.map(key => {
              if (key !== CACHE_NAME) {
                return caches.delete(key);
              }
            })
        );
      })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin))
    return;

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  const isApiCall = API_PREFIXES.some(prefix => pathname.startsWith(prefix))
      || url.search.length > 0 && !CACHEABLE_PAGES.includes(pathname);
  if (isApiCall)
    return;

  const isCacheablePage = CACHEABLE_PAGES.some(page => pathname.startsWith(page));
  if (isCacheablePage) {
    event.respondWith(
        fetch(event.request)
            .then(response => {
              if (response && response.status === 200 && response.type === 'basic') {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
              }
              return response;
            })
            .catch(() =>
                caches.match(event.request, { ignoreSearch: true }).then(cached =>
                    cached || caches.match('/Home/Offline')
                )
            )
    );
    return;
  } // <-- FIX 1: Added missing closing brace for 'if (isCacheablePage)'

  const isHtml = event.request.headers.get('Accept')?.includes('text/html');
  if (isHtml) {
    event.respondWith(
        fetch(event.request).catch(() => caches.match('/Home/Offline'))
    );
    return;
  }

  event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        if (cached)
          return cached;
        return fetch(event.request)
            .then(response => {
              if (response && response.status === 200 && response.type === 'basic') {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
              }
              return response;
            })
            .catch(() => {
              if (event.request.headers.get('Accept')?.includes('text/html'))
                return caches.match('/Home/Offline');
            });
      })
  );
}); // <-- FIX 2: Changed from }; to }); to properly close the event listener

// Push Event
self.addEventListener('push', event => {
  let data = { title: 'EDQ', body: 'Nueva notificación' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'EDQ', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/images/logo_appicon.svg',
    badge: '/images/logo_navbar.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  if (self.clients) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          title: data.title,
          body: data.body,
          url: data.url || '/'
        });
      });
    });
  }

  event.waitUntil(
      self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => client.navigate(urlToOpen));
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
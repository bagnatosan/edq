const CACHE_NAME = 'edq-cache-v1';
const ASSETS = [
  '/',
  '/css/site.css',
  '/images/logo_navbar.svg',
  '/images/logo_appicon.svg'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cargar archivos esenciales de manera pasiva, permitiendo que falle si alguno no está disponible
      return cache.addAll(ASSETS).catch(err => console.warn('Cache assets error:', err));
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

// Fetch Event (Network first, then fallback to cache)
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET del mismo origen
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Evitar cachear llamadas AJAX, controladores o APIs
  const url = event.request.url;
  if (url.includes('/Get') || url.includes('/Group/') || url.includes('/Match/') || url.includes('/Account/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar la respuesta para guardarla en cache si es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push Event listener to show background notifications
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

  // Enviar mensaje a todas las pestañas abiertas para actualizar la campana en tiempo real
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
      // Si ya hay una pestaña abierta con el mismo origen, enfocarla y navegar
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(urlToOpen));
        }
      }
      // Si no, abrir una nueva pestaña
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

const CACHE_NAME = 'edq-cache-v2';

// Recursos estáticos que se cachean al instalar el Service Worker
const STATIC_ASSETS = [
  '/css/site.css',
  '/images/logo_navbar.svg',
  '/images/logo_appicon.svg'
];

// Páginas HTML completas que se cachean dinámicamente con estrategia Network-First
const CACHEABLE_PAGES = [
  '/Account/Profile',
  '/Group/Explore',
  '/Group/Chat'
];

// Prefijos de rutas de API/datos que NUNCA se cachean (cambian por usuario/momento)
const API_PREFIXES = [
  '/Group/GetGroups',
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

// Install Event: cachear recursos estáticos esenciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(err => console.warn('Cache assets error:', err))
    )
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

// Fetch Event: estrategia diferenciada según tipo de recurso
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET del mismo origen
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin))
    return;

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Nunca cachear rutas de API/datos (tienen parámetros dinámicos o mutan estado)
  const isApiCall = API_PREFIXES.some(prefix => pathname.startsWith(prefix))
    || url.search.length > 0 && !CACHEABLE_PAGES.includes(pathname);
  if (isApiCall)
    return;

  // Para páginas HTML cacheables: Network-First con fallback al caché
  // Si el servidor responde, actualiza el caché. Si no hay red, sirve el caché.
  const isCacheablePage = CACHEABLE_PAGES.some(page => pathname.startsWith(page));
  if (isCacheablePage) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Guardar la página fresca en caché si la respuesta es correcta
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          // Sin red: servir la versión cacheada de la página
          caches.match(event.request)
        )
    );
    return;
  }

  // Para recursos estáticos (CSS, JS, imágenes): Cache-First con fallback a red
  // Si el recurso ya está cacheado, lo sirve instantáneamente sin ir a la red.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached)
        return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
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

const CACHE_NAME = 'edq-cache-v5';

// Recursos estáticos que se cachean al instalar el Service Worker
const STATIC_ASSETS = [
  '/css/site.css',
  '/images/logo_navbar.svg',
  '/images/logo_appicon.svg',
  // Fuentes auto-hospedadas — cacheadas para funcionar offline
  '/fonts/outfit-latin.woff2',
  '/fonts/outfit-latin-ext.woff2',
  '/fonts/inter-300.woff2',
  '/fonts/inter-400.woff2',
  '/fonts/inter-500.woff2',
  '/fonts/inter-600.woff2',
  '/fonts/inter-700.woff2'
];

// URL de la página "sin conexión" (se cachea por separado del resto)
const OFFLINE_URL = '/Home/Offline';

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

// Install Event: cachear recursos estáticos + página offline por separado
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Cachear assets estáticos (CSS, imágenes)
      await cache.addAll(STATIC_ASSETS).catch(err => console.warn('Static assets cache error:', err));

      // 2. Cachear la página offline por separado con su propio try/catch
      //    Se hace así porque addAll() falla silenciosamente si un item da error,
      //    y queremos saber específicamente si /Home/Offline no se pudo cachear.
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
  // Si no hay red ni caché, muestra la página de "sin conexión".
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
          // Sin red: intentar caché propio, sino mostrar página offline
          caches.match(event.request).then(cached =>
            cached || caches.match('/Home/Offline')
          )
        )
    );
    return;
  }

  // Para recursos estáticos (CSS, JS, imágenes): Cache-First con fallback a red
  // Si el recurso ya está cacheado, lo sirve instantáneamente sin ir a la red.
  // Si no hay red ni caché (ej: una página de navegación desconocida), muestra offline.
  event.respondWith(
    caches.match(event.request).then(cached => {
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
          // Sin red y sin caché: si es navegación HTML, mostrar página offline
          if (event.request.headers.get('Accept')?.includes('text/html'))
            return caches.match('/Home/Offline');
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

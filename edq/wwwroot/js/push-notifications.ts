// Helper to convert base64 to Uint8Array for VAPID key
function urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function initPushNotifications(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported in this browser.');
        return;
    }

    try {
        const reg = await navigator.serviceWorker.ready;
        
        // 1. Obtener la clave pública VAPID desde el backend
        const keyResponse = await fetch('/Push/PublicKey');
        if (!keyResponse.ok) {
            console.warn('Could not retrieve VAPID public key.');
            return;
        }
        const vapidPublicKey = await keyResponse.text();
        if (!vapidPublicKey) return;

        // 2. Solicitar permiso de notificación
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Notification permission denied.');
            return;
        }

        // 3. Verificar si ya existe suscripción
        let subscription = await reg.pushManager.getSubscription();

        if (!subscription) {
            // Suscribir al usuario
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(vapidPublicKey) as any
            });
        }

        // 4. Enviar la suscripción al backend
        const subJson = subscription.toJSON();
        
        // Extraer claves seguras
        const p256dh = subJson.keys?.p256dh;
        const auth = subJson.keys?.auth;

        if (!subscription.endpoint || !p256dh || !auth) {
            console.error('Invalid push subscription structure.');
            return;
        }

        const response = await fetch('/Push/Subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getAntiForgeryToken()
            },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: p256dh,
                auth: auth
            })
        });

        if (response.ok) {
            console.log('Successfully registered for Push Notifications!');
        } else {
            console.error('Failed to register subscription on server.');
        }

    } catch (err) {
        console.error('Error during Push Notification setup:', err);
    }
}

// Anti forgery token helper
function getAntiForgeryToken(): string {
    const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
    return tokenInput ? tokenInput.value : "";
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar si el usuario está autenticado (existe campana en header)
    const isAuth = document.querySelector('.app-header-right') !== null;
    if (isAuth) {
        initPushNotifications();
    }
});

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Helper to convert base64 to Uint8Array for VAPID key
function urlB64ToUint8Array(base64String) {
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
function initPushNotifications() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported in this browser.');
            return;
        }
        try {
            const reg = yield navigator.serviceWorker.ready;
            // 1. Obtener la clave pública VAPID desde el backend
            const keyResponse = yield fetch('/Push/PublicKey');
            if (!keyResponse.ok) {
                console.warn('Could not retrieve VAPID public key.');
                return;
            }
            const vapidPublicKey = yield keyResponse.text();
            if (!vapidPublicKey)
                return;
            // 2. Solicitar permiso de notificación
            const permission = yield Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied.');
                return;
            }
            // 3. Verificar si ya existe suscripción
            let subscription = yield reg.pushManager.getSubscription();
            if (!subscription) {
                // Suscribir al usuario
                subscription = yield reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
                });
            }
            // 4. Enviar la suscripción al backend
            const subJson = subscription.toJSON();
            // Extraer claves seguras
            const p256dh = (_a = subJson.keys) === null || _a === void 0 ? void 0 : _a.p256dh;
            const auth = (_b = subJson.keys) === null || _b === void 0 ? void 0 : _b.auth;
            if (!subscription.endpoint || !p256dh || !auth) {
                console.error('Invalid push subscription structure.');
                return;
            }
            const response = yield fetch('/Push/Subscribe', {
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
            }
            else {
                console.error('Failed to register subscription on server.');
            }
        }
        catch (err) {
            console.error('Error during Push Notification setup:', err);
        }
    });
}
// Anti forgery token helper
function getAntiForgeryToken() {
    const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
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

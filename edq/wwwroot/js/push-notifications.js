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
// Interface y funciones de notificaciones In-App en LocalStorage
function getInAppNotifications() {
    try {
        const data = localStorage.getItem("inapp_notifications");
        return data ? JSON.parse(data) : [];
    }
    catch (e) {
        return [];
    }
}
function saveInAppNotifications(notifications) {
    localStorage.setItem("inapp_notifications", JSON.stringify(notifications));
}
function addInAppNotification(title, body, url) {
    const notifications = getInAppNotifications();
    const newNotif = {
        id: Math.random().toString(36).substring(2, 11),
        title: title,
        body: body,
        url: url,
        timestamp: Date.now(),
        read: false
    };
    notifications.unshift(newNotif);
    saveInAppNotifications(notifications);
    updateNotificationBadge();
    renderNotificationsList();
}
function updateNotificationBadge() {
    const badge = document.getElementById("notificationBadge");
    if (!badge)
        return;
    const notifications = getInAppNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount.toString();
        badge.style.display = "flex";
    }
    else {
        badge.style.display = "none";
    }
}
function renderNotificationsList() {
    const listContainer = document.getElementById("notificationsDropdownList");
    if (!listContainer)
        return;
    const notifications = getInAppNotifications();
    if (notifications.length === 0) {
        listContainer.innerHTML = '<div class="notifications-empty">No tienes notificaciones</div>';
        return;
    }
    listContainer.innerHTML = "";
    notifications.forEach(n => {
        const item = document.createElement("a");
        item.href = n.url;
        item.className = "notifications-dropdown-item";
        item.innerHTML = `
            <div class="notification-item-title">${escapeHtml(n.title)}</div>
            <div class="notification-item-body">${escapeHtml(n.body)}</div>
        `;
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const currentNotifs = getInAppNotifications();
            const index = currentNotifs.findIndex(notif => notif.id === n.id);
            if (index !== -1) {
                currentNotifs.splice(index, 1);
                saveInAppNotifications(currentNotifs);
            }
            window.location.href = n.url;
        });
        listContainer.appendChild(item);
    });
}
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function initNotificationsDropdown() {
    const toggleBtn = document.getElementById("btnNotificationsToggle");
    const dropdown = document.getElementById("notificationsDropdown");
    const clearBtn = document.getElementById("btnClearNotifications");
    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
            if (dropdown.classList.contains("show")) {
                const notifications = getInAppNotifications();
                notifications.forEach(n => n.read = true);
                saveInAppNotifications(notifications);
                updateNotificationBadge();
                renderNotificationsList();
            }
        });
        document.addEventListener("click", (e) => {
            if (dropdown && !dropdown.contains(e.target) && e.target !== toggleBtn) {
                dropdown.classList.remove("show");
            }
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            saveInAppNotifications([]);
            updateNotificationBadge();
            renderNotificationsList();
        });
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'PUSH_RECEIVED') {
                const { title, body, url } = event.data;
                addInAppNotification(title, body, url);
            }
        });
    }
    updateNotificationBadge();
    renderNotificationsList();
}
// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    const isAuth = document.getElementById('btnNotificationsToggle') !== null;
    if (isAuth) {
        initPushNotifications();
        initNotificationsDropdown();
    }
});

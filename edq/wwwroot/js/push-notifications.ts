(() => {
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

// Interface y funciones de notificaciones In-App en LocalStorage
interface InAppNotification {
    id: string;
    title: string;
    body: string;
    url: string;
    timestamp: number;
    read: boolean;
}

function getInAppNotifications(): InAppNotification[] {
    try {
        const data = localStorage.getItem("inapp_notifications");
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveInAppNotifications(notifications: InAppNotification[]): void {
    localStorage.setItem("inapp_notifications", JSON.stringify(notifications));
}

function addInAppNotification(title: string, body: string, url: string): void {
    const notifications = getInAppNotifications();
    const existingIndex = notifications.findIndex(n => n.url === url);

    if (existingIndex !== -1) {
        // Actualizar la notificación existente para no duplicar
        notifications[existingIndex].title = title;
        notifications[existingIndex].body = body;
        notifications[existingIndex].timestamp = Date.now();
        notifications[existingIndex].read = false;
        
        // Mover al inicio de la lista
        const [item] = notifications.splice(existingIndex, 1);
        notifications.unshift(item);
    } else {
        const newNotif: InAppNotification = {
            id: Math.random().toString(36).substring(2, 11),
            title,
            body,
            url,
            timestamp: Date.now(),
            read: false
        };
        notifications.unshift(newNotif); // Añadir al inicio
    }
    saveInAppNotifications(notifications);
    updateNotificationBadge();
    renderNotificationsList();
}

function updateNotificationBadge(): void {
    const badge = document.getElementById("notificationBadge");
    if (!badge) return;
    const notifications = getInAppNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount.toString();
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

function renderNotificationsList(): void {
    const listContainer = document.getElementById("notificationsDropdownList");
    if (!listContainer) return;
    
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

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function initNotificationsDropdown(): void {
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
            if (dropdown && !dropdown.contains(e.target as Node) && e.target !== toggleBtn) {
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
        initPushNotifications().catch(err => console.error('Error:', err));
        initNotificationsDropdown();
    }
});
})();

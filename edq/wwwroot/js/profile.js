"use strict";
document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const btnEditPhoto = document.getElementById("btnEditPhoto");
    const filePhotoInput = document.getElementById("filePhotoInput");
    const profileAvatarContainer = document.getElementById("profileAvatarContainer");
    const btnModificarApodo = document.getElementById("btnModificarApodo");
    const modalApodoBackdrop = document.getElementById("modalApodoBackdrop");
    const btnCancelApodo = document.getElementById("btnCancelApodo");
    const btnSaveApodo = document.getElementById("btnSaveApodo");
    const inputNickname = document.getElementById("inputNickname");
    const errorApodo = document.getElementById("errorApodo");
    const txtNickname = document.getElementById("txtNickname");
    const switchNotifications = document.getElementById("switchNotifications");
    // Helper: Anti forgery token
    function getVerificationToken() {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    }
    // Helper: URL Base64 to Uint8Array
    function b64ToUint8(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    // Helper: Show styled toast notifications
    const showToast = (message, isError = false) => {
        const toast = document.createElement("div");
        toast.className = `toast-notification ${isError ? 'toast-error' : 'toast-success'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        // Trigger reflow
        toast.offsetHeight;
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };
    // ==========================================
    // 1. GESTIÓN DE FOTO DE PERFIL
    // ==========================================
    if (btnEditPhoto && filePhotoInput && profileAvatarContainer) {
        btnEditPhoto.addEventListener("click", () => {
            filePhotoInput.click();
        });
        filePhotoInput.addEventListener("change", async () => {
            if (!filePhotoInput.files || filePhotoInput.files.length === 0)
                return;
            const file = filePhotoInput.files[0];
            const formData = new FormData();
            formData.append("photo", file);
            try {
                const response = await fetch("/Account/UpdatePhoto", {
                    method: "POST",
                    headers: {
                        "RequestVerificationToken": getVerificationToken()
                    },
                    body: formData
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.photoUrl) {
                        // Actualizar contenedor
                        profileAvatarContainer.innerHTML = `<img src="${data.photoUrl}" alt="Foto de perfil" class="profile-avatar-img" id="profileAvatarImg" />`;
                    }
                }
                else {
                    const errData = await response.json();
                    showToast(errData.message || "Error al actualizar la foto de perfil.", true);
                }
            }
            catch (err) {
                console.error("Error al subir foto:", err);
                showToast("Ocurrió un error al subir la imagen.", true);
            }
            finally {
                filePhotoInput.value = ""; // Limpiar
            }
        });
    }
    // ==========================================
    // 2. MODIFICAR APODO (MODAL)
    // ==========================================
    if (btnModificarApodo && modalApodoBackdrop && btnCancelApodo && btnSaveApodo && inputNickname && txtNickname) {
        btnModificarApodo.addEventListener("click", () => {
            if (errorApodo)
                errorApodo.textContent = "";
            modalApodoBackdrop.classList.add("show");
            inputNickname.focus();
        });
        const closeModal = () => {
            modalApodoBackdrop.classList.remove("show");
        };
        btnCancelApodo.addEventListener("click", closeModal);
        modalApodoBackdrop.addEventListener("click", (e) => {
            if (e.target === modalApodoBackdrop) {
                closeModal();
            }
        });
        btnSaveApodo.addEventListener("click", async () => {
            const nick = inputNickname.value.trim();
            if (errorApodo)
                errorApodo.textContent = "";
            if (!nick) {
                if (errorApodo)
                    errorApodo.textContent = "El apodo no puede estar vacío.";
                return;
            }
            if (nick.length > 20) {
                if (errorApodo)
                    errorApodo.textContent = "El apodo no puede superar los 20 caracteres.";
                return;
            }
            try {
                const response = await fetch("/Account/UpdateNickname", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getVerificationToken()
                    },
                    body: JSON.stringify({ nickname: nick })
                });
                if (response.ok) {
                    const data = await response.json();
                    txtNickname.textContent = data.nickname;
                    // Asegurar que la insignia refleje si tiene o no apodo en el badge
                    const parentBadge = txtNickname.parentElement;
                    if (parentBadge) {
                        parentBadge.className = "profile-nickname-badge";
                    }
                    closeModal();
                }
                else {
                    const errData = await response.json();
                    if (errorApodo)
                        errorApodo.textContent = errData.message || "Error al actualizar el apodo.";
                }
            }
            catch (err) {
                console.error("Error al actualizar apodo:", err);
                if (errorApodo)
                    errorApodo.textContent = "Error de red al actualizar el apodo.";
            }
        });
    }
    // ==========================================
    // 3. ADMINISTRAR NOTIFICACIONES PUSH
    // ==========================================
    if (switchNotifications) {
        const updateSettingsButtonVisibility = (active) => {
            const btn = document.getElementById("btnConfigurarNotificaciones");
            if (btn) {
                btn.style.display = active ? "flex" : "none";
            }
        };
        const setupPushSwitch = async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                switchNotifications.disabled = true;
                const switchParent = switchNotifications.closest(".profile-option-item");
                if (switchParent) {
                    switchParent.style.opacity = "0.5";
                }
                return;
            }
            try {
                const reg = await navigator.serviceWorker.ready;
                const subscription = await reg.pushManager.getSubscription();
                switchNotifications.checked = !!subscription;
                updateSettingsButtonVisibility(!!subscription);
                switchNotifications.addEventListener("change", async () => {
                    var _a, _b;
                    const shouldSubscribe = switchNotifications.checked;
                    if (shouldSubscribe) {
                        // Solicitar permiso
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            showToast("Permiso de notificaciones denegado. Habilítalo en los ajustes del navegador.", true);
                            switchNotifications.checked = false;
                            updateSettingsButtonVisibility(false);
                            return;
                        }
                        // Obtener clave VAPID pública
                        const keyResponse = await fetch('/Push/PublicKey');
                        if (!keyResponse.ok) {
                            showToast("No se pudo obtener la clave del servidor push.", true);
                            switchNotifications.checked = false;
                            updateSettingsButtonVisibility(false);
                            return;
                        }
                        const vapidKey = await keyResponse.text();
                        if (!vapidKey) {
                            switchNotifications.checked = false;
                            updateSettingsButtonVisibility(false);
                            return;
                        }
                        // Suscribir
                        try {
                            const sub = await reg.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: b64ToUint8(vapidKey)
                            });
                            const subJson = sub.toJSON();
                            const p256dh = (_a = subJson.keys) === null || _a === void 0 ? void 0 : _a.p256dh;
                            const auth = (_b = subJson.keys) === null || _b === void 0 ? void 0 : _b.auth;
                            if (!sub.endpoint || !p256dh || !auth) {
                                console.error("Suscripción inválida obtenida del navegador.");
                                showToast("Suscripción inválida obtenida del navegador.", true);
                                return; // Cortamos ejecución localmente
                            }
                            // Enviar al servidor
                            const regResponse = await fetch('/Push/Subscribe', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'RequestVerificationToken': getVerificationToken()
                                },
                                body: JSON.stringify({
                                    endpoint: sub.endpoint,
                                    p256dh: p256dh,
                                    auth: auth
                                })
                            });
                            if (!regResponse.ok) {
                                console.error("Error en Push/Subscribe: El servidor rechazó el registro.");
                                showToast("El servidor rechazó el registro de la suscripción.", true);
                                return; // Cortamos ejecución localmente
                            }
                            updateSettingsButtonVisibility(true);
                        }
                        catch (subErr) {
                            console.error("Error al suscribirse:", subErr);
                            // Deshacer local
                            const currentSub = await reg.pushManager.getSubscription();
                            if (currentSub) {
                                await currentSub.unsubscribe();
                            }
                            switchNotifications.checked = false;
                            updateSettingsButtonVisibility(false);
                            showToast("Error al activar las notificaciones push en el servidor.", true);
                        }
                    }
                    else {
                        // Desuscribir
                        try {
                            const sub = await reg.pushManager.getSubscription();
                            if (sub) {
                                // Informar al servidor
                                await fetch('/Push/Unsubscribe', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'RequestVerificationToken': getVerificationToken()
                                    },
                                    body: JSON.stringify({
                                        endpoint: sub.endpoint
                                    })
                                });
                                // Desuscribir en el navegador
                                await sub.unsubscribe();
                            }
                            updateSettingsButtonVisibility(false);
                        }
                        catch (unsubErr) {
                            console.error("Error al desuscribirse:", unsubErr);
                            showToast("Ocurrió un error al desactivar las notificaciones push.", true);
                            // Revertir estado switch
                            switchNotifications.checked = true;
                            updateSettingsButtonVisibility(true);
                        }
                    }
                });
            }
            catch (err) {
                console.error("Error al inicializar interruptor de notificaciones:", err);
                switchNotifications.disabled = true;
            }
        };
        setupPushSwitch();
    }
    // ==========================================
    // 4. CONFIGURACIÓN DE PREFERENCIAS DE NOTIFICACIÓN
    // ==========================================
    const btnConfigurarNotificaciones = document.getElementById("btnConfigurarNotificaciones");
    const modalConfigNotificacionesBackdrop = document.getElementById("modalConfigNotificacionesBackdrop");
    const btnCancelConfigNotificaciones = document.getElementById("btnCancelConfigNotificaciones");
    const btnSaveConfigNotificaciones = document.getElementById("btnSaveConfigNotificaciones");
    const chkNotifyMatchCreation = document.getElementById("chkNotifyMatchCreation");
    const chkNotifyMatchModification = document.getElementById("chkNotifyMatchModification");
    const chkNotifyChat = document.getElementById("chkNotifyChat");
    if (btnConfigurarNotificaciones && modalConfigNotificacionesBackdrop && btnCancelConfigNotificaciones && btnSaveConfigNotificaciones) {
        btnConfigurarNotificaciones.addEventListener("click", () => {
            modalConfigNotificacionesBackdrop.classList.add("show");
        });
        const closeConfigModal = () => {
            modalConfigNotificacionesBackdrop.classList.remove("show");
        };
        btnCancelConfigNotificaciones.addEventListener("click", closeConfigModal);
        modalConfigNotificacionesBackdrop.addEventListener("click", (e) => {
            if (e.target === modalConfigNotificacionesBackdrop) {
                closeConfigModal();
            }
        });
        btnSaveConfigNotificaciones.addEventListener("click", async () => {
            const creation = chkNotifyMatchCreation ? chkNotifyMatchCreation.checked : true;
            const modification = chkNotifyMatchModification ? chkNotifyMatchModification.checked : true;
            const chat = chkNotifyChat ? chkNotifyChat.checked : true;
            try {
                const response = await fetch("/Account/UpdateNotificationSettings", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getVerificationToken()
                    },
                    body: JSON.stringify({
                        notifyMatchCreation: creation,
                        notifyMatchModification: modification,
                        notifyChat: chat
                    })
                });
                if (response.ok) {
                    closeConfigModal();
                    showToast("Cambios guardados correctamente", false);
                }
                else {
                    showToast("Error al actualizar la configuración de notificaciones.", true);
                }
            }
            catch (err) {
                console.error("Error al guardar configuración de notificaciones:", err);
                showToast("Ocurrió un error de red al guardar los cambios.", true);
            }
        });
    }
    // ==========================================
    // 5. ELIMINACIÓN DE CUENTA (ESTILO GITHUB)
    // ==========================================
    const btnDeleteAccount = document.getElementById("btnDeleteAccount");
    const modalDeleteAccountBackdrop = document.getElementById("modalDeleteAccountBackdrop");
    const btnCancelDeleteAccount = document.getElementById("btnCancelDeleteAccount");
    const btnConfirmDeleteAccount = document.getElementById("btnConfirmDeleteAccount");
    const confirmDeleteInput = document.getElementById("confirmDeleteInput");
    if (btnDeleteAccount && modalDeleteAccountBackdrop && btnCancelDeleteAccount && btnConfirmDeleteAccount && confirmDeleteInput) {
        btnDeleteAccount.addEventListener("click", () => {
            confirmDeleteInput.value = "";
            btnConfirmDeleteAccount.disabled = true;
            btnConfirmDeleteAccount.style.opacity = "0.5";
            modalDeleteAccountBackdrop.classList.add("show");
        });
        const closeDeleteModal = () => {
            modalDeleteAccountBackdrop.classList.remove("show");
        };
        btnCancelDeleteAccount.addEventListener("click", closeDeleteModal);
        modalDeleteAccountBackdrop.addEventListener("click", (e) => {
            if (e.target === modalDeleteAccountBackdrop) {
                closeDeleteModal();
            }
        });
        confirmDeleteInput.addEventListener("input", () => {
            const isMatch = confirmDeleteInput.value.trim().toLowerCase() === "quiero eliminar mi cuenta";
            btnConfirmDeleteAccount.disabled = !isMatch;
            btnConfirmDeleteAccount.style.opacity = isMatch ? "1" : "0.5";
        });
        btnConfirmDeleteAccount.addEventListener("click", async () => {
            if (confirmDeleteInput.value.trim().toLowerCase() !== "quiero eliminar mi cuenta")
                return;
            try {
                btnConfirmDeleteAccount.disabled = true;
                btnConfirmDeleteAccount.textContent = "Eliminando...";
                const response = await fetch("/Account/DeleteAccount", {
                    method: "POST",
                    headers: {
                        "RequestVerificationToken": getVerificationToken()
                    }
                });
                if (response.ok) {
                    closeDeleteModal();
                    // Redirigir a Login con mensaje de éxito mediante parámetro de consulta
                    const message = "Tu cuenta y todos tus datos personales han sido eliminados de forma permanente.";
                    window.location.href = `/Account/Login?successMessage=${encodeURIComponent(message)}`;
                }
                else {
                    btnConfirmDeleteAccount.disabled = false;
                    btnConfirmDeleteAccount.textContent = "Eliminar permanentemente";
                    const errData = await response.json();
                    showToast(errData.message || "Error al eliminar la cuenta.", true);
                }
            }
            catch (err) {
                console.error("Error al eliminar cuenta:", err);
                btnConfirmDeleteAccount.disabled = false;
                btnConfirmDeleteAccount.textContent = "Eliminar permanentemente";
                showToast("Error de conexión al eliminar la cuenta.", true);
            }
        });
    }
});

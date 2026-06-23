document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const btnEditPhoto = document.getElementById("btnEditPhoto") as HTMLButtonElement | null;
    const filePhotoInput = document.getElementById("filePhotoInput") as HTMLInputElement | null;
    const profileAvatarContainer = document.getElementById("profileAvatarContainer") as HTMLDivElement | null;
    
    const btnModificarApodo = document.getElementById("btnModificarApodo") as HTMLButtonElement | null;
    const modalApodoBackdrop = document.getElementById("modalApodoBackdrop") as HTMLDivElement | null;
    const btnCancelApodo = document.getElementById("btnCancelApodo") as HTMLButtonElement | null;
    const btnSaveApodo = document.getElementById("btnSaveApodo") as HTMLButtonElement | null;
    const inputNickname = document.getElementById("inputNickname") as HTMLInputElement | null;
    const errorApodo = document.getElementById("errorApodo") as HTMLSpanElement | null;
    const txtNickname = document.getElementById("txtNickname") as HTMLSpanElement | null;
    
    const switchNotifications = document.getElementById("switchNotifications") as HTMLInputElement | null;

    // Helper: Anti forgery token
    function getVerificationToken(): string {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    }

    // Helper: URL Base64 to Uint8Array
    function b64ToUint8(base64String: string): Uint8Array {
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
    const showToast = (message: string, isError: boolean = false): void => {
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
            if (!filePhotoInput.files || filePhotoInput.files.length === 0) return;
            
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
                } else {
                    const errData = await response.json();
                    alert(errData.message || "Error al actualizar la foto de perfil.");
                }
            } catch (err) {
                console.error("Error al subir foto:", err);
                alert("Ocurrió un error al subir la imagen.");
            } finally {
                filePhotoInput.value = ""; // Limpiar
            }
        });
    }

    // ==========================================
    // 2. MODIFICAR APODO (MODAL)
    // ==========================================
    if (btnModificarApodo && modalApodoBackdrop && btnCancelApodo && btnSaveApodo && inputNickname && txtNickname) {
        btnModificarApodo.addEventListener("click", () => {
            if (errorApodo) errorApodo.textContent = "";
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
            if (errorApodo) errorApodo.textContent = "";

            if (!nick) {
                if (errorApodo) errorApodo.textContent = "El apodo no puede estar vacío.";
                return;
            }
            if (nick.length > 20) {
                if (errorApodo) errorApodo.textContent = "El apodo no puede superar los 20 caracteres.";
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
                } else {
                    const errData = await response.json();
                    if (errorApodo) errorApodo.textContent = errData.message || "Error al actualizar el apodo.";
                }
            } catch (err) {
                console.error("Error al actualizar apodo:", err);
                if (errorApodo) errorApodo.textContent = "Error de red al actualizar el apodo.";
            }
        });
    }

    // ==========================================
    // 3. ADMINISTRAR NOTIFICACIONES PUSH
    // ==========================================
    if (switchNotifications) {
        const updateSettingsButtonVisibility = (active: boolean) => {
            const btn = document.getElementById("btnConfigurarNotificaciones");
            if (btn) {
                btn.style.display = active ? "flex" : "none";
            }
        };

        const setupPushSwitch = async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                switchNotifications.disabled = true;
                const switchParent = switchNotifications.closest(".profile-option-item") as HTMLElement | null;
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
                    const shouldSubscribe = switchNotifications.checked;
                    
                    if (shouldSubscribe) {
                        // Solicitar permiso
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            alert("Permiso de notificaciones denegado. Habilitalo en los ajustes del navegador.");
                            switchNotifications.checked = false;
                            updateSettingsButtonVisibility(false);
                            return;
                        }

                        // Obtener clave VAPID pública
                        const keyResponse = await fetch('/Push/PublicKey');
                        if (!keyResponse.ok) {
                            alert("No se pudo obtener la clave del servidor push.");
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
                                applicationServerKey: b64ToUint8(vapidKey) as any
                            });

                            const subJson = sub.toJSON();
                            const p256dh = subJson.keys?.p256dh;
                            const auth = subJson.keys?.auth;

                            if (!sub.endpoint || !p256dh || !auth) {
                                throw new Error("Suscripción inválida obtenida del navegador.");
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
                                throw new Error("El servidor rechazó el registro de la suscripción.");
                            }

                            updateSettingsButtonVisibility(true);
                        } catch (subErr) {
                            console.error("Error al suscribirse:", subErr);
                            // Deshacer local
                            const currentSub = await reg.pushManager.getSubscription();
                            if (currentSub) {
                                await currentSub.unsubscribe();
                            }
                            switchNotifications.checked = false;
                            updateSettingsButtonVisibility(false);
                            alert("Error al activar las notificaciones push en el servidor.");
                        }
                    } else {
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
                        } catch (unsubErr) {
                            console.error("Error al desuscribirse:", unsubErr);
                            alert("Ocurrió un error al desactivar las notificaciones push.");
                            // Revertir estado switch
                            switchNotifications.checked = true;
                            updateSettingsButtonVisibility(true);
                        }
                    }
                });
            } catch (err) {
                console.error("Error al inicializar interruptor de notificaciones:", err);
                switchNotifications.disabled = true;
            }
        };

        setupPushSwitch();
    }

    // ==========================================
    // 4. CONFIGURACIÓN DE PREFERENCIAS DE NOTIFICACIÓN
    // ==========================================
    const btnConfigurarNotificaciones = document.getElementById("btnConfigurarNotificaciones") as HTMLButtonElement | null;
    const modalConfigNotificacionesBackdrop = document.getElementById("modalConfigNotificacionesBackdrop") as HTMLDivElement | null;
    const btnCancelConfigNotificaciones = document.getElementById("btnCancelConfigNotificaciones") as HTMLButtonElement | null;
    const btnSaveConfigNotificaciones = document.getElementById("btnSaveConfigNotificaciones") as HTMLButtonElement | null;

    const chkNotifyMatchCreation = document.getElementById("chkNotifyMatchCreation") as HTMLInputElement | null;
    const chkNotifyMatchModification = document.getElementById("chkNotifyMatchModification") as HTMLInputElement | null;
    const chkNotifyChat = document.getElementById("chkNotifyChat") as HTMLInputElement | null;

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
                } else {
                    showToast("Error al actualizar la configuración de notificaciones.", true);
                }
            } catch (err) {
                console.error("Error al guardar configuración de notificaciones:", err);
                showToast("Ocurrió un error de red al guardar los cambios.", true);
            }
        });
    }
});

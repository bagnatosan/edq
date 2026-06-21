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
document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput");
    const groupNameTitle = document.getElementById("groupNameTitle");
    const membersRemoveList = document.getElementById("membersRemoveList");
    const membersCountBadge = document.getElementById("membersCountBadge");
    // Elementos del modal de confirmación premium
    const confirmModal = document.getElementById("confirmModal");
    const confirmModalCard = document.getElementById("confirmModalCard");
    const confirmModalText = document.getElementById("confirmModalText");
    const btnConfirmCancel = document.getElementById("btnConfirmCancel");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    if (!groupIdInput || !groupNameTitle || !membersRemoveList || !membersCountBadge)
        return;
    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId))
        return;
    // Callback para manejar el borrado una vez confirmado
    let currentDeleteCallback = null;
    const hideConfirmModal = () => {
        if (!confirmModal || !confirmModalCard)
            return;
        confirmModal.style.opacity = "0";
        confirmModalCard.style.transform = "scale(0.9)";
        setTimeout(() => {
            confirmModal.style.display = "none";
        }, 250);
    };
    if (btnConfirmCancel) {
        btnConfirmCancel.addEventListener("click", () => {
            hideConfirmModal();
            currentDeleteCallback = null;
        });
    }
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", () => {
            if (currentDeleteCallback) {
                currentDeleteCallback();
            }
            hideConfirmModal();
        });
    }
    if (confirmModal) {
        confirmModal.addEventListener("click", (e) => {
            if (e.target === confirmModal) {
                hideConfirmModal();
                currentDeleteCallback = null;
            }
        });
    }
    // Soporte para cerrar modal con la tecla Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && confirmModal && confirmModal.style.display === "flex") {
            hideConfirmModal();
            currentDeleteCallback = null;
        }
    });
    // Toast de notificaciones con estilo premium
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
    // Cargar datos por AJAX
    const loadGroupData = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) {
                if (response.status === 403) {
                    showToast("No tienes permisos de administrador.", true);
                    setTimeout(() => {
                        window.location.href = `/Group/Dashboard?groupId=${groupId}`;
                    }, 1500);
                    return;
                }
                throw new Error("Error al obtener los miembros del grupo.");
            }
            const data = yield response.json();
            // 1. Título
            groupNameTitle.textContent = `Eliminar Jugadores - ${data.groupName}`;
            // 2. Renderizar listado de jugadores
            renderMembersList(data.members, data.creatorId);
        }
        catch (error) {
            console.error("Error cargando jugadores:", error);
            showToast("Ocurrió un error al cargar la lista de jugadores.", true);
        }
    });
    // Renderizar miembros en forma de lista eliminable
    const renderMembersList = (members, creatorId) => {
        if (!membersRemoveList || !membersCountBadge)
            return;
        membersRemoveList.innerHTML = "";
        membersCountBadge.textContent = `${members.length} ${members.length === 1 ? 'JUGADOR' : 'JUGADORES'}`;
        if (members.length === 0) {
            membersRemoveList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No hay miembros registrados en este grupo.</div>`;
            return;
        }
        members.forEach(member => {
            const row = document.createElement("div");
            row.className = "request-card"; // Reutilizar la clase estética de tarjeta
            row.style.marginBottom = "12px";
            row.dataset.playerId = member.id.toString();
            // Avatar y Nombre
            let avatarContent = "";
            if (member.photoUrl) {
                avatarContent = `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`;
            }
            else {
                avatarContent = `<span class="avatar-initials" style="font-size: 13px;">${escapeHtml(member.initials)}</span>`;
            }
            const isCreatorSelf = member.id === creatorId;
            let actionHtml = "";
            if (isCreatorSelf) {
                actionHtml = `<span class="card-subtitle-badge" style="color: var(--neon-green); border-color: var(--neon-green-glow); background: rgba(158, 255, 0, 0.05); font-size: 10px; font-weight: 700;">PROPIETARIO</span>`;
            }
            else {
                actionHtml = `
                    <button class="btn-request-circle btn-request-decline btn-action-delete" data-id="${member.id}" aria-label="Eliminar del grupo">
                        ❌
                    </button>
                `;
            }
            const hasNickname = member.nickname && member.nickname !== member.name;
            const nicknameHtml = hasNickname ? `
                        <span class="request-nickname">@${escapeHtml(member.nickname)}</span>
            ` : '';
            row.innerHTML = `
                <div class="request-user-info">
                    <div class="avatar-container" style="width: 38px; height: 38px; margin-bottom: 0; flex-shrink: 0;">
                        ${avatarContent}
                    </div>
                    <div class="request-details">
                        <span class="request-name">${escapeHtml(member.name)}</span>
                        ${nicknameHtml}
                    </div>
                </div>
                <div class="request-actions">
                    ${actionHtml}
                </div>
            `;
            // Vincular evento eliminar si no es el creador
            if (!isCreatorSelf) {
                const deleteBtn = row.querySelector(".btn-action-delete");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", () => handleRemoveMember(member.id, member.name, row));
                }
            }
            membersRemoveList.appendChild(row);
        });
    };
    // Confirmar y eliminar miembro por AJAX
    const handleRemoveMember = (playerId, playerName, rowElement) => {
        if (!confirmModal || !confirmModalText)
            return;
        confirmModalText.textContent = `¿Estás seguro de que deseas eliminar a ${playerName} del grupo? Esta acción no se puede deshacer.`;
        currentDeleteCallback = () => __awaiter(void 0, void 0, void 0, function* () {
            const deleteBtn = rowElement.querySelector(".btn-action-delete");
            if (deleteBtn)
                deleteBtn.disabled = true;
            try {
                const response = yield fetch(`/Group/RemoveMember?groupId=${groupId}&playerId=${playerId}`, {
                    method: "POST",
                    headers: {
                        "RequestVerificationToken": getAntiForgeryToken()
                    }
                });
                if (!response.ok) {
                    const errorText = yield response.text();
                    throw new Error(errorText || "Error al eliminar al jugador.");
                }
                // Animación de salida fluida
                rowElement.style.transition = "all 0.3s ease";
                rowElement.style.opacity = "0";
                rowElement.style.transform = "translateX(-20px)";
                setTimeout(() => {
                    rowElement.remove();
                    showToast(`Se ha eliminado a ${playerName} del grupo.`, false);
                    // Actualizar contador
                    const badge = document.getElementById("membersCountBadge");
                    if (badge) {
                        const currentCount = document.querySelectorAll("#membersRemoveList .request-card").length;
                        badge.textContent = `${currentCount} ${currentCount === 1 ? 'JUGADOR' : 'JUGADORES'}`;
                    }
                }, 300);
            }
            catch (error) {
                console.error("Error al eliminar jugador:", error);
                showToast(error.message || "No se pudo eliminar al jugador del grupo.", true);
                if (deleteBtn)
                    deleteBtn.disabled = false;
            }
        });
        // Mostrar el modal con transiciones
        confirmModal.style.display = "flex";
        confirmModal.offsetHeight; // Forzar reflow
        confirmModal.style.opacity = "1";
        if (confirmModalCard) {
            confirmModalCard.style.transform = "scale(1)";
        }
    };
    // Anti forgery token helper
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    };
    // Escapar HTML para evitar XSS
    const escapeHtml = (unsafe) => {
        if (!unsafe)
            return "";
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    // Carga inicial
    loadGroupData();
});

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
    const membersCarousel = document.getElementById("membersCarousel");
    const membersCountBadge = document.getElementById("membersCountBadge");
    const adminPanel = document.getElementById("adminPanel");
    const requestsCountBadge = document.getElementById("requestsCountBadge");
    const requestsList = document.getElementById("requestsList");
    // Botones de acción
    const btnCreateMatch = document.getElementById("btnCreateMatch");
    const btnAssignScores = document.getElementById("btnAssignScores");
    if (!groupIdInput || !groupNameTitle || !membersCarousel || !membersCountBadge || !requestsList)
        return;
    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId))
        return;
    // Cargar datos del dashboard por AJAX
    const loadDashboardData = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) {
                if (response.status === 403) {
                    alert("No tienes permiso para ver este grupo.");
                    window.location.href = "/Group/Explore";
                    return;
                }
                throw new Error("Error al obtener datos del grupo.");
            }
            const data = yield response.json();
            // 1. Mostrar nombre del grupo
            groupNameTitle.textContent = data.groupName;
            // 2. Mostrar miembros en el carrusel
            renderMembers(data.members);
            // 3. Configurar botones según rol
            if (data.isCreator) {
                if (btnAssignScores) {
                    btnAssignScores.style.display = "flex"; // Mostrar el botón de asignar puntajes
                }
            }
            else {
                if (btnAssignScores) {
                    btnAssignScores.style.display = "none";
                }
            }
            // 4. Panel de administración para solicitudes pendientes
            if (data.isCreator && data.pendingRequests && data.pendingRequests.length > 0) {
                renderPendingRequests(data.pendingRequests);
                if (adminPanel) {
                    adminPanel.style.display = "block";
                }
            }
            else {
                if (adminPanel) {
                    adminPanel.style.display = "none";
                }
            }
        }
        catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            alert("No se pudieron cargar los datos del grupo.");
        }
    });
    // Renderizar miembros en el carrusel horizontal
    const renderMembers = (members) => {
        if (!membersCarousel || !membersCountBadge)
            return;
        membersCarousel.innerHTML = "";
        membersCountBadge.textContent = `${members.length} ${members.length === 1 ? 'JUGADOR' : 'JUGADORES'}`;
        members.forEach(member => {
            const memberCard = document.createElement("div");
            memberCard.className = "member-card";
            memberCard.dataset.playerId = member.id.toString();
            // Contenido del avatar (foto o iniciales)
            let avatarContent = "";
            if (member.photoUrl) {
                avatarContent = `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`;
            }
            else {
                avatarContent = `<span class="avatar-initials">${escapeHtml(member.initials)}</span>`;
            }
            memberCard.innerHTML = `
                <div class="avatar-container">
                    ${avatarContent}
                </div>
                <div class="member-name">${escapeHtml(member.nickname)}</div>
                <div class="member-rating">
                    <span class="star-icon">★</span>
                    <span>${member.score ? member.score.toFixed(1) : "6.0"}</span>
                </div>
            `;
            membersCarousel.appendChild(memberCard);
        });
    };
    // Renderizar solicitudes pendientes de unión
    const renderPendingRequests = (requests) => {
        if (!requestsList || !requestsCountBadge)
            return;
        requestsList.innerHTML = "";
        requestsCountBadge.textContent = `${requests.length} ${requests.length === 1 ? 'PENDIENTE' : 'PENDIENTES'}`;
        requests.forEach(req => {
            const requestItem = document.createElement("div");
            requestItem.className = "request-item";
            requestItem.dataset.requestId = req.requestId.toString();
            // Avatar (foto o iniciales)
            let avatarContent = "";
            if (req.photoUrl) {
                avatarContent = `<img src="${escapeHtml(req.photoUrl)}" class="avatar-image" alt="${escapeHtml(req.nickname)}" />`;
            }
            else {
                avatarContent = `<span class="avatar-initials">${escapeHtml(req.initials)}</span>`;
            }
            requestItem.innerHTML = `
                <div class="request-info">
                    <div class="avatar-container" style="width: 40px; height: 40px; margin-bottom: 0;">
                        ${avatarContent}
                    </div>
                    <div class="request-details">
                        <span class="request-name">${escapeHtml(req.name)}</span>
                        <span style="font-size: 12px; color: var(--text-secondary);">@${escapeHtml(req.nickname)}</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn-action btn-action-accept" data-id="${req.requestId}" aria-label="Aceptar">
                        ✔
                    </button>
                    <button class="btn-action btn-action-decline" data-id="${req.requestId}" aria-label="Rechazar">
                        ❌
                    </button>
                </div>
            `;
            // Eventos para botones
            const acceptBtn = requestItem.querySelector(".btn-action-accept");
            const declineBtn = requestItem.querySelector(".btn-action-decline");
            if (acceptBtn) {
                acceptBtn.addEventListener("click", () => handleProcessRequest(req.requestId, true, requestItem));
            }
            if (declineBtn) {
                declineBtn.addEventListener("click", () => handleProcessRequest(req.requestId, false, requestItem));
            }
            requestsList.appendChild(requestItem);
        });
    };
    // Procesar la solicitud (Aceptar o Rechazar) por AJAX
    const handleProcessRequest = (requestId, accept, itemElement) => __awaiter(void 0, void 0, void 0, function* () {
        const actionUrl = accept ? "/Group/AcceptRequest" : "/Group/DeclineRequest";
        // Deshabilitar botones dentro de este elemento para evitar doble click
        const buttons = itemElement.querySelectorAll(".btn-action");
        buttons.forEach(btn => btn.disabled = true);
        try {
            const response = yield fetch(`${actionUrl}?requestId=${requestId}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });
            if (!response.ok) {
                const errorText = yield response.text();
                throw new Error(errorText || "Error al procesar la solicitud.");
            }
            // Éxito: Animación de desvanecimiento y actualizar datos
            itemElement.style.transition = "all 0.3s ease";
            itemElement.style.opacity = "0";
            itemElement.style.transform = "translateX(-20px)";
            setTimeout(() => {
                // Eliminar el elemento del DOM y recargar los datos para actualizar miembros y contador
                itemElement.remove();
                loadDashboardData();
            }, 300);
        }
        catch (error) {
            console.error("Error al procesar solicitud:", error);
            alert(error.message || "No se pudo procesar la solicitud.");
            buttons.forEach(btn => btn.disabled = false);
        }
    });
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
    // Agregar evento a botón Crear Partido (mock/redirección)
    if (btnCreateMatch) {
        btnCreateMatch.addEventListener("click", () => {
            alert("¡Funcionalidad para crear nuevo partido coming soon!");
        });
    }
    // Agregar evento a botón Asignar Puntajes (mock/redirección)
    if (btnAssignScores) {
        btnAssignScores.addEventListener("click", () => {
            alert("¡Funcionalidad para asignar puntajes coming soon!");
        });
    }
    // Cargar datos iniciales
    loadDashboardData();
});

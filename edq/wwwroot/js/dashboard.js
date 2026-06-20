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
    // Elementos de Próximo Partido
    const upcomingMatchCard = document.getElementById("upcomingMatchCard");
    const matchTimeLabel = document.getElementById("matchTimeLabel");
    const teamAList = document.getElementById("teamAList");
    const teamBList = document.getElementById("teamBList");
    // Elemento del Ranking
    const rankingList = document.getElementById("rankingList");
    // Botones de acción
    const btnCreateMatch = document.getElementById("btnCreateMatch");
    const btnAssignScores = document.getElementById("btnAssignScores");
    const btnMatchHistory = document.getElementById("btnMatchHistory");
    if (!groupIdInput || !groupNameTitle || !membersCarousel || !membersCountBadge || !requestsList || !rankingList)
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
            // 2. Mostrar miembros en el carrusel (solo mostrar puntaje si el usuario actual es el creador)
            renderMembers(data.members, data.isCreator);
            // 3. Configurar botones según rol
            if (data.isCreator) {
                if (btnAssignScores) {
                    btnAssignScores.style.display = "flex";
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
            // 5. Renderizar Próximo Partido si hay alguno planificado
            if (data.upcomingMatch && upcomingMatchCard && matchTimeLabel && teamAList && teamBList) {
                matchTimeLabel.textContent = `⚽ ${formatDate(data.upcomingMatch.date)} hs`;
                teamAList.innerHTML = data.upcomingMatch.team1.length > 0
                    ? data.upcomingMatch.team1.map(p => `<div>• ${escapeHtml(p)}</div>`).join("")
                    : `<div style="font-style: italic; color: var(--text-muted);">Sin jugadores</div>`;
                teamBList.innerHTML = data.upcomingMatch.team2.length > 0
                    ? data.upcomingMatch.team2.map(p => `<div>• ${escapeHtml(p)}</div>`).join("")
                    : `<div style="font-style: italic; color: var(--text-muted);">Sin jugadores</div>`;
                upcomingMatchCard.style.display = "block";
            }
            else {
                if (upcomingMatchCard)
                    upcomingMatchCard.style.display = "none";
            }
            // 6. Renderizar ranking completo ordenado por winrate
            renderRanking(data.members);
        }
        catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            alert("No se pudieron cargar los datos del grupo.");
        }
    });
    // Renderizar miembros en el carrusel horizontal
    const renderMembers = (members, isCreator) => {
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
            // Mostrar el puntaje abajo del nombre únicamente si es el creador
            let ratingHtml = "";
            if (isCreator) {
                ratingHtml = `
                    <div class="member-rating">
                        <span class="star-icon">★</span>
                        <span>${member.score ? member.score.toFixed(1) : "6.0"}</span>
                    </div>
                `;
            }
            memberCard.innerHTML = `
                <div class="avatar-container">
                    ${avatarContent}
                </div>
                <div class="member-name">${escapeHtml(member.nickname)}</div>
                ${ratingHtml}
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
            itemElement.style.transition = "all 0.3s ease";
            itemElement.style.opacity = "0";
            itemElement.style.transform = "translateX(-20px)";
            setTimeout(() => {
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
    // Renderizar ranking completo en orden descendente de winrate
    const renderRanking = (members) => {
        if (!rankingList)
            return;
        rankingList.innerHTML = "";
        if (members.length === 0) {
            rankingList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px;">Aún no hay suficientes partidos completados.</div>`;
            return;
        }
        members.forEach((member, index) => {
            const position = index + 1;
            const isTop1 = position === 1;
            const rankingItem = document.createElement("div");
            rankingItem.className = "ranking-item";
            // Estilos específicos para la primera posición
            if (isTop1) {
                rankingItem.style.background = "rgba(158, 255, 0, 0.03)";
                rankingItem.style.borderColor = "rgba(158, 255, 0, 0.15)";
            }
            else {
                rankingItem.style.background = "rgba(255, 255, 255, 0.01)";
                rankingItem.style.borderColor = "rgba(255, 255, 255, 0.03)";
            }
            rankingItem.style.display = "flex";
            rankingItem.style.alignItems = "center";
            rankingItem.style.justifyContent = "space-between";
            rankingItem.style.padding = "10px 12px";
            rankingItem.style.border = "1px solid";
            rankingItem.style.borderRadius = "var(--border-radius-md)";
            // Avatar
            let avatarContent = "";
            if (member.photoUrl) {
                avatarContent = `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`;
            }
            else {
                avatarContent = `<span class="avatar-initials" style="font-size: 11px;">${escapeHtml(member.initials)}</span>`;
            }
            // Color del indicador de puesto
            let positionColor = "var(--text-secondary)";
            let avatarBorderColor = "rgba(255, 255, 255, 0.08)";
            if (position === 1) {
                positionColor = "var(--neon-green)";
                avatarBorderColor = "var(--neon-green-solid)";
            }
            else if (position === 2) {
                positionColor = "var(--text-primary)";
            }
            else if (position === 3) {
                positionColor = "#a05a2c"; // Bronce / café sutil
            }
            rankingItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                    <span style="font-size: 16px; font-weight: 800; color: ${positionColor}; width: 22px; flex-shrink: 0; text-align: center;">#${position}</span>
                    <div class="avatar-container" style="width: 32px; height: 32px; margin-bottom: 0; border-color: ${avatarBorderColor}; flex-shrink: 0;">
                        ${avatarContent}
                    </div>
                    <div style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                            ${escapeHtml(member.name)}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                            @${escapeHtml(member.nickname)}
                        </div>
                    </div>
                </div>
                <div style="font-size: 14px; font-weight: 800; color: ${isTop1 ? 'var(--neon-green)' : 'var(--text-secondary)'}; flex-shrink: 0;">
                    ${member.winrate ? member.winrate.toFixed(0) : "0"}%
                </div>
            `;
            rankingList.appendChild(rankingItem);
        });
    };
    // Helper para formatear fecha en formato legible "Sábado 20/06 - 18:00"
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        if (isNaN(date.getTime()))
            return dateString;
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const dayName = days[date.getDay()];
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${dayName} ${day}/${month} - ${hours}:${minutes}`;
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
    // Agregar evento a botón Crear Partido (mock/redirección)
    if (btnCreateMatch) {
        btnCreateMatch.addEventListener("click", () => {
            alert("¡Funcionalidad para crear nuevo partido coming soon!");
        });
    }
    // Redirigir al panel de asignación de puntajes
    if (btnAssignScores) {
        btnAssignScores.addEventListener("click", () => {
            window.location.href = `/Group/AssignScores?groupId=${groupId}`;
        });
    }
    // Redirigir al historial de partidos
    if (btnMatchHistory) {
        btnMatchHistory.addEventListener("click", () => {
            window.location.href = `/Group/MatchHistory?groupId=${groupId}`;
        });
    }
    // Cargar datos iniciales
    loadDashboardData();
});

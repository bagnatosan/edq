interface GroupMember {
    id: number;
    name: string;
    nickname: string;
    photoUrl: string | null;
    initials: string;
    score: number;
    winrate: number;
}

interface PendingRequest {
    requestId: number;
    playerId: number;
    name: string;
    nickname: string;
    photoUrl: string | null;
    initials: string;
}

interface UpcomingMatch {
    id: number;
    date: string;
    team1: string[];
    team2: string[];
}

interface DashboardData {
    groupId: number;
    groupName: string;
    isCreator: boolean;
    members: GroupMember[];
    pendingRequests: PendingRequest[] | null;
    upcomingMatch: UpcomingMatch | null;
}

document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const groupNameTitle = document.getElementById("groupNameTitle") as HTMLHeadingElement | null;
    const membersCarousel = document.getElementById("membersCarousel") as HTMLDivElement | null;
    const membersCountBadge = document.getElementById("membersCountBadge") as HTMLSpanElement | null;
    const adminPanel = document.getElementById("adminPanel") as HTMLDivElement | null;
    const requestsCountBadge = document.getElementById("requestsCountBadge") as HTMLSpanElement | null;
    const requestsList = document.getElementById("requestsList") as HTMLDivElement | null;
    
    // Elementos de Próximo Partido
    const upcomingMatchCard = document.getElementById("upcomingMatchCard") as HTMLDivElement | null;
    const matchTimeLabel = document.getElementById("matchTimeLabel") as HTMLDivElement | null;
    const teamAList = document.getElementById("teamAList") as HTMLDivElement | null;
    const teamBList = document.getElementById("teamBList") as HTMLDivElement | null;

    // Elemento del Ranking
    const rankingList = document.getElementById("rankingList") as HTMLDivElement | null;
    
    // Botones de acción
    const btnCreateMatch = document.getElementById("btnCreateMatch") as HTMLButtonElement | null;
    const btnAssignScores = document.getElementById("btnAssignScores") as HTMLButtonElement | null;
    const btnMatchHistory = document.getElementById("btnMatchHistory") as HTMLButtonElement | null;

    if (!groupIdInput || !groupNameTitle || !membersCarousel || !membersCountBadge || !requestsList || !rankingList) return;

    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId)) return;

    // Cargar datos del dashboard por AJAX
    const loadDashboardData = async (): Promise<void> => {
        try {
            const response = await fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) {
                if (response.status === 403) {
                    alert("No tienes permiso para ver este grupo.");
                    window.location.href = "/Group/Explore";
                    return;
                }
                throw new Error("Error al obtener datos del grupo.");
            }

            const data: DashboardData = await response.json();

            // 1. Mostrar nombre del grupo
            groupNameTitle.textContent = data.groupName;

            // 2. Mostrar miembros en el carrusel (solo mostrar puntaje si el usuario actual es el creador)
            renderMembers(data.members, data.isCreator);

            // 3. Configurar botones según rol
            if (data.isCreator) {
                if (btnAssignScores) {
                    btnAssignScores.style.display = "flex";
                }
            } else {
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
            } else {
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
            } else {
                if (upcomingMatchCard) upcomingMatchCard.style.display = "none";
            }

            // 6. Renderizar ranking completo ordenado por winrate
            renderRanking(data.members);

        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            alert("No se pudieron cargar los datos del grupo.");
        }
    };

    // Renderizar miembros en el carrusel horizontal
    const renderMembers = (members: GroupMember[], isCreator: boolean): void => {
        if (!membersCarousel || !membersCountBadge) return;
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
            } else {
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
    const renderPendingRequests = (requests: PendingRequest[]): void => {
        if (!requestsList || !requestsCountBadge) return;
        requestsList.innerHTML = "";

        requestsCountBadge.textContent = `${requests.length} ${requests.length === 1 ? 'PENDIENTE' : 'PENDIENTES'}`;

        requests.forEach(req => {
            const requestItem = document.createElement("div");
            requestItem.className = "request-card";
            requestItem.dataset.requestId = req.requestId.toString();

            // Avatar (foto o iniciales)
            let avatarContent = "";
            if (req.photoUrl) {
                avatarContent = `<img src="${escapeHtml(req.photoUrl)}" class="avatar-image" alt="${escapeHtml(req.nickname)}" />`;
            } else {
                avatarContent = `<span class="avatar-initials">${escapeHtml(req.initials)}</span>`;
            }

            requestItem.innerHTML = `
                <div class="request-user-info">
                    <div class="avatar-container" style="width: 40px; height: 40px; margin-bottom: 0; flex-shrink: 0;">
                        ${avatarContent}
                    </div>
                    <div class="request-details">
                        <span class="request-name">${escapeHtml(req.name)}</span>
                        <span class="request-nickname">@${escapeHtml(req.nickname)}</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn-request-circle btn-request-accept btn-action-accept btn-action" data-id="${req.requestId}" aria-label="Aceptar">
                        ✔
                    </button>
                    <button class="btn-request-circle btn-request-decline btn-action-decline btn-action" data-id="${req.requestId}" aria-label="Rechazar">
                        ❌
                    </button>
                </div>
            `;

            // Eventos para botones
            const acceptBtn = requestItem.querySelector(".btn-action-accept") as HTMLButtonElement | null;
            const declineBtn = requestItem.querySelector(".btn-action-decline") as HTMLButtonElement | null;

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
    const handleProcessRequest = async (requestId: number, accept: boolean, itemElement: HTMLDivElement): Promise<void> => {
        const actionUrl = accept ? "/Group/AcceptRequest" : "/Group/DeclineRequest";
        
        const buttons = itemElement.querySelectorAll(".btn-action") as NodeListOf<HTMLButtonElement>;
        buttons.forEach(btn => btn.disabled = true);

        try {
            const response = await fetch(`${actionUrl}?requestId=${requestId}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Error al procesar la solicitud.");
            }

            itemElement.style.transition = "all 0.3s ease";
            itemElement.style.opacity = "0";
            itemElement.style.transform = "translateX(-20px)";

            setTimeout(() => {
                itemElement.remove();
                loadDashboardData();
            }, 300);

        } catch (error: any) {
            console.error("Error al procesar solicitud:", error);
            alert(error.message || "No se pudo procesar la solicitud.");
            buttons.forEach(btn => btn.disabled = false);
        }
    };

    // Renderizar ranking completo en orden descendente de winrate
    const renderRanking = (members: GroupMember[]): void => {
        if (!rankingList) return;
        rankingList.innerHTML = "";

        if (members.length === 0) {
            rankingList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px;">Aún no hay suficientes partidos completados.</div>`;
            return;
        }

        members.forEach((member, index) => {
            const position = index + 1;

            const rankingItem = document.createElement("div");
            rankingItem.className = `ranking-row rank-${position}`;

            // Avatar
            let avatarContent = "";
            if (member.photoUrl) {
                avatarContent = `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`;
            } else {
                avatarContent = `<span class="avatar-initials" style="font-size: 11px;">${escapeHtml(member.initials)}</span>`;
            }

            // Símbolo de posición
            let positionSymbol = `#${position}`;
            if (position === 1) positionSymbol = "👑";
            else if (position === 2) positionSymbol = "🥈";
            else if (position === 3) positionSymbol = "🥉";

            rankingItem.innerHTML = `
                <div class="ranking-player-info">
                    <span class="ranking-position">${positionSymbol}</span>
                    <div class="avatar-container" style="width: 36px; height: 36px; margin-bottom: 0; flex-shrink: 0;">
                        ${avatarContent}
                    </div>
                    <div class="ranking-details">
                        <div class="ranking-name" style="display: flex; align-items: center; gap: 6px;">
                            ${escapeHtml(member.name)}
                        </div>
                        <div class="ranking-nickname">
                            @${escapeHtml(member.nickname)}
                        </div>
                    </div>
                </div>
                <div class="ranking-winrate-pill">
                    ${member.winrate ? member.winrate.toFixed(0) : "0"}%
                </div>
            `;

            rankingList.appendChild(rankingItem);
        });
    };

    // Helper para formatear fecha en formato legible "Sábado 20/06 - 18:00"
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        
        const dayName = days[date.getDay()];
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${dayName} ${day}/${month} - ${hours}:${minutes}`;
    };

    // Anti forgery token helper
    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };

    // Escapar HTML para evitar XSS
    const escapeHtml = (unsafe: string): string => {
        if (!unsafe) return "";
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
            window.location.href = `/Group/CreateMatch?groupId=${groupId}`;
        });
    }

    // Redirigir al panel de administración
    if (btnAssignScores) {
        btnAssignScores.addEventListener("click", () => {
            window.location.href = `/Group/AdminPanel?groupId=${groupId}`;
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

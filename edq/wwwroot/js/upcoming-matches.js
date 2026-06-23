"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const upcomingMatchesList = document.getElementById("upcomingMatchesList");
    const matchesCountBadge = document.getElementById("matchesCountBadge");
    if (!upcomingMatchesList || !matchesCountBadge)
        return;
    // Cargar partidos futuros por AJAX
    const loadUpcomingMatches = async () => {
        try {
            const response = await fetch("/Match/GetUpcomingMatches");
            if (!response.ok)
                throw new Error("Error al obtener los partidos programados.");
            const data = await response.json();
            renderUpcomingList(data);
        }
        catch (error) {
            console.error("Error cargando partidos futuros:", error);
            if (upcomingMatchesList) {
                upcomingMatchesList.innerHTML = `<div style="text-align: center; color: var(--red-alert); padding: 40px 20px;">No se pudieron cargar los próximos partidos.</div>`;
            }
        }
    };
    // Renderizar la lista de partidos programados
    const renderUpcomingList = (matches) => {
        if (!upcomingMatchesList || !matchesCountBadge)
            return;
        upcomingMatchesList.innerHTML = "";
        matchesCountBadge.textContent = `${matches.length} ${matches.length === 1 ? 'PARTIDO' : 'PARTIDOS'}`;
        if (matches.length === 0) {
            upcomingMatchesList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                <div style="font-size: 40px; margin-bottom: 12px;">⚽</div>
                No tienes próximos partidos programados en ninguno de tus grupos.
            </div>`;
            return;
        }
        matches.forEach(match => {
            const matchCard = document.createElement("div");
            matchCard.className = "card";
            matchCard.style.borderColor = "var(--neon-green-glow)";
            matchCard.style.background = "rgba(158, 255, 0, 0.01)";
            matchCard.style.marginBottom = "16px";
            matchCard.style.padding = "16px";
            matchCard.style.cursor = "pointer";
            // Redirigir al detalle del partido al clickear el partido
            matchCard.addEventListener("click", () => {
                window.location.href = `/Match/Edit?matchId=${match.matchId}`;
            });
            // Encabezado del partido (Nombre del Grupo y badge de Convocado)
            const header = document.createElement("div");
            header.className = "card-header-flex";
            header.style.marginBottom = "10px";
            header.innerHTML = `
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${escapeHtml(match.groupName)}</h3>
                <span class="card-subtitle-badge" style="color: var(--neon-green); border-color: var(--neon-green-glow); background: rgba(158, 255, 0, 0.05);">CONVOCADO</span>
            `;
            matchCard.appendChild(header);
            // Hora del partido
            const timeInfo = document.createElement("div");
            timeInfo.style.fontSize = "14px";
            timeInfo.style.fontWeight = "700";
            timeInfo.style.color = "var(--text-secondary)";
            timeInfo.style.marginBottom = "12px";
            timeInfo.innerHTML = `📅 ${formatDate(match.date)} hs`;
            matchCard.appendChild(timeInfo);
            // Nombres de los equipos convocados
            const teamsRow = document.createElement("div");
            teamsRow.className = "teams-container";
            teamsRow.style.display = "grid";
            teamsRow.style.gridTemplateColumns = "1fr 1fr";
            teamsRow.style.gap = "16px";
            teamsRow.style.background = "rgba(255,255,255,0.02)";
            teamsRow.style.padding = "10px";
            teamsRow.style.borderRadius = "var(--border-radius-md)";
            teamsRow.style.border = "1px solid rgba(255,255,255,0.04)";
            teamsRow.innerHTML = `
                <div style="border-right: 1px solid rgba(255, 255, 255, 0.06); padding-right: 8px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--neon-green); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Equipo A</div>
                    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
                        ${match.team1.length > 0 ? match.team1.map(p => `<div>• ${escapeHtml(p)}</div>`).join("") : "<div style='color: var(--text-muted); font-style: italic;'>Sin jugadores</div>"}
                    </div>
                </div>
                <div style="padding-left: 8px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--neon-green); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Equipo B</div>
                    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
                        ${match.team2.length > 0 ? match.team2.map(p => `<div>• ${escapeHtml(p)}</div>`).join("") : "<div style='color: var(--text-muted); font-style: italic;'>Sin jugadores</div>"}
                    </div>
                </div>
            `;
            matchCard.appendChild(teamsRow);
            upcomingMatchesList.appendChild(matchCard);
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
    // Cargar partidos
    loadUpcomingMatches();
});

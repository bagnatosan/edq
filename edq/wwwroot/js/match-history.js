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
    const matchesHistoryList = document.getElementById("matchesHistoryList");
    const matchesCountBadge = document.getElementById("matchesCountBadge");
    if (!groupIdInput || !groupNameTitle || !matchesHistoryList || !matchesCountBadge)
        return;
    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId))
        return;
    // Cargar historial de partidos por AJAX
    const loadMatchHistory = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/Group/GetMatchHistoryData?groupId=${groupId}`);
            if (!response.ok)
                throw new Error("Error al obtener el historial de partidos.");
            const data = yield response.json();
            // Renderizar listado de partidos
            renderHistoryList(data.matches, data.isCreator);
        }
        catch (error) {
            console.error("Error cargando historial de partidos:", error);
            alert("No se pudo cargar el historial de partidos.");
        }
    });
    // Renderizar la lista de partidos jugados
    const renderHistoryList = (matches, isCreator) => {
        if (!matchesHistoryList || !matchesCountBadge)
            return;
        matchesHistoryList.innerHTML = "";
        matchesCountBadge.textContent = `${matches.length} ${matches.length === 1 ? 'PARTIDO' : 'PARTIDOS'}`;
        if (matches.length === 0) {
            matchesHistoryList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Aún no se han registrado partidos jugados en este grupo.</div>`;
            return;
        }
        matches.forEach(match => {
            const matchCard = document.createElement("div");
            matchCard.style.background = "rgba(255, 255, 255, 0.01)";
            matchCard.style.border = "1px solid rgba(255, 255, 255, 0.04)";
            matchCard.style.borderRadius = "var(--border-radius-md)";
            matchCard.style.padding = "12px 14px";
            matchCard.style.display = "flex";
            matchCard.style.flexDirection = "column";
            matchCard.style.gap = "10px";
            // Encabezado del partido (Fecha y Resultado)
            const header = document.createElement("div");
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";
            header.style.borderBottom = "1px solid rgba(255, 255, 255, 0.03)";
            header.style.paddingBottom = "6px";
            header.innerHTML = `
                <span style="font-size: 13px; font-weight: 700; color: var(--text-secondary);">${formatDate(match.date)}</span>
                <span style="font-size: 15px; font-weight: 800; color: var(--neon-green); background: rgba(158, 255, 0, 0.05); padding: 4px 10px; border-radius: var(--border-radius-sm); border: 1px solid rgba(158, 255, 0, 0.15);">${escapeHtml(match.result)}</span>
            `;
            matchCard.appendChild(header);
            // Nombres de los equipos convocados
            const teamsRow = document.createElement("div");
            teamsRow.style.display = "grid";
            teamsRow.style.gridTemplateColumns = "1fr 1fr";
            teamsRow.style.gap = "12px";
            teamsRow.innerHTML = `
                <div style="border-right: 1px solid rgba(255, 255, 255, 0.04); padding-right: 6px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Equipo A</div>
                    <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--text-secondary);">
                        ${match.team1.length > 0 ? match.team1.map(p => `<div>• ${escapeHtml(p)}</div>`).join("") : "<i>Sin jugadores</i>"}
                    </div>
                </div>
                <div style="padding-left: 6px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Equipo B</div>
                    <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--text-secondary);">
                        ${match.team2.length > 0 ? match.team2.map(p => `<div>• ${escapeHtml(p)}</div>`).join("") : "<i>Sin jugadores</i>"}
                    </div>
                </div>
            `;
            matchCard.appendChild(teamsRow);
            matchCard.style.cursor = "pointer";
            matchCard.onclick = () => {
                window.location.href = `/Match/Edit?matchId=${match.matchId}`;
            };
            matchesHistoryList.appendChild(matchCard);
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
    // Cargar historial
    loadMatchHistory();
});

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
    const membersScoresList = document.getElementById("membersScoresList");
    const membersCountBadge = document.getElementById("membersCountBadge");
    // Controles de guardar
    const btnSaveScores = document.getElementById("btnSaveScores");
    if (!groupIdInput || !groupNameTitle || !membersScoresList || !membersCountBadge)
        return;
    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId))
        return;
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
                    alert("No tienes permisos de administrador.");
                    window.location.href = `/Group/Dashboard?groupId=${groupId}`;
                    return;
                }
                throw new Error("Error al obtener los miembros del grupo.");
            }
            const data = yield response.json();
            // 1. Título
            groupNameTitle.textContent = `Calificar Miembros - ${data.groupName}`;
            // 2. Renderizar listado de puntajes
            renderMembersList(data.members);
        }
        catch (error) {
            console.error("Error cargando jugadores:", error);
            showToast("Ocurrió un error al cargar la lista de jugadores.", true);
        }
    });
    // Renderizar miembros en forma de lista editable
    const renderMembersList = (members) => {
        if (!membersScoresList || !membersCountBadge)
            return;
        membersScoresList.innerHTML = "";
        membersCountBadge.textContent = `${members.length} ${members.length === 1 ? 'MIEMBRO' : 'MIEMBROS'}`;
        if (members.length === 0) {
            membersScoresList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No hay miembros registrados en este grupo.</div>`;
            return;
        }
        members.forEach(member => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.justifyContent = "space-between";
            row.style.padding = "10px 0";
            row.style.borderBottom = "1px solid rgba(255, 255, 255, 0.04)";
            // Avatar y Nombre
            let avatarContent = "";
            if (member.photoUrl) {
                avatarContent = `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`;
            }
            else {
                avatarContent = `<span class="avatar-initials" style="font-size: 13px;">${escapeHtml(member.initials)}</span>`;
            }
            const hasNickname = member.nickname && member.nickname !== member.name;
            const nicknameHtml = hasNickname ? `
                        <div style="font-size: 11px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                            @${escapeHtml(member.nickname)}
                        </div>
            ` : '';
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                    <div class="avatar-container" style="width: 38px; height: 38px; margin-bottom: 0; flex-shrink: 0;">
                        ${avatarContent}
                    </div>
                    <div style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                            ${escapeHtml(member.name)}
                        </div>
                        ${nicknameHtml}
                    </div>
                </div>
                
                <!-- Selector de Puntaje -->
                <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0; width: 170px; justify-content: flex-end;">
                    <input type="range" class="member-score-slider" min="1" max="10" value="${member.score ? Math.round(member.score) : 6}" data-player-id="${member.id}" style="width: 110px; accent-color: var(--neon-green-solid); margin: 0;" />
                    <span class="member-score-val" id="scoreVal_${member.id}" style="color: var(--neon-green); font-weight: 800; font-size: 15px; width: 24px; text-align: right; flex-shrink: 0;">${member.score ? Math.round(member.score) : 6}</span>
                </div>
            `;
            // Vincular evento input al slider individual para actualizar el label en tiempo real
            const slider = row.querySelector(".member-score-slider");
            const labelVal = row.querySelector(`#scoreVal_${member.id}`);
            if (slider && labelVal) {
                slider.addEventListener("input", () => {
                    labelVal.textContent = slider.value;
                });
            }
            membersScoresList.appendChild(row);
        });
    };
    // Guardar puntajes
    if (btnSaveScores) {
        btnSaveScores.addEventListener("click", () => __awaiter(void 0, void 0, void 0, function* () {
            const sliders = document.querySelectorAll(".member-score-slider");
            const updates = [];
            sliders.forEach(slider => {
                const playerId = parseInt(slider.dataset.playerId || "");
                const score = parseInt(slider.value);
                if (!isNaN(playerId) && !isNaN(score)) {
                    updates.push({ PlayerId: playerId, Score: score });
                }
            });
            if (updates.length === 0)
                return;
            btnSaveScores.disabled = true;
            btnSaveScores.textContent = "Guardando...";
            try {
                const response = yield fetch(`/Group/UpdateScores?groupId=${groupId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getAntiForgeryToken()
                    },
                    body: JSON.stringify(updates)
                });
                if (!response.ok) {
                    const errMsg = yield response.text();
                    throw new Error(errMsg || "Error al actualizar los puntajes.");
                }
                showToast("¡Puntajes guardados con éxito!", false);
                loadGroupData();
            }
            catch (error) {
                console.error("Error al guardar puntajes:", error);
                showToast(error.message || "No se pudieron guardar los puntajes.", true);
            }
            finally {
                btnSaveScores.disabled = false;
                btnSaveScores.innerHTML = `💾 Guardar Puntajes`;
            }
        }));
    }
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

interface GroupMember {
    id: number;
    name: string;
    nickname: string;
    photoUrl: string | null;
    initials: string;
    score: number;
}

interface DashboardData {
    groupId: number;
    groupName: string;
    isCreator: boolean;
    members: GroupMember[];
}

document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const groupNameTitle = document.getElementById("groupNameTitle") as HTMLHeadingElement | null;
    const membersScoresList = document.getElementById("membersScoresList") as HTMLDivElement | null;
    const membersCountBadge = document.getElementById("membersCountBadge") as HTMLSpanElement | null;
    const btnSaveScores = document.getElementById("btnSaveScores") as HTMLButtonElement | null;

    if (!groupIdInput || !groupNameTitle || !membersScoresList || !membersCountBadge) return;

    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId)) return;

    const showToast = (message: string, isError = false): void => {
        const toast = document.createElement("div");
        toast.className = `toast-notification ${isError ? 'toast-error' : 'toast-success'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        toast.offsetHeight;
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };

    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };

    const escapeHtml = (unsafe: string): string => {
        if (!unsafe) return "";
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const renderMembersList = (members: GroupMember[]): void => {
        membersScoresList!.innerHTML = "";
        membersCountBadge!.textContent = `${members.length} ${members.length === 1 ? 'MIEMBRO' : 'MIEMBROS'}`;

        if (members.length === 0) {
            membersScoresList!.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay miembros registrados en este grupo.</div>`;
            return;
        }

        members.forEach(member => {
            const defaultScore = member.score ? Math.round(member.score) : 6;

            const avatarContent = member.photoUrl
                ? `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`
                : `<span class="avatar-initials" style="font-size:13px;">${escapeHtml(member.initials)}</span>`;

            const nicknameHtml = (member.nickname && member.nickname !== member.name)
                ? `<div style="font-size:11px;color:var(--text-secondary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">@${escapeHtml(member.nickname)}</div>`
                : '';

            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);";
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                    <div class="avatar-container" style="width:38px;height:38px;margin-bottom:0;flex-shrink:0;">
                        ${avatarContent}
                    </div>
                    <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        <div style="font-size:14px;font-weight:700;color:var(--text-primary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${escapeHtml(member.name)}</div>
                        ${nicknameHtml}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;width:170px;justify-content:flex-end;">
                    <input type="range" class="member-score-slider" min="1" max="10" value="${defaultScore}" data-player-id="${member.id}" style="width:110px;accent-color:var(--neon-green-solid);margin:0;" />
                    <span class="member-score-val" id="scoreVal_${member.id}" style="color:var(--neon-green);font-weight:800;font-size:15px;width:24px;text-align:right;flex-shrink:0;">${defaultScore}</span>
                </div>
            `;

            const slider = row.querySelector(".member-score-slider") as HTMLInputElement | null;
            const labelVal = row.querySelector(`#scoreVal_${member.id}`) as HTMLSpanElement | null;
            if (slider && labelVal)
                slider.addEventListener("input", () => { labelVal.textContent = slider.value; });

            membersScoresList!.appendChild(row);
        });
    };

    // Cargar datos por AJAX — retorna Promise directamente para manejo externo
    const loadGroupData = (): Promise<void> =>
        fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 403) {
                        showToast("No tienes permisos de administrador.", true);
                        setTimeout(() => { window.location.href = `/Group/Dashboard?groupId=${groupId}`; }, 1500);
                        return;
                    }
                    showToast("Error al obtener los miembros del grupo.", true);
                    return;
                }
                return response.json().then((data: DashboardData) => {
                    groupNameTitle!.textContent = `Calificar Miembros - ${data.groupName}`;
                    renderMembersList(data.members);
                });
            })
            .catch(error => {
                console.error("Error cargando jugadores:", error);
                showToast("Ocurrió un error al cargar la lista de jugadores.", true);
            });

    if (btnSaveScores) {
        btnSaveScores.addEventListener("click", async () => {
            const sliders = document.querySelectorAll(".member-score-slider") as NodeListOf<HTMLInputElement>;
            const updates: { PlayerId: number; Score: number }[] = [];

            sliders.forEach(slider => {
                const playerId = parseInt(slider.dataset.playerId || "");
                const score = parseInt(slider.value);
                if (!isNaN(playerId) && !isNaN(score))
                    updates.push({ PlayerId: playerId, Score: score });
            });

            if (updates.length === 0) return;

            btnSaveScores.disabled = true;
            btnSaveScores.textContent = "Guardando...";

            try {
                const response = await fetch(`/Group/UpdateScores?groupId=${groupId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getAntiForgeryToken()
                    },
                    body: JSON.stringify(updates)
                });

                if (!response.ok) {
                    const errMsg = await response.text();
                    showToast(errMsg || "Error al actualizar los puntajes.", true);
                    return;
                }

                showToast("¡Puntajes guardados con éxito!", false);
                await loadGroupData();

            } catch (error: any) {
                console.error("Error al guardar puntajes:", error);
                showToast(error.message || "No se pudieron guardar los puntajes.", true);
            } finally {
                btnSaveScores.disabled = false;
                btnSaveScores.innerHTML = `💾 Guardar Puntajes`;
            }
        });
    }

    // Carga inicial — .catch() explícito para evitar "Promise ignored" warning
    loadGroupData().catch(err => console.error("Error en carga inicial:", err));
});

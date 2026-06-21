interface MatchPlayerDetails {
    playerId: number;
    name: string;
    nickname: string;
    team: number;
}

interface GroupMemberDetails {
    playerId: number;
    name: string;
    nickname: string;
    score: number;
}

interface MatchEditDetails {
    matchId: number;
    groupId: number;
    groupName: string;
    date: string;
    state: string;
    isCreator: boolean;
    matchPlayers: MatchPlayerDetails[];
    groupMembers: GroupMemberDetails[];
}

document.addEventListener("DOMContentLoaded", () => {
    const matchIdInput = document.getElementById("matchIdInput") as HTMLInputElement | null;
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const isCreatorInput = document.getElementById("isCreatorInput") as HTMLInputElement | null;

    // Elementos de la UI
    const matchDateTime = document.getElementById("matchDateTime") as HTMLInputElement | null;
    const membersCheckboxList = document.getElementById("membersCheckboxList") as HTMLDivElement | null;
    const teamAList = document.getElementById("teamAList") as HTMLDivElement | null;
    const teamBList = document.getElementById("teamBList") as HTMLDivElement | null;
    const countTeamA = document.getElementById("countTeamA") as HTMLSpanElement | null;
    const countTeamB = document.getElementById("countTeamB") as HTMLSpanElement | null;
    
    // Botones
    const btnRebalance = document.getElementById("btnRebalance") as HTMLButtonElement | null;
    const btnSaveChanges = document.getElementById("btnSaveChanges") as HTMLButtonElement | null;
    
    // Elementos de Carga de Resultado
    const finishMatchForm = document.getElementById("finishMatchForm") as HTMLFormElement | null;
    const goalsAhead = document.getElementById("goalsAhead") as HTMLInputElement | null;
    const goalsAheadVal = document.getElementById("goalsAheadVal") as HTMLSpanElement | null;
    const goalsAheadContainer = document.getElementById("goalsAheadContainer") as HTMLDivElement | null;
    const calculatedScore = document.getElementById("calculatedScore") as HTMLDivElement | null;
    const scoreWarning = document.getElementById("scoreWarning") as HTMLSpanElement | null;
    const btnFinishMatch = document.getElementById("btnFinishMatch") as HTMLButtonElement | null;

    if (!matchIdInput || !groupIdInput || !isCreatorInput) return;

    const matchId = parseInt(matchIdInput.value);
    const groupId = parseInt(groupIdInput.value);
    const isCreator = isCreatorInput.value === "true";

    if (isNaN(matchId) || isNaN(groupId)) return;

    // Estado local de jugadores
    let allMembers: GroupMemberDetails[] = [];
    let currentMatchPlayers: MatchPlayerDetails[] = [];

    // Toast premium helper
    const showToast = (message: string, isError: boolean = false): void => {
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

    // Cargar datos iniciales del partido
    const loadDetails = async (): Promise<void> => {
        try {
            const response = await fetch(`/Match/GetMatchDetails?matchId=${matchId}`);
            if (!response.ok) throw new Error("Error al obtener los detalles del partido.");

            const data: MatchEditDetails = await response.json();
            allMembers = data.groupMembers;
            currentMatchPlayers = data.matchPlayers;

            renderCheckboxes();
            renderTeams();
            initResultCalculations();

        } catch (error) {
            console.error("Error al cargar detalles:", error);
            showToast("No se pudieron cargar los datos del partido.", true);
        }
    };

    // Renderizar checkboxes de convocatoria
    const renderCheckboxes = (): void => {
        if (!membersCheckboxList) return;
        membersCheckboxList.innerHTML = "";

        allMembers.forEach(member => {
            const isChecked = currentMatchPlayers.some(p => p.playerId === member.playerId);
            const wrapper = document.createElement("label");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.gap = "8px";
            wrapper.style.fontSize = "13px";
            wrapper.style.color = "var(--text-secondary)";
            wrapper.style.background = "rgba(255,255,255,0.02)";
            wrapper.style.padding = "6px 10px";
            wrapper.style.borderRadius = "var(--border-radius-sm)";
            wrapper.style.border = "1px solid rgba(255,255,255,0.04)";
            wrapper.style.cursor = "pointer";

            wrapper.innerHTML = `
                <input type="checkbox" value="${member.playerId}" ${isChecked ? 'checked' : ''} style="accent-color: var(--neon-green-solid);" />
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(member.nickname)}</span>
            `;

            // Escuchar cambios
            const checkbox = wrapper.querySelector('input[type="checkbox"]') as HTMLInputElement;
            checkbox.addEventListener("change", () => {
                const checked = checkbox.checked;
                if (checked) {
                    // Agregar a la lista temporal
                    currentMatchPlayers.push({
                        playerId: member.playerId,
                        name: member.name,
                        nickname: member.nickname,
                        team: 1 // Por defecto al equipo 1
                    });
                } else {
                    // Quitar de la lista temporal
                    currentMatchPlayers = currentMatchPlayers.filter(p => p.playerId !== member.playerId);
                }
                renderTeams();
            });

            membersCheckboxList.appendChild(wrapper);
        });
    };

    // Renderizar equipos A y B
    const renderTeams = (): void => {
        if (!teamAList || !teamBList || !countTeamA || !countTeamB) return;

        const teamA = currentMatchPlayers.filter(p => p.team === 1);
        const teamB = currentMatchPlayers.filter(p => p.team === 2);
        const teamNone = currentMatchPlayers.filter(p => p.team !== 1 && p.team !== 2);

        countTeamA.textContent = teamA.length.toString();
        countTeamB.textContent = teamB.length.toString();

        teamAList.innerHTML = teamA.length > 0
            ? teamA.map(p => `<div>• ${escapeHtml(p.nickname)}</div>`).join("")
            : `<div style="font-style: italic; color: var(--text-muted);">Sin jugadores</div>`;

        teamBList.innerHTML = teamB.length > 0
            ? teamB.map(p => `<div>• ${escapeHtml(p.nickname)}</div>`).join("")
            : `<div style="font-style: italic; color: var(--text-muted);">Sin jugadores</div>`;

        // Si hay jugadores convocados pero sin equipo asignado, ponerlos en Equipo A por defecto
        if (teamNone.length > 0) {
            teamNone.forEach(p => p.team = 1);
            renderTeams();
        }
    };

    // Botón: Re-balancear Equipos
    if (btnRebalance) {
        btnRebalance.addEventListener("click", async () => {
            const playerIds = currentMatchPlayers.map(p => p.playerId);
            if (playerIds.length < 2) {
                showToast("Debes convocar al menos 2 jugadores para poder balancear.", true);
                return;
            }

            btnRebalance.disabled = true;
            btnRebalance.textContent = "Balanceando...";

            try {
                const response = await fetch(`/Match/BalancePlayers`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getAntiForgeryToken()
                    },
                    body: JSON.stringify({
                        groupId: groupId,
                        playerIds: playerIds
                    })
                });

                if (!response.ok) throw new Error("Error en el balanceador.");

                const teamsBalanced: { [key: string]: number } = await response.json();

                // Actualizar los equipos locales en el estado
                currentMatchPlayers.forEach(p => {
                    const teamId = teamsBalanced[p.playerId.toString()];
                    if (teamId) {
                        p.team = teamId;
                    }
                });

                renderTeams();
                showToast("¡Equipos re-balanceados con éxito!", false);

            } catch (error) {
                console.error("Error al re-balancear:", error);
                showToast("No se pudo re-balancear el partido.", true);
            } finally {
                btnRebalance.disabled = false;
                btnRebalance.textContent = "🔄 Volver a Emparejar";
            }
        });
    }

    // Botón: Guardar Cambios de Convocados/Fecha
    if (btnSaveChanges) {
        btnSaveChanges.addEventListener("click", async () => {
            if (!matchDateTime || !matchDateTime.value) {
                showToast("Por favor selecciona una fecha válida.", true);
                return;
            }

            btnSaveChanges.disabled = true;
            btnSaveChanges.textContent = "Guardando...";

            const payload = {
                matchId: matchId,
                date: matchDateTime.value,
                players: currentMatchPlayers.map(p => ({
                    playerId: p.playerId,
                    team: p.team
                }))
            };

            try {
                const response = await fetch(`/Match/UpdateMatch`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getAntiForgeryToken()
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error("Error al guardar cambios.");

                showToast("¡Partido actualizado correctamente!", false);

            } catch (error) {
                console.error("Error al guardar cambios del partido:", error);
                showToast("No se pudieron guardar los cambios.", true);
            } finally {
                btnSaveChanges.disabled = false;
                btnSaveChanges.textContent = "💾 Guardar Cambios del Partido";
            }
        });
    }

    // Lógica para el Marcador en Tiempo Real
    const initResultCalculations = (): void => {
        if (!goalsAhead || !calculatedScore || !scoreWarning || !btnFinishMatch) return;

        const updateScoreCalculation = (): void => {
            const winnerInput = document.querySelector('input[name="matchWinner"]:checked') as HTMLInputElement | null;
            const winner = winnerInput ? winnerInput.value : "A";

            // Si es empate, la diferencia no aplica
            if (winner === "Empate") {
                if (goalsAheadContainer) {
                    goalsAheadContainer.style.opacity = "0.3";
                    goalsAhead.disabled = true;
                }
                if (goalsAheadVal) goalsAheadVal.textContent = "-";
                
                scoreWarning.style.display = "none";
                calculatedScore.textContent = `Equipo A 0 - 0 Equipo B`;
                btnFinishMatch.disabled = false;
                return;
            }

            // Si no es empate
            if (goalsAheadContainer) {
                goalsAheadContainer.style.opacity = "1";
                goalsAhead.disabled = false;
            }
            const arriba = parseInt(goalsAhead.value) || 1;
            if (goalsAheadVal) goalsAheadVal.textContent = arriba.toString();

            scoreWarning.style.display = "none";
            btnFinishMatch.disabled = false;

            if (winner === "A") {
                calculatedScore.textContent = `Equipo A ${arriba} - 0 Equipo B`;
            } else {
                calculatedScore.textContent = `Equipo A 0 - ${arriba} Equipo B`;
            }
        };

        goalsAhead.addEventListener("input", updateScoreCalculation);
        
        document.querySelectorAll('input[name="matchWinner"]').forEach(radio => {
            radio.addEventListener("change", updateScoreCalculation);
        });

        // Ejecutar cálculo inicial
        updateScoreCalculation();
    };

    // Enviar Formulario de Finalización de Partido
    if (finishMatchForm) {
        finishMatchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!goalsAhead || !btnFinishMatch) return;

            const winnerInput = document.querySelector('input[name="matchWinner"]:checked') as HTMLInputElement | null;
            const winner = winnerInput ? winnerInput.value : "A";

            btnFinishMatch.disabled = true;
            btnFinishMatch.textContent = "Guardando resultado...";

            const payload = {
                matchId: matchId,
                totalGoals: winner === "Empate" ? 0 : parseInt(goalsAhead.value),
                goalsAhead: winner === "Empate" ? 0 : parseInt(goalsAhead.value),
                winner: winner
            };

            try {
                const response = await fetch(`/Match/FinishMatch`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getAntiForgeryToken()
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error("Error al registrar el resultado.");

                showToast("¡Partido finalizado y resultado registrado!", false);

                setTimeout(() => {
                    window.location.href = `/Group/Dashboard?groupId=${groupId}`;
                }, 1500);

            } catch (error) {
                console.error("Error al finalizar partido:", error);
                showToast("No se pudo registrar el resultado del partido.", true);
                btnFinishMatch.disabled = false;
                btnFinishMatch.textContent = "🏁 Finalizar y Registrar Partido";
            }
        });
    }

    // Cargar detalles al inicio
    loadDetails();
});

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

"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const matchIdInput = document.getElementById("matchIdInput");
    const groupIdInput = document.getElementById("groupIdInput");
    const isCreatorInput = document.getElementById("isCreatorInput");
    // Elementos de la UI
    const matchDateTime = document.getElementById("matchDateTime");
    const membersCheckboxList = document.getElementById("membersCheckboxList");
    const teamAList = document.getElementById("teamAList");
    const teamBList = document.getElementById("teamBList");
    const countTeamA = document.getElementById("countTeamA");
    const countTeamB = document.getElementById("countTeamB");
    // Botones
    const btnRebalance = document.getElementById("btnRebalance");
    const btnSaveChanges = document.getElementById("btnSaveChanges");
    // Elementos de Carga de Resultado
    const finishMatchForm = document.getElementById("finishMatchForm");
    const goalsAhead = document.getElementById("goalsAhead");
    const goalsAheadVal = document.getElementById("goalsAheadVal");
    const goalsAheadContainer = document.getElementById("goalsAheadContainer");
    const calculatedScore = document.getElementById("calculatedScore");
    const scoreWarning = document.getElementById("scoreWarning");
    const btnFinishMatch = document.getElementById("btnFinishMatch");
    // Nuevos elementos para la modalidad Goles Totales
    const btnModeAhead = document.getElementById("btnModeAhead");
    const btnModeTotal = document.getElementById("btnModeTotal");
    const matchResultMode = document.getElementById("matchResultMode");
    const totalGoalsContainer = document.getElementById("totalGoalsContainer");
    const goalsTeamA = document.getElementById("goalsTeamA");
    const goalsTeamAVal = document.getElementById("goalsTeamAVal");
    const goalsTeamB = document.getElementById("goalsTeamB");
    const goalsTeamBVal = document.getElementById("goalsTeamBVal");
    // Elementos de eliminación
    const btnDeleteMatch = document.getElementById("btnDeleteMatch");
    const deleteMatchConfirmModal = document.getElementById("deleteMatchConfirmModal");
    const btnConfirmDeleteCancel = document.getElementById("btnConfirmDeleteCancel");
    const btnConfirmDeleteYes = document.getElementById("btnConfirmDeleteYes");
    // Elementos de asignación manual
    const btnManualSwapToggle = document.getElementById("btnManualSwapToggle");
    const manualSwapSection = document.getElementById("manualSwapSection");
    const swapPlayerA = document.getElementById("swapPlayerA");
    const swapPlayerB = document.getElementById("swapPlayerB");
    const btnExecuteSwap = document.getElementById("btnExecuteSwap");
    if (!matchIdInput || !groupIdInput || !isCreatorInput)
        return;
    const matchId = parseInt(matchIdInput.value);
    const groupId = parseInt(groupIdInput.value);
    if (isNaN(matchId) || isNaN(groupId))
        return;
    // Estado local de jugadores
    let allMembers = [];
    let currentMatchPlayers = [];
    // Toast premium helper
    const showToast = (message, isError = false) => {
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
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    };
    // Cargar datos iniciales del partido
    const loadDetails = async () => {
        try {
            const response = await fetch(`/Match/GetMatchDetails?matchId=${matchId}`);
            if (!response.ok) {
                showToast("No se pudieron cargar los datos del partido.", true);
                return;
            }
            const data = await response.json();
            allMembers = data.groupMembers;
            currentMatchPlayers = data.matchPlayers;
            renderCheckboxes();
            renderTeams();
            initResultCalculations();
        }
        catch (error) {
            console.error("Error al cargar detalles:", error);
            showToast("No se pudieron cargar los datos del partido.", true);
        }
    };
    // Renderizar checkboxes de convocatoria
    const renderCheckboxes = () => {
        if (!membersCheckboxList)
            return;
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
            const checkbox = wrapper.querySelector('input[type="checkbox"]');
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
                }
                else {
                    // Quitar de la lista temporal
                    currentMatchPlayers = currentMatchPlayers.filter(p => p.playerId !== member.playerId);
                }
                renderTeams();
            });
            membersCheckboxList.appendChild(wrapper);
        });
    };
    // Renderizar equipos A y B
    const renderTeams = () => {
        if (!teamAList || !teamBList || !countTeamA || !countTeamB)
            return;
        const teamA = currentMatchPlayers.filter(p => p.team === 1);
        const teamB = currentMatchPlayers.filter(p => p.team === 2);
        const teamNone = currentMatchPlayers.filter(p => p.team !== 1 && p.team !== 2);
        countTeamA.textContent = teamA.length.toString();
        countTeamB.textContent = teamB.length.toString();
        const countSpan = document.getElementById("selectedPlayersCount");
        if (countSpan) {
            countSpan.textContent = `Seleccionados: ${currentMatchPlayers.length}`;
        }
        teamAList.innerHTML = teamA.length > 0
            ? teamA.map(p => `<div>• ${escapeHtml(p.nickname)}</div>`).join("")
            : `<div style="font-style: italic; color: var(--text-muted);">Sin jugadores</div>`;
        teamBList.innerHTML = teamB.length > 0
            ? teamB.map(p => `<div>• ${escapeHtml(p.nickname)}</div>`).join("")
            : `<div style="font-style: italic; color: var(--text-muted);">Sin jugadores</div>`;
        populateSwapDropdowns();
        // Si hay jugadores convocados pero sin equipo asignado, ponerlos en Equipo A por defecto
        if (teamNone.length > 0) {
            teamNone.forEach(p => p.team = 1);
            renderTeams();
        }
    };
    function populateSwapDropdowns() {
        if (!swapPlayerA || !swapPlayerB)
            return;
        const teamA = currentMatchPlayers.filter(p => p.team === 1);
        const teamB = currentMatchPlayers.filter(p => p.team === 2);
        swapPlayerA.innerHTML = teamA.map(p => `<option value="${p.playerId}">${escapeHtml(p.nickname)}</option>`).join("");
        swapPlayerB.innerHTML = teamB.map(p => `<option value="${p.playerId}">${escapeHtml(p.nickname)}</option>`).join("");
    }
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
                if (!response.ok) {
                    showToast("No se pudo re-balancear el partido.", true);
                    return;
                }
                const teamsBalanced = await response.json();
                // Actualizar los equipos locales en el estado
                currentMatchPlayers.forEach(p => {
                    const teamId = teamsBalanced[p.playerId.toString()];
                    if (teamId) {
                        p.team = teamId;
                    }
                });
                renderTeams();
                showToast("¡Equipos re-balanceados con éxito!", false);
            }
            catch (error) {
                console.error("Error al re-balancear:", error);
                showToast("No se pudo re-balancear el partido.", true);
            }
            finally {
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
            btnSaveChanges.classList.add("btn-loading");
            const spinner = document.createElement("span");
            spinner.className = "btn-spinner";
            btnSaveChanges.appendChild(spinner);
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
                if (!response.ok) {
                    showToast("No se pudieron guardar los cambios.", true);
                    return;
                }
                showToast("¡Partido actualizado correctamente!", false);
            }
            catch (error) {
                console.error("Error al guardar cambios del partido:", error);
                showToast("No se pudieron guardar los cambios.", true);
            }
            finally {
                btnSaveChanges.disabled = false;
                btnSaveChanges.classList.remove("btn-loading");
                const existingSpinner = btnSaveChanges.querySelector(".btn-spinner");
                if (existingSpinner)
                    existingSpinner.remove();
            }
        });
    }
    // Lógica para el Marcador en Tiempo Real y modalidad de carga
    const initResultCalculations = () => {
        if (!goalsAhead || !calculatedScore || !scoreWarning || !btnFinishMatch || !btnModeAhead || !btnModeTotal || !matchResultMode || !totalGoalsContainer || !goalsTeamA || !goalsTeamAVal || !goalsTeamB || !goalsTeamBVal)
            return;
        // Cambiar a modalidad Goles Arriba
        btnModeAhead.addEventListener("click", () => {
            matchResultMode.value = "ahead";
            btnModeAhead.style.background = "var(--neon-green-solid)";
            btnModeAhead.style.color = "#090a0d";
            btnModeTotal.style.background = "transparent";
            btnModeTotal.style.color = "var(--neon-green)";
            if (goalsAheadContainer)
                goalsAheadContainer.style.display = "block";
            if (totalGoalsContainer)
                totalGoalsContainer.style.display = "none";
            updateScoreCalculation();
        });
        // Cambiar a modalidad Goles Totales
        btnModeTotal.addEventListener("click", () => {
            matchResultMode.value = "total";
            btnModeTotal.style.background = "var(--neon-green-solid)";
            btnModeTotal.style.color = "#090a0d";
            btnModeAhead.style.background = "transparent";
            btnModeAhead.style.color = "var(--neon-green)";
            if (goalsAheadContainer)
                goalsAheadContainer.style.display = "none";
            if (totalGoalsContainer)
                totalGoalsContainer.style.display = "block";
            updateScoreCalculation();
        });
        const updateScoreCalculation = () => {
            const mode = matchResultMode.value;
            const winnerInput = document.querySelector('input[name="matchWinner"]:checked');
            const winner = winnerInput ? winnerInput.value : "A";
            scoreWarning.style.display = "none";
            btnFinishMatch.disabled = false;
            if (mode === "ahead") {
                if (goalsAheadContainer) {
                    goalsAheadContainer.style.opacity = "1";
                    goalsAhead.disabled = false;
                }
                if (winner === "Empate") {
                    if (goalsAheadContainer) {
                        goalsAheadContainer.style.opacity = "0.3";
                        goalsAhead.disabled = true;
                    }
                    if (goalsAheadVal)
                        goalsAheadVal.textContent = "-";
                    calculatedScore.textContent = `Equipo A 0 - 0 Equipo B`;
                }
                else {
                    const arriba = parseInt(goalsAhead.value) || 1;
                    if (goalsAheadVal)
                        goalsAheadVal.textContent = arriba.toString();
                    if (winner === "A") {
                        calculatedScore.textContent = `Equipo A ${arriba} - 0 Equipo B`;
                    }
                    else {
                        calculatedScore.textContent = `Equipo A 0 - ${arriba} Equipo B`;
                    }
                }
            }
            else {
                const golesA = parseInt(goalsTeamA.value) || 0;
                const golesB = parseInt(goalsTeamB.value) || 0;
                if (goalsTeamAVal)
                    goalsTeamAVal.textContent = golesA.toString();
                if (goalsTeamBVal)
                    goalsTeamBVal.textContent = golesB.toString();
                calculatedScore.textContent = `Equipo A ${golesA} - ${golesB} Equipo B`;
                // Sincronizar radio buttons del ganador
                const radioA = document.querySelector('input[name="matchWinner"][value="A"]');
                const radioB = document.querySelector('input[name="matchWinner"][value="B"]');
                const radioEmpate = document.querySelector('input[name="matchWinner"][value="Empate"]');
                if (golesA > golesB) {
                    if (radioA)
                        radioA.checked = true;
                }
                else if (golesA < golesB) {
                    if (radioB)
                        radioB.checked = true;
                }
                else {
                    if (radioEmpate)
                        radioEmpate.checked = true;
                }
            }
        };
        goalsAhead.addEventListener("input", updateScoreCalculation);
        goalsTeamA.addEventListener("input", updateScoreCalculation);
        goalsTeamB.addEventListener("input", updateScoreCalculation);
        document.querySelectorAll('input[name="matchWinner"]').forEach(radio => {
            radio.addEventListener("change", () => {
                if (matchResultMode.value === "total") {
                    const winner = radio.value;
                    const golesA = parseInt(goalsTeamA.value) || 0;
                    const golesB = parseInt(goalsTeamB.value) || 0;
                    if (winner === "Empate") {
                        goalsTeamB.value = golesA.toString();
                    }
                    else if (winner === "A" && golesA <= golesB) {
                        goalsTeamA.value = (golesB + 1).toString();
                    }
                    else if (winner === "B" && golesB <= golesA) {
                        goalsTeamB.value = (golesA + 1).toString();
                    }
                }
                updateScoreCalculation();
            });
        });
        // Ejecutar cálculo inicial
        updateScoreCalculation();
    };
    // Enviar Formulario de Finalización de Partido
    if (finishMatchForm) {
        finishMatchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!goalsAhead || !goalsTeamA || !goalsTeamB || !matchResultMode || !btnFinishMatch)
                return;
            const winnerInput = document.querySelector('input[name="matchWinner"]:checked');
            const winner = winnerInput ? winnerInput.value : "A";
            const mode = matchResultMode.value;
            btnFinishMatch.disabled = true;
            btnFinishMatch.classList.add("btn-loading");
            const spinner = document.createElement("span");
            spinner.className = "btn-spinner";
            btnFinishMatch.appendChild(spinner);
            let goalsAheadValNum;
            let totalGoalsValNum;
            if (mode === "ahead") {
                goalsAheadValNum = winner === "Empate" ? 0 : parseInt(goalsAhead.value);
                totalGoalsValNum = goalsAheadValNum;
            }
            else {
                const golesA = parseInt(goalsTeamA.value) || 0;
                const golesB = parseInt(goalsTeamB.value) || 0;
                totalGoalsValNum = golesA + golesB;
                goalsAheadValNum = Math.abs(golesA - golesB);
            }
            const payload = {
                matchId: matchId,
                totalGoals: totalGoalsValNum,
                goalsAhead: goalsAheadValNum,
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
                if (!response.ok) {
                    showToast("No se pudo registrar el resultado del partido.", true);
                    return;
                }
                showToast("¡Partido finalizado y resultado registrado!", false);
                setTimeout(() => {
                    window.location.href = `/Group/Dashboard?groupId=${groupId}`;
                }, 1500);
            }
            catch (error) {
                console.error("Error al finalizar partido:", error);
                showToast("No se pudo registrar el resultado del partido.", true);
            }
            finally {
                btnFinishMatch.disabled = false;
                btnFinishMatch.classList.remove("btn-loading");
                const existingSpinner = btnFinishMatch.querySelector(".btn-spinner");
                if (existingSpinner)
                    existingSpinner.remove();
            }
        });
    }
    // Toggle manual swap section
    if (btnManualSwapToggle) {
        btnManualSwapToggle.addEventListener("click", () => {
            if (!manualSwapSection)
                return;
            const isHidden = manualSwapSection.style.display === "none";
            manualSwapSection.style.display = isHidden ? "block" : "none";
            if (isHidden) {
                populateSwapDropdowns();
            }
        });
    }
    // Execute swap
    if (btnExecuteSwap) {
        btnExecuteSwap.addEventListener("click", () => {
            if (!swapPlayerA || !swapPlayerB)
                return;
            const valA = parseInt(swapPlayerA.value);
            const valB = parseInt(swapPlayerB.value);
            if (isNaN(valA) || isNaN(valB)) {
                showToast("Por favor selecciona dos jugadores para intercambiar.", true);
                return;
            }
            const pA = currentMatchPlayers.find(p => p.playerId === valA);
            const pB = currentMatchPlayers.find(p => p.playerId === valB);
            if (pA && pB) {
                pA.team = 2;
                pB.team = 1;
                renderTeams();
                showToast("Jugadores intercambiados correctamente.", false);
            }
        });
    }
    // Modal de Confirmación de Eliminación
    if (btnDeleteMatch) {
        btnDeleteMatch.addEventListener("click", () => {
            if (!deleteMatchConfirmModal)
                return;
            const confirmCard = document.getElementById("deleteMatchConfirmCard");
            deleteMatchConfirmModal.style.display = "flex";
            deleteMatchConfirmModal.offsetHeight; // force reflow
            deleteMatchConfirmModal.style.opacity = "1";
            if (confirmCard)
                confirmCard.style.transform = "scale(1)";
        });
    }
    const closeDeleteModal = () => {
        if (!deleteMatchConfirmModal)
            return;
        const confirmCard = document.getElementById("deleteMatchConfirmCard");
        deleteMatchConfirmModal.style.opacity = "0";
        if (confirmCard)
            confirmCard.style.transform = "scale(0.9)";
        setTimeout(() => {
            deleteMatchConfirmModal.style.display = "none";
        }, 200);
    };
    if (btnConfirmDeleteCancel) {
        btnConfirmDeleteCancel.addEventListener("click", closeDeleteModal);
    }
    // Cerrar modal al hacer click fuera de la tarjeta de confirmación
    if (deleteMatchConfirmModal) {
        deleteMatchConfirmModal.addEventListener("click", (e) => {
            const confirmCard = document.getElementById("deleteMatchConfirmCard");
            if (confirmCard && !confirmCard.contains(e.target)) {
                closeDeleteModal();
            }
        });
    }
    if (btnConfirmDeleteYes) {
        btnConfirmDeleteYes.addEventListener("click", async () => {
            if (!matchIdInput || !groupIdInput)
                return;
            const id = parseInt(matchIdInput.value);
            const groupId = parseInt(groupIdInput.value);
            if (isNaN(id))
                return;
            btnConfirmDeleteYes.disabled = true;
            btnConfirmDeleteYes.textContent = "Eliminando...";
            try {
                const response = await fetch(`/Match/DeleteMatch?matchId=${id}`, {
                    method: "POST",
                    headers: {
                        "RequestVerificationToken": getAntiForgeryToken()
                    }
                });
                if (!response.ok) {
                    showToast("No se pudo eliminar el partido.", true);
                    btnConfirmDeleteYes.disabled = false;
                    btnConfirmDeleteYes.textContent = "Sí, Eliminar";
                    return;
                }
                showToast("¡Partido eliminado correctamente!", false);
                setTimeout(() => {
                    window.location.href = `/Group/Dashboard?groupId=${groupId}`;
                }, 1500);
            }
            catch (error) {
                console.error("Error al eliminar partido:", error);
                showToast("No se pudo eliminar el partido.", true);
                btnConfirmDeleteYes.disabled = false;
                btnConfirmDeleteYes.textContent = "Sí, Eliminar";
            }
        });
    }
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
    // Cargar detalles al inicio
    loadDetails().catch(err => console.error('Error:', err));
});

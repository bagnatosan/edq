interface GroupMember {
    id: number;
    name: string;
    nickname: string;
    photoUrl: string | null;
    initials: string;
    score: number;
    winrate: number;
}

interface GroupDashboardData {
    groupId: number;
    groupName: string;
    isCreator: boolean;
    members: GroupMember[];
}

document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const groupNameTitle = document.getElementById("groupNameTitle") as HTMLHeadingElement | null;
    const playersCheckboxGrid = document.getElementById("playersCheckboxGrid") as HTMLDivElement | null;
    const matchDateTime = document.getElementById("matchDateTime") as HTMLInputElement | null;
    
    const btnSelectAll = document.getElementById("btnSelectAll") as HTMLButtonElement | null;
    const btnClearAll = document.getElementById("btnClearAll") as HTMLButtonElement | null;
    const btnBalanceAndCreate = document.getElementById("btnBalanceAndCreate") as HTMLButtonElement | null;

    if (!groupIdInput || !groupNameTitle || !playersCheckboxGrid || !matchDateTime) return;

    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId)) return;

    // Establecer la fecha predeterminada para el picker (próximo viernes a las 19:00 hs)
    const setNextFridayDateTime = (): void => {
        const now = new Date();
        const nextFriday = new Date(now);
        nextFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7));
        nextFriday.setHours(19, 0, 0, 0);

        // Formatear a 'YYYY-MM-DDTHH:MM' para datetime-local
        const pad = (num: number): string => num.toString().padStart(2, '0');
        const year = nextFriday.getFullYear();
        const month = pad(nextFriday.getMonth() + 1);
        const date = pad(nextFriday.getDate());
        const hours = pad(nextFriday.getHours());
        const minutes = pad(nextFriday.getMinutes());
        
        matchDateTime.value = `${year}-${month}-${date}T${hours}:${minutes}`;
    };

    setNextFridayDateTime();

    const checkPollPreselection = async (): Promise<void> => {
        try {
            const response = await fetch(`/Chat/GetLatestPollVoters?groupId=${groupId}`);
            if (response.ok) {
                const playerIds: number[] = await response.json();
                if (playerIds && playerIds.length > 0) {
                    const checkboxes = playersCheckboxGrid.querySelectorAll('input[name="selectedPlayers"]') as NodeListOf<HTMLInputElement>;
                    checkboxes.forEach(cb => {
                        const playerId = parseInt(cb.value);
                        cb.checked = playerIds.includes(playerId);
                    });
                }
            }
        } catch (error) {
            console.error("Error pre-selecting players from poll:", error);
        }
    };

    // Cargar los miembros del grupo por AJAX
    const loadGroupMembers = async (): Promise<void> => {
        try {
            const response = await fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) {
                showToast("No se pudieron cargar los miembros del grupo.", true);
                return;
            }

            const data: GroupDashboardData = await response.json();

            groupNameTitle.textContent = `Crear Partido - ${data.groupName}`;
            renderPlayersCheckboxes(data.members);
            
            await checkPollPreselection();

        } catch (error) {
            console.error("Error al cargar los miembros:", error);
            showToast("No se pudieron cargar los miembros del grupo.", true);
        }
    };

    // Renderizar los checkboxes
    const renderPlayersCheckboxes = (members: GroupMember[]): void => {
        if (!playersCheckboxGrid) return;
        playersCheckboxGrid.innerHTML = "";

        if (members.length === 0) {
            playersCheckboxGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 20px;">No hay miembros registrados en este grupo.</div>`;
            return;
        }

        members.forEach(member => {
            const label = document.createElement("label");
            label.className = "player-checkbox-item";

            let avatarContent : string;
            if (member.photoUrl) {
                avatarContent = `<img src="${escapeHtml(member.photoUrl)}" class="avatar-image" alt="${escapeHtml(member.nickname)}" />`;
            } else {
                avatarContent = escapeHtml(member.initials);
            }

            label.innerHTML = `
                <input type="checkbox" name="selectedPlayers" value="${member.id}" checked />
                <span class="checkbox-custom"></span>
                <div class="player-avatar-mini">
                    ${avatarContent}
                </div>
                <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1;">${escapeHtml(member.nickname)}</span>
            `;

            playersCheckboxGrid.appendChild(label);
        });
    };

    // Botones de Selección Rápida
    if (btnSelectAll) {
        btnSelectAll.addEventListener("click", () => {
            const checkboxes = document.querySelectorAll('input[name="selectedPlayers"]') as NodeListOf<HTMLInputElement>;
            checkboxes.forEach(cb => cb.checked = true);
        });
    }

    if (btnClearAll) {
        btnClearAll.addEventListener("click", () => {
            const checkboxes = document.querySelectorAll('input[name="selectedPlayers"]') as NodeListOf<HTMLInputElement>;
            checkboxes.forEach(cb => cb.checked = false);
        });
    }

    // Elementos del modal de carga de emparejamiento
    const matchmakingLoadingModal = document.getElementById("matchmakingLoadingModal") as HTMLDivElement | null;
    const matchmakingLoadingCard = document.getElementById("matchmakingLoadingCard") as HTMLDivElement | null;
    const loadingProgressPath = document.getElementById("loadingProgressPath") as HTMLElement | null;
    const loadingIconContainer = document.getElementById("loadingIconContainer") as HTMLDivElement | null;
    const loadingTitle = document.getElementById("loadingTitle") as HTMLHeadingElement | null;
    const loadingSubtitle = document.getElementById("loadingSubtitle") as HTMLParagraphElement | null;
    const loadingPercent = document.getElementById("loadingPercent") as HTMLSpanElement | null;

    // Botones de Envío
    if (btnBalanceAndCreate) {
        btnBalanceAndCreate.addEventListener("click", async () => {
            const checkboxes = document.querySelectorAll('input[name="selectedPlayers"]:checked') as NodeListOf<HTMLInputElement>;
            const selectedIds: number[] = [];
            checkboxes.forEach(cb => {
                const id = parseInt(cb.value);
                if (!isNaN(id)) selectedIds.push(id);
            });

            if (selectedIds.length < 2) {
                showToast("Debes seleccionar al menos dos jugadores para poder balancear y crear el partido.", true);
                return;
            }

            if (!matchDateTime.value) {
                showToast("Por favor selecciona una fecha y hora para el encuentro.", true);
                return;
            }

            // Mostrar modal de carga
            if (!matchmakingLoadingModal || !matchmakingLoadingCard || !loadingProgressPath || !loadingPercent || !loadingTitle || !loadingSubtitle || !loadingIconContainer) return;

            // Resetear estado del loader
            loadingTitle.textContent = "Balanceando Equipos";
            loadingSubtitle.textContent = "Ejecutando algoritmo de emparejamiento...";
            loadingPercent.textContent = "0%";
            loadingProgressPath.setAttribute("stroke-dasharray", "0, 100");
            loadingIconContainer.textContent = "⚖️";
            loadingIconContainer.style.transform = "translate(-50%, -50%) scale(1)";
            matchmakingLoadingCard.style.borderColor = "rgba(255, 255, 255, 0.05)";
            matchmakingLoadingCard.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.6)";

            matchmakingLoadingModal.style.display = "flex";
            matchmakingLoadingModal.offsetHeight; // Forzar reflow
            matchmakingLoadingModal.style.opacity = "1";
            matchmakingLoadingCard.style.transform = "scale(1)";

            // Animación de barra de progreso simulada
            let currentProgress = 0;
            const progressSpeed = 60; // 60ms por tick (duplica la duración de la animación)
            const targetSimulatedProgress = 95;
            
            const progressInterval = setInterval(() => {
                if (currentProgress < targetSimulatedProgress) {
                    currentProgress += 1.5;
                    if (currentProgress > targetSimulatedProgress) currentProgress = targetSimulatedProgress;
                    
                    const progressVal = Math.round(currentProgress);
                    loadingPercent.textContent = `${progressVal}%`;
                    loadingProgressPath.setAttribute("stroke-dasharray", `${progressVal}, 100`);
                }
            }, progressSpeed);

            try {
                // Realizar llamada al backend para balancear y crear el partido
                const response = await fetch(`/Group/BalanceAndCreateMatch`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken": getAntiForgeryToken()
                    },
                    body: JSON.stringify({
                        groupId: groupId,
                        date: matchDateTime.value,
                        playerIds: selectedIds
                    })
                });

                clearInterval(progressInterval);

                if (!response.ok) {
                    const errorText = await response.text();
                    // Ocultar modal de carga
                    matchmakingLoadingModal.style.opacity = "0";
                    matchmakingLoadingCard.style.transform = "scale(0.9)";
                    setTimeout(() => {
                        matchmakingLoadingModal.style.display = "none";
                    }, 250);
                    showToast(errorText || "Error al balancear y crear el partido.", true);
                    return;
                }

                // Completar al 100% de inmediato
                loadingPercent.textContent = "100%";
                loadingProgressPath.setAttribute("stroke-dasharray", "100, 100");

                // Mostrar estado de éxito premium
                setTimeout(() => {
                    loadingTitle.textContent = "¡Completado!";
                    loadingSubtitle.textContent = "Partido creado correctamente";
                    loadingPercent.textContent = "Listo";
                    loadingIconContainer.textContent = "✔️";
                    loadingIconContainer.style.transform = "translate(-50%, -50%) scale(1.2)";

                    matchmakingLoadingCard.style.borderColor = "var(--neon-green-solid)";
                    matchmakingLoadingCard.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px var(--neon-green-glow)";

                    // Redirección después de mostrar el estado de éxito
                    setTimeout(() => {
                        window.location.href = `/Group/Dashboard?groupId=${groupId}`;
                    }, 1500);
                }, 300);

            } catch (error: any) {
                clearInterval(progressInterval);
                console.error("Error al balancear y crear el partido:", error);
                
                // Ocultar modal de carga
                matchmakingLoadingModal.style.opacity = "0";
                matchmakingLoadingCard.style.transform = "scale(0.9)";
                setTimeout(() => {
                    matchmakingLoadingModal.style.display = "none";
                }, 250);

                // Mostrar error con toast premium
                showToast(error.message || "No se pudo crear el partido balanceado.", true);
            }
        });
    }

    // Helper Toast
    const showToast = (message: string, isError: boolean = false): void => {
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

    // Cargar miembros al cargar la página
    loadGroupMembers().catch(err => console.error('Error:', err));
});

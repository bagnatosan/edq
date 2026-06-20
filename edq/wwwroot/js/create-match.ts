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

    // Cargar los miembros del grupo por AJAX
    const loadGroupMembers = async (): Promise<void> => {
        try {
            const response = await fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) throw new Error("Error al obtener miembros del grupo.");

            const data: GroupDashboardData = await response.json();

            groupNameTitle.textContent = `Crear Partido - ${data.groupName}`;
            renderPlayersCheckboxes(data.members);

        } catch (error) {
            console.error("Error al cargar los miembros:", error);
            alert("No se pudieron cargar los miembros del grupo.");
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

            let avatarContent = "";
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

    // Botón de Envío
    if (btnBalanceAndCreate) {
        btnBalanceAndCreate.addEventListener("click", () => {
            const checkboxes = document.querySelectorAll('input[name="selectedPlayers"]:checked') as NodeListOf<HTMLInputElement>;
            const selectedIds: number[] = [];
            checkboxes.forEach(cb => {
                const id = parseInt(cb.value);
                if (!isNaN(id)) selectedIds.push(id);
            });

            if (selectedIds.length === 0) {
                alert("Debes seleccionar al menos un jugador para convocar al partido.");
                return;
            }

            if (!matchDateTime.value) {
                alert("Por favor selecciona una fecha y hora para el encuentro.");
                return;
            }

            // Simular respuesta del Frontend y mostrar datos recolectados
            const dateStr = new Date(matchDateTime.value).toLocaleString("es-ES");
            
            showSuccessToast(`¡Listo! Se recolectaron ${selectedIds.length} jugadores para la fecha ${dateStr}. (Lógica de backend lista para ser implementada)`);
            
            setTimeout(() => {
                window.location.href = `/Group/Dashboard?groupId=${groupId}`;
            }, 3500);
        });
    }

    // Helper Toast
    const showSuccessToast = (message: string): void => {
        const toast = document.createElement("div");
        toast.className = "toast-notification toast-success show";
        toast.style.position = "fixed";
        toast.style.bottom = "100px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.zIndex = "9999";
        toast.style.opacity = "1";
        toast.style.pointerEvents = "all";
        toast.style.background = "rgba(18, 20, 26, 0.95)";
        toast.style.border = "1px solid var(--neon-green-solid)";
        toast.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px var(--neon-green-glow)";
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
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
    loadGroupMembers();
});

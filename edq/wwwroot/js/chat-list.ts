document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("chatGroupsListContainer");
    if (!container) return;

    // Clave usada para leer/escribir los grupos en localStorage
    const CACHE_KEY = "edq_cached_chat_groups";

    // Convierte un array de grupos a HTML (mismo card que antes)
    const renderGroups = (myGroups: any[]): void => {
        container.innerHTML = "";

        if (myGroups.length === 0) {
            container.style.minHeight = "250px";
            container.style.justifyContent = "center";
            container.style.alignItems = "center";
            container.innerHTML = `
                <div class="no-results-message" style="padding: 40px 20px; text-align: center; color: var(--text-muted); width: 100%;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; opacity: 0.5; margin: 0 auto 12px auto; display: block;">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p style="font-size: 15px; margin: 0;">Aún no perteneces a ningún grupo.</p>
                    <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Uúnete a un grupo en el explorador para chatear.</p>
                    <a href="/Group/Explore" class="btn-neon" style="display: inline-flex; margin-top: 16px; text-decoration: none; padding: 10px 20px; font-size: 14px; width: auto; justify-content: center; align-items: center;">
                        Explorar Grupos
                    </a>
                </div>
            `;
            return;
        }

        container.style.minHeight = "unset";
        container.style.justifyContent = "flex-start";
        container.style.alignItems = "stretch";

        const listDiv = document.createElement("div");
        listDiv.className = "groups-list";
        listDiv.style.display = "flex";
        listDiv.style.flexDirection = "column";
        listDiv.style.gap = "12px";
        listDiv.style.width = "100%";

        myGroups.forEach((group: any) => {
            const groupName = group.name || "";
            const card = document.createElement("div");
            card.className = "group-card clickable-group-card";
            card.style.cursor = "pointer";
            card.style.display = "flex";
            card.style.flexDirection = "row";
            card.style.alignItems = "center";
            card.style.justifyContent = "space-between";
            card.style.padding = "16px";
            card.style.transition = "transform 0.2s, border-color 0.2s";
            card.style.background = "var(--card-bg)";
            card.style.border = "var(--card-border)";
            card.style.borderRadius = "var(--border-radius-md)";

            card.onclick = () => {
                window.location.href = `/Group/Chat?groupId=${group.id}`;
            };

            card.innerHTML = `
                <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                    <div style="min-width: 0; flex: 1;">
                        <div class="group-card-title" style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(groupName)}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px; display: flex; align-items: center; gap: 8px;">
                            <span>👤 ${escapeHtml(group.creatorName)}</span>
                            <span style="opacity: 0.5;">•</span>
                            <span>👥 ${group.memberCount} ${group.memberCount === 1 ? 'miembro' : 'miembros'}</span>
                        </div>
                    </div>
                </div>
                <div style="color: var(--neon-green); opacity: 0.7; padding-left: 10px; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            `;
            listDiv.appendChild(card);
        });

        container.appendChild(listDiv);
    };

    const loadChatGroups = async (): Promise<void> => {
        try {
            // 1. CARGA INSTANTÁNEA: si hay datos cacheados en localStorage, mostrarlos
            //    de inmediato (0 ms) sin esperar al servidor.
            const cachedRaw = localStorage.getItem(CACHE_KEY);
            if (cachedRaw) {
                const cachedGroups = JSON.parse(cachedRaw);
                renderGroups(cachedGroups);
            }

            // 2. FETCH EN SEGUNDO PLANO: pedir al servidor la lista actualizada.
            const response = await fetch("/Group/GetGroups?skip=0&take=1000");
            if (!response.ok) {
                // Solo mostrar el error si el contenedor sigue vacío (no hay caché)
                if (!container.hasChildNodes())
                    container.innerHTML = `
                        <div style="text-align: center; color: var(--red-alert); padding: 40px 20px; font-size: 14px;">
                            No se pudieron cargar los chats grupales.
                        </div>
                    `;
                return;
            }

            const data = await response.json();
            const myGroups = data.myGroups || [];

            // 3. ACTUALIZAR CACÉ: guardar los datos frescos para la próxima visita.
            localStorage.setItem(CACHE_KEY, JSON.stringify(myGroups));

            // 4. RE-RENDERIZAR SOLO SI HAY DIFERENCIAS respecto al caché anterior.
            //    Se compara por JSON para evitar parpadeos innecesarios.
            if (JSON.stringify(myGroups) !== cachedRaw)
                renderGroups(myGroups);

        } catch (error) {
            console.error("Error al cargar grupos de chat:", error);
            // Solo mostrar el error si el contenedor sigue vacío (no hay caché)
            if (!container.hasChildNodes())
                container.innerHTML = `
                    <div style="text-align: center; color: var(--red-alert); padding: 40px 20px; font-size: 14px;">
                        No se pudieron cargar los chats grupales.
                    </div>
                `;
        }
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

    loadChatGroups().catch(err => console.error('Error:', err));
});

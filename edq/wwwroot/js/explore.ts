interface Group {
    id: number;
    name: string;
    creatorName: string;
    memberCount: number;
    isCreator: boolean;
    isMember: boolean;
    requestStatus: string | null;
}

interface GroupsResponse {
    myGroups: Group[];
    otherGroups: Group[];
}

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    const myGroupsList = document.getElementById("myGroupsList") as HTMLDivElement | null;
    const myGroupsEmptyMessage = document.getElementById("myGroupsEmptyMessage") as HTMLDivElement | null;
    const otherGroupsList = document.getElementById("otherGroupsList") as HTMLDivElement | null;
    const btnLoadMore = document.getElementById("btnLoadMore") as HTMLButtonElement | null;
    const loadingIndicator = document.getElementById("loadingIndicator") as HTMLDivElement | null;
    const noResultsMessage = document.getElementById("noResultsMessage") as HTMLDivElement | null;

    if (!myGroupsList || !myGroupsEmptyMessage || !otherGroupsList || !loadingIndicator || !noResultsMessage) return;

    // Helper: Show styled toast notifications
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

    let currentSearch: string = "";
    let skip: number = 0;
    const take: number = 15;
    let isLoading: boolean = false;
    let hasMore: boolean = true;
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    let cachedOtherGroups: Group[] = [];
    let hasDiscoveredInitial: boolean = false;

    // Cargar grupos desde la API
    const loadGroups = async (append: boolean = true): Promise<void> => {
        if (isLoading)
            return;
        isLoading = true;
        
        let spinner: HTMLElement | null = null;
        if (append && btnLoadMore) {
            btnLoadMore.disabled = true;
            btnLoadMore.classList.add("btn-loading");
            spinner = document.createElement("span");
            spinner.className = "btn-spinner";
            btnLoadMore.appendChild(spinner);
        } else {
            loadingIndicator.style.display = "flex";
            if (btnLoadMore)
                btnLoadMore.style.display = "none";
        }
        noResultsMessage.style.display = "none";

        try {
            const response = await fetch(`/Group/GetGroups?search=${encodeURIComponent(currentSearch)}&skip=${skip}&take=${take}`);
            if (!response.ok) throw new Error("Error en la carga de grupos.");

            const data: GroupsResponse = await response.json();

            // 1. Renderizar Mis Grupos (solo si es la carga inicial skip === 0)
            if (skip === 0) {
                myGroupsList.innerHTML = "";
                const filteredMyGroups = currentSearch 
                    ? data.myGroups.filter(g => g.name.toLowerCase().includes(currentSearch.toLowerCase()))
                    : data.myGroups;

                if (filteredMyGroups.length === 0) {
                    myGroupsEmptyMessage.style.display = "flex";
                } else {
                    myGroupsEmptyMessage.style.display = "none";
                    filteredMyGroups.forEach(group => {
                        const card = createGroupCard(group, true);
                        myGroupsList.appendChild(card);
                    });
                }

                if (data.myGroups.length === 0)
                    hasDiscoveredInitial = true;
            }

            // 2. Renderizar Otros Grupos (Descubrir)
            if (!append)
                otherGroupsList.innerHTML = "";

            const otherGroups = data.otherGroups;

            // CASO ESPECIAL: Si es la carga inicial, no hay búsqueda activa y el usuario tiene grupos propios
            if (skip === 0 && !currentSearch && data.myGroups.length > 0 && !hasDiscoveredInitial) {
                cachedOtherGroups = otherGroups;
                otherGroupsList.innerHTML = "";
                
                if (btnLoadMore) {
                    const btnTextSpan = btnLoadMore.querySelector(".btn-text") as HTMLElement | null;
                    if (btnTextSpan)
                        btnTextSpan.textContent = "🔍 Descubrir Grupos";
                    else
                        btnLoadMore.textContent = "🔍 Descubrir Grupos";
                    btnLoadMore.style.display = "block";
                }
                
                hasMore = false;
                isLoading = false;
                loadingIndicator.style.display = "none";
                return;
            }

            // Flujo normal de renderizado
            if (otherGroups.length === 0 && skip === 0) {
                noResultsMessage.style.display = "flex";
                hasMore = false;
                if (btnLoadMore)
                    btnLoadMore.style.display = "none";
            } else {
                otherGroups.forEach(group => {
                    const card = createGroupCard(group, false);
                    otherGroupsList.appendChild(card);
                });

                if (otherGroups.length < take) {
                    hasMore = false;
                    if (btnLoadMore)
                        btnLoadMore.style.display = "none";
                } else {
                    hasMore = true;
                    if (btnLoadMore) {
                        const btnTextSpan = btnLoadMore.querySelector(".btn-text") as HTMLElement | null;
                        if (btnTextSpan)
                            btnTextSpan.textContent = "Cargar más";
                        else
                            btnLoadMore.textContent = "Cargar más";
                        btnLoadMore.style.display = "block";
                    }
                }
            }

            skip += otherGroups.length;

        } catch (error) {
            console.error("Error cargando grupos:", error);
        } finally {
            isLoading = false;
            if (spinner && btnLoadMore) {
                btnLoadMore.disabled = false;
                btnLoadMore.classList.remove("btn-loading");
                spinner.remove();
            }
            loadingIndicator.style.display = "none";
        }
    };

    // Crear la tarjeta de grupo individual
    const createGroupCard = (group: Group, isMyGroup: boolean): HTMLDivElement => {
        const card = document.createElement("div");
        card.className = "group-card";
        card.dataset.groupId = group.id.toString();

        if (isMyGroup) {
            card.classList.add("clickable-group-card");
            card.style.cursor = "pointer";
            // Al hacer clic, redirige al dashboard del grupo
            card.addEventListener("click", (e) => {
                // Prevenir navegación si se hace clic en algún botón interno si existiera
                const target = e.target as HTMLElement;
                if (target.closest("button") || target.closest("a")) return;
                window.location.href = `/Group/Dashboard?groupId=${group.id}`;
            });
        }

        // Crear estructura de la tarjeta
        card.innerHTML = `
            <div class="group-card-header">
                <div class="group-card-title">${escapeHtml(group.name)}</div>
                <div class="group-card-creator">
                    👤 Creador: ${escapeHtml(group.creatorName)}
                </div>
            </div>
            <div class="group-card-meta">
                <div class="meta-item">
                    <svg viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>${group.memberCount} ${group.memberCount === 1 ? 'miembro' : 'miembros'}</span>
                </div>
            </div>
            <div class="group-card-action">
                ${renderAction(group)}
            </div>
        `;

        // Añadir evento al botón de unirse si existe
        const joinBtn = card.querySelector(".btn-join-group") as HTMLButtonElement | null;
        if (joinBtn) {
            joinBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevenir navegación
                handleJoinRequest(group.id, joinBtn);
            });
        }

        return card;
    };

    // Renderizar el botón o badge según el estado
    const renderAction = (group: Group): string => {
        if (group.isCreator) {
            return `<span class="badge-status badge-status-creator">👑 Administrador (Tuyo)</span>`;
        }
        if (group.isMember) {
            return `<span class="badge-status badge-status-member">✓ Eres Miembro</span>`;
        }
        if (group.requestStatus === "Pending") {
            return `<span class="badge-status badge-status-requested">⌛ Solicitud Pendiente</span>`;
        }
        return `<button class="btn-neon btn-join-group" data-id="${group.id}">Solicitar Unión</button>`;
    };

    // Manejar solicitud de unión por AJAX
    const handleJoinRequest = async (groupId: number, buttonElement: HTMLButtonElement): Promise<void> => {
        if (buttonElement.disabled) return;

        // Deshabilitar y mostrar estado intermedio
        buttonElement.disabled = true;
        buttonElement.textContent = "Enviando...";
        buttonElement.style.opacity = "0.7";

        try {
            const response = await fetch(`/Group/JoinRequest?groupId=${groupId}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });

            if (response.status === 409) {
                showToast("Ya has enviado una solicitud para este grupo.", true);
                setButtonStateRequested(buttonElement);
                return;
            }

            if (!response.ok) {
                const errorMsg = await response.text();
                throw new Error(errorMsg || "Error al procesar la solicitud.");
            }

            const result = await response.json();

            // Éxito: cambiar botón por badge correspondiente
            if (result.state === "Approved") {
                const parent = buttonElement.parentElement;
                if (parent) {
                    parent.innerHTML = `<span class="badge-status badge-status-member">✓ Eres Miembro</span>`;
                }
                showToast("¡Te has unido automáticamente al grupo ya que habías sido pre-registrado por el administrador!", false);
                
                // Recargar el listado para mover el grupo a 'Mis Grupos' en tiempo real
                setTimeout(() => {
                    skip = 0;
                    hasMore = true;
                    loadGroups(false);
                }, 1000);
            } else {
                setButtonStateRequested(buttonElement);
            }

        } catch (error: any) {
            console.error("Error al enviar solicitud:", error);
            showToast(error.message || "Error al solicitar unión al grupo.", true);
            buttonElement.disabled = false;
            buttonElement.textContent = "Solicitar Unión";
            buttonElement.style.opacity = "1";
        }
    };

    const setButtonStateRequested = (buttonElement: HTMLButtonElement): void => {
        const parent = buttonElement.parentElement;
        if (parent) {
            parent.innerHTML = `<span class="badge-status badge-status-requested">⌛ Solicitud Pendiente</span>`;
        }
    };

    // Anti forgery token helper
    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };

    // Buscar en tiempo real con debounce (300ms)
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            if (searchTimeout)
                clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearch = searchInput.value;
                skip = 0;
                hasMore = true;
                loadGroups(false);
            }, 300);
        });
    }

    // Cargar más al hacer clic en el botón o descubrir grupos
    if (btnLoadMore) {
        btnLoadMore.addEventListener("click", () => {
            if (!hasDiscoveredInitial) {
                hasDiscoveredInitial = true;
                
                // Activar spinner en el botón
                btnLoadMore.disabled = true;
                btnLoadMore.classList.add("btn-loading");
                const spinner = document.createElement("span");
                spinner.className = "btn-spinner";
                btnLoadMore.appendChild(spinner);
                
                setTimeout(() => {
                    btnLoadMore.disabled = false;
                    btnLoadMore.classList.remove("btn-loading");
                    const existingSpinner = btnLoadMore.querySelector(".btn-spinner");
                    if (existingSpinner)
                        existingSpinner.remove();
                    
                    if (cachedOtherGroups.length === 0) {
                        noResultsMessage.style.display = "flex";
                        btnLoadMore.style.display = "none";
                        hasMore = false;
                    } else {
                        otherGroupsList.innerHTML = "";
                        cachedOtherGroups.forEach(group => {
                            const card = createGroupCard(group, false);
                            otherGroupsList.appendChild(card);
                        });
                        
                        if (cachedOtherGroups.length < take) {
                            hasMore = false;
                            btnLoadMore.style.display = "none";
                        } else {
                            hasMore = true;
                            const btnTextSpan = btnLoadMore.querySelector(".btn-text") as HTMLElement | null;
                            if (btnTextSpan)
                                btnTextSpan.textContent = "Cargar más";
                            else
                                btnLoadMore.textContent = "Cargar más";
                            btnLoadMore.style.display = "block";
                        }
                        
                        skip = cachedOtherGroups.length;
                    }
                }, 600);
            } else {
                if (hasMore && !isLoading)
                    loadGroups(true);
            }
        });
    }

    // Scroll infinito
    const handleScroll = (): void => {
        if (!hasMore || isLoading || !hasDiscoveredInitial)
            return;
        
        const mainContent = document.querySelector(".app-content") as HTMLDivElement | null;
        if (mainContent) {
            const threshold = 100; // píxeles antes del final
            const position = mainContent.scrollHeight - mainContent.scrollTop - mainContent.clientHeight;
            
            if (position <= threshold)
                loadGroups(true);
        }
    };
    
    const mainContent = document.querySelector(".app-content") as HTMLDivElement | null;
    if (mainContent)
        mainContent.addEventListener("scroll", handleScroll);

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

    // Carga inicial de grupos
    loadGroups(false);
});

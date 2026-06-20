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
    const searchInput = document.getElementById("searchInput");
    const myGroupsList = document.getElementById("myGroupsList");
    const myGroupsEmptyMessage = document.getElementById("myGroupsEmptyMessage");
    const otherGroupsList = document.getElementById("otherGroupsList");
    const btnLoadMore = document.getElementById("btnLoadMore");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const noResultsMessage = document.getElementById("noResultsMessage");
    if (!myGroupsList || !myGroupsEmptyMessage || !otherGroupsList || !loadingIndicator || !noResultsMessage)
        return;
    let currentSearch = "";
    let skip = 0;
    const take = 15;
    let isLoading = false;
    let hasMore = true;
    let searchTimeout = null;
    // Cargar grupos desde la API
    const loadGroups = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (append = true) {
        if (isLoading)
            return;
        isLoading = true;
        // Mostrar spinner y ocultar botón / sin resultados
        loadingIndicator.style.display = "flex";
        if (btnLoadMore)
            btnLoadMore.style.display = "none";
        noResultsMessage.style.display = "none";
        try {
            const response = yield fetch(`/Group/GetGroups?search=${encodeURIComponent(currentSearch)}&skip=${skip}&take=${take}`);
            if (!response.ok)
                throw new Error("Error en la carga de grupos.");
            const data = yield response.json();
            // 1. Renderizar Mis Grupos (solo si es la carga inicial skip === 0)
            if (skip === 0) {
                myGroupsList.innerHTML = "";
                const filteredMyGroups = currentSearch
                    ? data.myGroups.filter(g => g.name.toLowerCase().includes(currentSearch.toLowerCase()))
                    : data.myGroups;
                if (filteredMyGroups.length === 0) {
                    myGroupsEmptyMessage.style.display = "flex";
                }
                else {
                    myGroupsEmptyMessage.style.display = "none";
                    filteredMyGroups.forEach(group => {
                        const card = createGroupCard(group, true);
                        myGroupsList.appendChild(card);
                    });
                }
            }
            // 2. Renderizar Otros Grupos (Descubrir)
            if (!append) {
                otherGroupsList.innerHTML = "";
            }
            const otherGroups = data.otherGroups;
            if (otherGroups.length === 0 && skip === 0) {
                noResultsMessage.style.display = "flex";
                hasMore = false;
            }
            else {
                otherGroups.forEach(group => {
                    const card = createGroupCard(group, false);
                    otherGroupsList.appendChild(card);
                });
                // Determinar si hay más elementos
                if (otherGroups.length < take) {
                    hasMore = false;
                    if (btnLoadMore)
                        btnLoadMore.style.display = "none";
                }
                else {
                    hasMore = true;
                    if (btnLoadMore)
                        btnLoadMore.style.display = "block";
                }
            }
            skip += otherGroups.length;
        }
        catch (error) {
            console.error("Error cargando grupos:", error);
            alert("Ocurrió un error al cargar los grupos.");
        }
        finally {
            isLoading = false;
            loadingIndicator.style.display = "none";
        }
    });
    // Crear la tarjeta de grupo individual
    const createGroupCard = (group, isMyGroup) => {
        const card = document.createElement("div");
        card.className = "group-card";
        card.dataset.groupId = group.id.toString();
        if (isMyGroup) {
            card.classList.add("clickable-group-card");
            card.style.cursor = "pointer";
            // Al hacer clic, redirige al dashboard del grupo
            card.addEventListener("click", (e) => {
                // Prevenir navegación si se hace clic en algún botón interno si existiera
                const target = e.target;
                if (target.closest("button") || target.closest("a"))
                    return;
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
        const joinBtn = card.querySelector(".btn-join-group");
        if (joinBtn) {
            joinBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevenir navegación
                handleJoinRequest(group.id, joinBtn);
            });
        }
        return card;
    };
    // Renderizar el botón o badge según el estado
    const renderAction = (group) => {
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
    const handleJoinRequest = (groupId, buttonElement) => __awaiter(void 0, void 0, void 0, function* () {
        if (buttonElement.disabled)
            return;
        // Deshabilitar y mostrar estado intermedio
        buttonElement.disabled = true;
        buttonElement.textContent = "Enviando...";
        buttonElement.style.opacity = "0.7";
        try {
            const response = yield fetch(`/Group/JoinRequest?groupId=${groupId}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });
            if (response.status === 409) {
                alert("Ya has enviado una solicitud para este grupo.");
                setButtonStateRequested(buttonElement);
                return;
            }
            if (!response.ok) {
                const errorMsg = yield response.text();
                throw new Error(errorMsg || "Error al procesar la solicitud.");
            }
            // Éxito: cambiar botón por badge solicitado
            setButtonStateRequested(buttonElement);
        }
        catch (error) {
            console.error("Error al enviar solicitud:", error);
            alert(error.message || "Error al solicitar unión al grupo.");
            buttonElement.disabled = false;
            buttonElement.textContent = "Solicitar Unión";
            buttonElement.style.opacity = "1";
        }
    });
    const setButtonStateRequested = (buttonElement) => {
        const parent = buttonElement.parentElement;
        if (parent) {
            parent.innerHTML = `<span class="badge-status badge-status-requested">⌛ Solicitud Pendiente</span>`;
        }
    };
    // Anti forgery token helper
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
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
    // Cargar más al hacer clic en el botón
    if (btnLoadMore) {
        btnLoadMore.addEventListener("click", () => {
            if (hasMore && !isLoading) {
                loadGroups(true);
            }
        });
    }
    // Scroll infinito
    const handleScroll = () => {
        if (!hasMore || isLoading)
            return;
        const mainContent = document.querySelector(".app-content");
        if (mainContent) {
            const threshold = 100; // píxeles antes del final
            const position = mainContent.scrollHeight - mainContent.scrollTop - mainContent.clientHeight;
            if (position <= threshold) {
                loadGroups(true);
            }
        }
    };
    const mainContent = document.querySelector(".app-content");
    if (mainContent) {
        mainContent.addEventListener("scroll", handleScroll);
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
    // Carga inicial de grupos
    loadGroups(false);
});

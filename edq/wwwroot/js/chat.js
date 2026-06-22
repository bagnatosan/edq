"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput");
    const currentUserIdInput = document.getElementById("currentUserIdInput");
    const chatMessages = document.getElementById("chatMessages");
    const chatMessageInput = document.getElementById("chatMessageInput");
    const btnSendMessage = document.getElementById("btnSendMessage");
    // Controles del Menú de Acciones de Chat (+)
    const btnChatActions = document.getElementById("btnChatActions");
    const chatActionsDropdown = document.getElementById("chatActionsDropdown");
    const btnCreatePollFromDropdown = document.getElementById("btnCreatePollFromDropdown");
    // Controles del Modal de Crear Encuesta
    const createPollModal = document.getElementById("createPollModal");
    const createPollCard = document.getElementById("createPollCard");
    const btnCancelPoll = document.getElementById("btnCancelPoll");
    const pollTargetDate = document.getElementById("pollTargetDate");
    const createPollForm = document.getElementById("createPollForm");
    const pollQuestion = document.getElementById("pollQuestion");
    const pollDuration = document.getElementById("pollDuration");
    if (!groupIdInput || !currentUserIdInput || !chatMessages || !chatMessageInput || !btnSendMessage)
        return;
    const groupId = parseInt(groupIdInput.value);
    const currentUserId = parseInt(currentUserIdInput.value);
    if (isNaN(groupId) || isNaN(currentUserId))
        return;
    // Toast de notificaciones
    const showToast = (message, isError = false) => {
        const toast = document.createElement("div");
        toast.className = `toast-notification ${isError ? 'toast-error' : 'toast-success'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        toast.offsetHeight; // force reflow
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };
    // ----------------------------------------------------
    // SIGNALR SETUP
    // ----------------------------------------------------
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();
    const startSignalR = async () => {
        try {
            await connection.start();
            console.log("SignalR connected.");
            await connection.invoke("JoinGroupChat", groupId);
        }
        catch (err) {
            console.error("SignalR connection error:", err);
            setTimeout(startSignalR, 5000);
        }
    };
    // Escuchar mensajes entrantes
    connection.on("ReceiveMessage", (msg) => {
        appendMessage(msg);
        scrollToBottom();
    });
    // Escuchar creación de encuestas
    connection.on("PollCreated", (poll) => {
        showToast("📊 ¡Nueva encuesta creada!", false);
        appendPoll(poll);
        scrollToBottom();
    });
    // Escuchar votos en tiempo real
    connection.on("PollUpdated", (updatedPoll) => {
        updatePollCardResults(updatedPoll.pollId, updatedPoll.options);
    });
    startSignalR();
    // ----------------------------------------------------
    // CARGAR MENSAGES Y ENCUESTAS CHRONOLÓGICAMENTE
    // ----------------------------------------------------
    const loadMessagesAndPolls = async () => {
        try {
            const [messagesRes, pollsRes] = await Promise.all([
                fetch(`/Chat/GetMessages?groupId=${groupId}&skip=0&take=50`),
                fetch(`/Chat/GetActivePolls?groupId=${groupId}`)
            ]);
            if (!messagesRes.ok)
                throw new Error("Error cargando mensajes.");
            if (!pollsRes.ok)
                throw new Error("Error cargando encuestas.");
            const messages = await messagesRes.json();
            const polls = await pollsRes.json();
            chatMessages.innerHTML = "";
            if (messages.length === 0 && polls.length === 0) {
                chatMessages.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">No hay mensajes ni encuestas en este grupo. ¡Comienza la charla!</div>`;
                return;
            }
            const items = [];
            messages.forEach(m => {
                items.push({ type: 'message', date: new Date(m.sentAt), data: m });
            });
            polls.forEach(p => {
                items.push({ type: 'poll', date: new Date(p.createdAt), data: p });
            });
            // Ordenar por fecha ascendente
            items.sort((a, b) => a.date.getTime() - b.date.getTime());
            items.forEach(item => {
                if (item.type === 'message') {
                    appendMessage(item.data);
                }
                else {
                    appendPoll(item.data);
                }
            });
            scrollToBottom();
        }
        catch (error) {
            console.error(error);
            chatMessages.innerHTML = `<div style="text-align: center; color: var(--red-alert); font-size: 13px; padding: 20px 0;">Error al cargar el historial.</div>`;
        }
    };
    // Renderizar una burbuja de mensaje en el DOM
    const appendMessage = (msg) => {
        const emptyMsg = chatMessages.querySelector("div");
        if (emptyMsg && (emptyMsg.textContent?.includes("No hay mensajes") || emptyMsg.textContent?.includes("historial"))) {
            emptyMsg.remove();
        }
        const isMe = msg.senderId === currentUserId;
        const msgWrapper = document.createElement("div");
        msgWrapper.style.display = "flex";
        msgWrapper.style.justifyContent = isMe ? "flex-end" : "flex-start";
        msgWrapper.style.marginBottom = "12px";
        msgWrapper.style.width = "100%";
        let avatarHtml = "";
        if (msg.photoUrl) {
            avatarHtml = `<img src="${escapeHtml(msg.photoUrl)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 4px;" alt="${escapeHtml(msg.senderName)}" />`;
        }
        else {
            avatarHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--text-primary); flex-shrink: 0; margin-top: 4px;">${escapeHtml(msg.senderInitials)}</div>`;
        }
        const bubbleBg = isMe ? "rgba(57, 255, 20, 0.08)" : "rgba(255, 255, 255, 0.03)";
        const bubbleBorder = isMe ? "1px solid rgba(57, 255, 20, 0.25)" : "1px solid rgba(255, 255, 255, 0.05)";
        const bubbleAlign = isMe ? "flex-end" : "flex-start";
        msgWrapper.innerHTML = `
            <div style="display: flex; gap: 8px; max-width: 80%; align-items: flex-start;">
                ${avatarHtml}
                <div style="display: flex; flex-direction: column; align-items: ${bubbleAlign};">
                    <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px; margin-left: 2px;">${escapeHtml(msg.senderName)}</span>
                    <div style="background: ${bubbleBg}; border: ${bubbleBorder}; padding: 10px 14px; border-radius: 14px; font-size: 13px; color: var(--text-primary); line-height: 1.4; word-break: break-word; text-align: left;">
                        ${escapeHtml(msg.messageText)}
                    </div>
                    <span style="font-size: 9px; color: var(--text-muted); margin-top: 3px; margin-left: 4px; margin-right: 4px;">${formatTime(msg.sentAt)}</span>
                </div>
            </div>
        `;
        chatMessages.appendChild(msgWrapper);
    };
    // Renderizar una tarjeta de encuesta en el DOM (Estilo WhatsApp)
    const appendPoll = (poll) => {
        const emptyMsg = chatMessages.querySelector("div");
        if (emptyMsg && (emptyMsg.textContent?.includes("No hay mensajes") || emptyMsg.textContent?.includes("historial"))) {
            emptyMsg.remove();
        }
        const isMe = poll.creatorId === currentUserId;
        const pollWrapper = document.createElement("div");
        pollWrapper.style.display = "flex";
        pollWrapper.style.justifyContent = isMe ? "flex-end" : "flex-start";
        pollWrapper.style.marginBottom = "12px";
        pollWrapper.style.width = "100%";
        let avatarHtml = "";
        if (poll.creatorPhotoUrl) {
            avatarHtml = `<img src="${escapeHtml(poll.creatorPhotoUrl)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 4px;" alt="${escapeHtml(poll.creatorName)}" />`;
        }
        else {
            avatarHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--text-primary); flex-shrink: 0; margin-top: 4px;">${escapeHtml(poll.creatorInitials)}</div>`;
        }
        const totalVotes = poll.options.reduce((acc, opt) => acc + opt.voteCount, 0);
        const optionsHtml = poll.options.map(opt => {
            const pct = totalVotes > 0 ? (opt.voteCount / totalVotes) * 100 : 0;
            const borderStyle = opt.userVoted ? "border-color: var(--neon-green-solid); background: rgba(57,255,20,0.05);" : "border-color: rgba(255,255,255,0.08);";
            return `
                <div class="poll-option-row" data-option-id="${opt.id}" style="position: relative; border: 1px solid; ${borderStyle} padding: 10px; border-radius: var(--border-radius-sm); cursor: pointer; display: flex; justify-content: space-between; align-items: center; overflow: hidden; transition: all 0.2s;">
                    <!-- Barra de Progreso de Fondo -->
                    <div class="poll-progress-bar" style="position: absolute; top: 0; left: 0; bottom: 0; width: ${pct}%; background: rgba(57,255,20,0.08); z-index: 1; transition: width 0.3s ease;"></div>
                    
                    <span style="font-size: 13px; font-weight: 700; color: var(--text-primary); z-index: 2; position: relative;">${escapeHtml(opt.optionText)}</span>
                    <span style="font-size: 12px; font-weight: 800; color: var(--neon-green); z-index: 2; position: relative;" class="opt-vote-count">${opt.voteCount} (${Math.round(pct)}%)</span>
                </div>
            `;
        }).join("");
        const bubbleBg = "rgba(18, 20, 26, 0.9)";
        const bubbleBorder = "1px solid rgba(158, 255, 0, 0.25)";
        const bubbleAlign = isMe ? "flex-end" : "flex-start";
        pollWrapper.innerHTML = `
            <div style="display: flex; gap: 8px; max-width: 85%; align-items: flex-start; width: 100%; justify-content: ${isMe ? "flex-end" : "flex-start"};" class="poll-message-card" data-poll-id="${poll.id}">
                ${avatarHtml}
                <div style="display: flex; flex-direction: column; align-items: ${bubbleAlign}; width: 100%;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px; margin-left: 2px;">${escapeHtml(poll.creatorName)}</span>
                    <div style="background: ${bubbleBg}; border: ${bubbleBorder}; padding: 14px; border-radius: 16px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
                        <div style="font-weight: 800; font-size: 14px; color: var(--text-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                            <span>📊</span>
                            <span>${escapeHtml(poll.question)}</span>
                        </div>
                        ${poll.targetDate ? `
                        <div style="font-size: 11px; color: var(--neon-green); margin-top: -6px; margin-bottom: 12px; display: flex; align-items: center; gap: 4px;">
                            <span>📅 Partido:</span>
                            <span style="text-transform: capitalize;">${formatDate(poll.targetDate)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;" class="poll-options-list">
                            ${optionsHtml}
                        </div>
                        
                        <!-- Botón Ver Votos + Total de Votos -->
                        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                            <button class="btn-toggle-votes" style="background: none; border: none; color: var(--neon-green); font-weight: 700; cursor: pointer; padding: 0; font-size: 11px; display: flex; align-items: center; gap: 4px;" type="button">
                                Ver votos
                            </button>
                            <span style="font-size: 10px; color: var(--text-muted);">Votos totales: <span class="poll-total-votes">${totalVotes}</span></span>
                        </div>
                        
                        <!-- Panel de Detalle de Votos -->
                        <div class="poll-voters-list" style="display: none; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; max-height: 180px; overflow-y: auto;">
                            <!-- Cargado dinámicamente -->
                        </div>

                        <div style="text-align: right; margin-top: 8px; font-size: 9px; color: var(--text-muted);">
                            <span>${formatTime(poll.createdAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // Agregar evento de votación
        pollWrapper.querySelectorAll(".poll-option-row").forEach(row => {
            row.addEventListener("click", () => {
                const optionId = parseInt(row.getAttribute("data-option-id") || "");
                if (!isNaN(optionId)) {
                    handleVote(poll.id, optionId);
                }
            });
        });
        // Toggle para mostrar/ocultar votos
        const toggleBtn = pollWrapper.querySelector(".btn-toggle-votes");
        const votersList = pollWrapper.querySelector(".poll-voters-list");
        if (toggleBtn && votersList) {
            toggleBtn.addEventListener("click", () => {
                const isHidden = votersList.style.display === "none";
                votersList.style.display = isHidden ? "block" : "none";
                toggleBtn.textContent = isHidden ? "Ocultar votos" : "Ver votos";
            });
            renderVotersList(votersList, poll.options);
        }
        chatMessages.appendChild(pollWrapper);
    };
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    const formatDate = (dateString) => {
        if (!dateString)
            return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime()))
            return "";
        return date.toLocaleDateString("es-ES", {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        if (isNaN(date.getTime()))
            return "";
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    // Enviar mensaje
    const handleSendMessage = async () => {
        const text = chatMessageInput.value.trim();
        if (!text)
            return;
        chatMessageInput.value = "";
        btnSendMessage.disabled = true;
        try {
            await connection.invoke("SendMessage", groupId, text);
        }
        catch (err) {
            console.error("Error sending message:", err);
            showToast("Error al enviar el mensaje.", true);
        }
        finally {
            btnSendMessage.disabled = false;
            chatMessageInput.focus();
        }
    };
    btnSendMessage.addEventListener("click", handleSendMessage);
    chatMessageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            handleSendMessage();
        }
    });
    // Emitir voto por AJAX
    const handleVote = async (pollId, optionId) => {
        try {
            const response = await fetch("/Chat/Vote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "RequestVerificationToken": getAntiForgeryToken()
                },
                body: JSON.stringify({ pollId, optionId })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Error al registrar el voto.");
            }
            // Cambiar resaltado de borde localmente de forma instantánea
            const pollCard = chatMessages.querySelector(`.poll-message-card[data-poll-id="${pollId}"]`);
            if (pollCard) {
                const optionRows = pollCard.querySelectorAll(".poll-option-row");
                optionRows.forEach(rowNode => {
                    const row = rowNode;
                    const rowOptId = parseInt(row.getAttribute("data-option-id") || "");
                    const isSelected = rowOptId === optionId;
                    if (isSelected) {
                        const isCurrentlyHighlighted = row.style.borderColor === "var(--neon-green-solid)";
                        if (isCurrentlyHighlighted) {
                            row.style.borderColor = "rgba(255,255,255,0.08)";
                            row.style.background = "none";
                        }
                        else {
                            row.style.borderColor = "var(--neon-green-solid)";
                            row.style.background = "rgba(57,255,20,0.05)";
                        }
                    }
                    else {
                        row.style.borderColor = "rgba(255,255,255,0.08)";
                        row.style.background = "none";
                    }
                });
            }
        }
        catch (error) {
            console.error(error);
            showToast(error.message || "No se pudo registrar el voto.", true);
        }
    };
    // Actualizar resultados en vivo (vía SignalR broadcast)
    const updatePollCardResults = (pollId, options) => {
        const pollCard = chatMessages.querySelector(`.poll-message-card[data-poll-id="${pollId}"]`);
        if (!pollCard)
            return;
        const totalVotes = options.reduce((acc, opt) => acc + opt.voteCount, 0);
        // Actualizar total
        const totalSpan = pollCard.querySelector(".poll-total-votes");
        if (totalSpan)
            totalSpan.textContent = totalVotes.toString();
        options.forEach(opt => {
            const optionRow = pollCard.querySelector(`[data-option-id="${opt.id}"]`);
            if (optionRow) {
                const pct = totalVotes > 0 ? (opt.voteCount / totalVotes) * 100 : 0;
                const countSpan = optionRow.querySelector(".opt-vote-count");
                if (countSpan)
                    countSpan.textContent = `${opt.voteCount} (${Math.round(pct)}%)`;
                const progressBar = optionRow.querySelector(".poll-progress-bar");
                if (progressBar)
                    progressBar.style.width = `${pct}%`;
            }
        });
        // Actualizar listado de votantes
        const votersList = pollCard.querySelector(".poll-voters-list");
        if (votersList) {
            renderVotersList(votersList, options);
        }
    };
    // Renderizar lista de votantes agrupados por opción
    const renderVotersList = (container, options) => {
        container.innerHTML = "";
        let hasVotes = false;
        options.forEach(opt => {
            const optVoters = opt.voters || [];
            if (optVoters.length > 0) {
                hasVotes = true;
                const optionSection = document.createElement("div");
                optionSection.style.marginBottom = "10px";
                const votersHtml = optVoters.map((v) => {
                    const displayName = v.nickname ? v.nickname : v.name;
                    const avatar = v.photoUrl
                        ? `<img src="${escapeHtml(v.photoUrl)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />`
                        : `<div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: var(--text-primary);">${escapeHtml(v.initials)}</div>`;
                    return `
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            ${avatar}
                            <span style="font-weight: 600; color: var(--text-secondary); font-size: 12px;">${escapeHtml(displayName)}</span>
                        </div>
                    `;
                }).join("");
                optionSection.innerHTML = `
                    <div style="font-weight: 800; color: var(--neon-green); font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${escapeHtml(opt.optionText)} (${optVoters.length})
                    </div>
                    <div class="voters-items-container" style="display: flex; flex-direction: column; padding-left: 4px;">
                        ${votersHtml}
                    </div>
                `;
                container.appendChild(optionSection);
            }
        });
        if (!hasVotes) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 6px 0;">Nadie ha votado aún.</div>`;
        }
    };
    // ----------------------------------------------------
    // MENÚ DE ACCIONES DE CHAT (+) Y MODAL DE CREACIÓN
    // ----------------------------------------------------
    if (btnChatActions && chatActionsDropdown && btnCreatePollFromDropdown) {
        btnChatActions.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = chatActionsDropdown.style.display === "block";
            chatActionsDropdown.style.display = isVisible ? "none" : "block";
        });
        document.addEventListener("click", (e) => {
            const target = e.target;
            if (!target.closest("#chatActionsDropdown") && !target.closest("#btnChatActions")) {
                chatActionsDropdown.style.display = "none";
            }
        });
        btnCreatePollFromDropdown.addEventListener("click", () => {
            chatActionsDropdown.style.display = "none";
            if (createPollModal && createPollCard) {
                createPollModal.style.display = "flex";
                createPollModal.offsetHeight;
                createPollModal.style.opacity = "1";
                createPollCard.style.transform = "scale(1)";
            }
        });
    }
    const btnAddPollOption = document.getElementById("btnAddPollOption");
    const pollOptionsContainer = document.getElementById("pollOptionsContainer");
    if (createPollModal && createPollCard && btnCancelPoll) {
        const hideModal = () => {
            createPollModal.style.opacity = "0";
            createPollCard.style.transform = "scale(0.9)";
            setTimeout(() => {
                createPollModal.style.display = "none";
                if (createPollForm)
                    createPollForm.reset();
                if (pollOptionsContainer) {
                    pollOptionsContainer.innerHTML = `
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" class="form-control-neon poll-option-input" placeholder="Opción 1" required style="flex: 1; margin-bottom: 0;" />
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" class="form-control-neon poll-option-input" placeholder="Opción 2" required style="flex: 1; margin-bottom: 0;" />
                        </div>
                    `;
                }
            }, 250);
        };
        btnCancelPoll.addEventListener("click", hideModal);
        if (btnAddPollOption && pollOptionsContainer) {
            btnAddPollOption.addEventListener("click", () => {
                const optionIndex = pollOptionsContainer.children.length + 1;
                const optionDiv = document.createElement("div");
                optionDiv.style.display = "flex";
                optionDiv.style.gap = "8px";
                optionDiv.style.alignItems = "center";
                optionDiv.innerHTML = `
                    <input type="text" class="form-control-neon poll-option-input" placeholder="Opción ${optionIndex}" required style="flex: 1; margin-bottom: 0;" />
                    <button type="button" class="btn-remove-option" style="background: none; border: none; color: var(--red-alert); font-size: 18px; cursor: pointer; padding: 0 4px; display: flex; align-items: center; justify-content: center; height: 38px; line-height: 1;">×</button>
                `;
                const btnRemove = optionDiv.querySelector(".btn-remove-option");
                if (btnRemove) {
                    btnRemove.addEventListener("click", () => {
                        optionDiv.remove();
                        const inputs = pollOptionsContainer.querySelectorAll(".poll-option-input");
                        inputs.forEach((input, index) => {
                            input.placeholder = `Opción ${index + 1}`;
                        });
                    });
                }
                pollOptionsContainer.appendChild(optionDiv);
            });
        }
        if (createPollForm && pollQuestion && pollDuration) {
            createPollForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const question = pollQuestion.value.trim();
                const duration = parseInt(pollDuration.value);
                const optionInputs = document.querySelectorAll(".poll-option-input");
                const options = [];
                optionInputs.forEach(input => {
                    const val = input.value.trim();
                    if (val)
                        options.push(val);
                });
                if (!question)
                    return;
                if (options.length < 2) {
                    showToast("Por favor, ingresa al menos 2 opciones.", true);
                    return;
                }
                const submitBtn = createPollForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Creando...";
                }
                try {
                    const response = await fetch("/Chat/CreatePoll", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "RequestVerificationToken": getAntiForgeryToken()
                        },
                        body: JSON.stringify({
                            groupId: groupId,
                            question: question,
                            options: options,
                            durationMinutes: duration,
                            targetDate: null
                        })
                    });
                    if (!response.ok)
                        throw new Error("No se pudo crear la encuesta.");
                    showToast("¡Encuesta creada correctamente!", false);
                    hideModal();
                }
                catch (error) {
                    console.error(error);
                    showToast("Error al crear la encuesta.", true);
                }
                finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Crear";
                    }
                }
            });
        }
    }
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    };
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
    // Cargar historial inicializado
    loadMessagesAndPolls();
});

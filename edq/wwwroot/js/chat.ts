declare var signalR: any;

interface ChatMessageDto {
    id: number;
    senderId: number;
    senderName: string;
    senderInitials: string;
    photoUrl: string | null;
    messageText: string;
    sentAt: string;
}

interface PollOptionDto {
    id: number;
    optionText: string;
    voteCount: number;
    userVoted: boolean;
}

interface PollDto {
    id: number;
    question: string;
    expiresAt: string;
    options: PollOptionDto[];
}

document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const currentUserIdInput = document.getElementById("currentUserIdInput") as HTMLInputElement | null;
    
    const chatMessages = document.getElementById("chatMessages") as HTMLDivElement | null;
    const chatMessageInput = document.getElementById("chatMessageInput") as HTMLInputElement | null;
    const btnSendMessage = document.getElementById("btnSendMessage") as HTMLButtonElement | null;
    
    // Controles del Drawer de Encuestas
    const btnOpenPolls = document.getElementById("btnOpenPolls") as HTMLButtonElement | null;
    const btnClosePolls = document.getElementById("btnClosePolls") as HTMLButtonElement | null;
    const pollsDrawer = document.getElementById("pollsDrawer") as HTMLDivElement | null;
    const pollsList = document.getElementById("pollsList") as HTMLDivElement | null;
    
    // Controles del Menú de Acciones de Chat (+)
    const btnChatActions = document.getElementById("btnChatActions") as HTMLButtonElement | null;
    const chatActionsDropdown = document.getElementById("chatActionsDropdown") as HTMLDivElement | null;
    const btnCreatePollFromDropdown = document.getElementById("btnCreatePollFromDropdown") as HTMLButtonElement | null;
    
    // Controles del Modal de Crear Encuesta
    const btnCreatePollPrompt = document.getElementById("btnCreatePollPrompt") as HTMLButtonElement | null;
    const createPollModal = document.getElementById("createPollModal") as HTMLDivElement | null;
    const createPollCard = document.getElementById("createPollCard") as HTMLDivElement | null;
    const btnCancelPoll = document.getElementById("btnCancelPoll") as HTMLButtonElement | null;
    const btnAddPollOption = document.getElementById("btnAddPollOption") as HTMLButtonElement | null;
    const pollOptionsContainer = document.getElementById("pollOptionsContainer") as HTMLDivElement | null;
    const createPollForm = document.getElementById("createPollForm") as HTMLFormElement | null;
    const pollQuestion = document.getElementById("pollQuestion") as HTMLInputElement | null;
    const pollDuration = document.getElementById("pollDuration") as HTMLSelectElement | null;

    if (!groupIdInput || !currentUserIdInput || !chatMessages || !chatMessageInput || !btnSendMessage) return;

    const groupId = parseInt(groupIdInput.value);
    const currentUserId = parseInt(currentUserIdInput.value);

    if (isNaN(groupId) || isNaN(currentUserId)) return;

    // Toast de notificaciones premium
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

    // ----------------------------------------------------
    // SIGNALR SETUP
    // ----------------------------------------------------
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Iniciar conexión SignalR
    const startSignalR = async () => {
        try {
            await connection.start();
            console.log("SignalR connected.");
            
            // Unirse al grupo de chat
            await connection.invoke("JoinGroupChat", groupId);
            console.log(`Joined SignalR Room: Group_${groupId}`);
        } catch (err) {
            console.error("SignalR connection error:", err);
            setTimeout(startSignalR, 5000);
        }
    };

    // Escuchar mensajes entrantes
    connection.on("ReceiveMessage", (msg: ChatMessageDto) => {
        appendMessage(msg);
        scrollToBottom();
    });

    // Escuchar creación de encuestas
    connection.on("PollCreated", (poll: PollDto) => {
        showToast("📊 ¡Nueva encuesta creada!", false);
        loadActivePolls(); // Recargar encuestas
    });

    // Escuchar votos en tiempo real
    connection.on("PollUpdated", (updatedPoll: { pollId: number, options: { id: number, optionText: string, voteCount: number }[] }) => {
        updatePollCardResults(updatedPoll.pollId, updatedPoll.options);
    });

    startSignalR();

    // ----------------------------------------------------
    // CARGAR DATOS INICIALES (MENSAGES)
    // ----------------------------------------------------
    const loadMessages = async (): Promise<void> => {
        try {
            const response = await fetch(`/Chat/GetMessages?groupId=${groupId}&skip=0&take=50`);
            if (!response.ok) throw new Error("Error cargando mensajes.");
            
            const messages: ChatMessageDto[] = await response.json();
            chatMessages.innerHTML = "";
            
            if (messages.length === 0) {
                chatMessages.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">No hay mensajes anteriores en este grupo. ¡Comienza la charla!</div>`;
                return;
            }

            messages.forEach(msg => appendMessage(msg));
            scrollToBottom();

        } catch (error) {
            console.error(error);
            chatMessages.innerHTML = `<div style="text-align: center; color: var(--red-alert); font-size: 13px; padding: 20px 0;">Error al cargar el historial de chat.</div>`;
        }
    };

    // Renderizar una burbuja de mensaje en el DOM
    const appendMessage = (msg: ChatMessageDto): void => {
        // Remover cartel de vacío si existe
        const emptyMsg = chatMessages.querySelector("div");
        if (emptyMsg && emptyMsg.textContent?.includes("No hay mensajes")) {
            emptyMsg.remove();
        }

        const isMe = msg.senderId === currentUserId;
        const msgWrapper = document.createElement("div");
        msgWrapper.style.display = "flex";
        msgWrapper.style.justifyContent = isMe ? "flex-end" : "flex-start";
        msgWrapper.style.marginBottom = "10px";
        msgWrapper.style.width = "100%";

        let avatarHtml = "";
        if (!isMe) {
            if (msg.photoUrl) {
                avatarHtml = `<img src="${escapeHtml(msg.photoUrl)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" alt="${escapeHtml(msg.senderName)}" />`;
            } else {
                avatarHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--text-primary); flex-shrink: 0;">${escapeHtml(msg.senderInitials)}</div>`;
            }
        }

        const bubbleBg = isMe ? "rgba(57, 255, 20, 0.08)" : "rgba(255, 255, 255, 0.03)";
        const bubbleBorder = isMe ? "1px solid rgba(57, 255, 20, 0.25)" : "1px solid rgba(255, 255, 255, 0.05)";
        const bubbleAlign = isMe ? "flex-end" : "flex-start";

        msgWrapper.innerHTML = `
            <div style="display: flex; gap: 8px; max-width: 80%; align-items: flex-end;">
                ${!isMe ? avatarHtml : ""}
                <div style="display: flex; flex-direction: column; align-items: ${bubbleAlign};">
                    ${!isMe ? `<span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px; margin-left: 2px;">${escapeHtml(msg.senderName)}</span>` : ""}
                    <div style="background: ${bubbleBg}; border: ${bubbleBorder}; padding: 10px 14px; border-radius: 14px; font-size: 13px; color: var(--text-primary); line-height: 1.4; word-break: break-word; text-align: left;">
                        ${escapeHtml(msg.messageText)}
                    </div>
                    <span style="font-size: 9px; color: var(--text-muted); margin-top: 3px; margin-left: 4px; margin-right: 4px;">${formatTime(msg.sentAt)}</span>
                </div>
            </div>
        `;

        chatMessages.appendChild(msgWrapper);
    };

    const scrollToBottom = (): void => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Formatear fecha en hora "HH:MM"
    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Enviar mensaje
    const handleSendMessage = async (): Promise<void> => {
        const text = chatMessageInput.value.trim();
        if (!text) return;

        chatMessageInput.value = "";
        btnSendMessage.disabled = true;

        try {
            await connection.invoke("SendMessage", groupId, text);
        } catch (err) {
            console.error("Error sending message:", err);
            showToast("Error al enviar el mensaje.", true);
        } finally {
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

    // ----------------------------------------------------
    // CONTROL DEL DRAWER DE ENCUESTAS
    // ----------------------------------------------------
    if (btnOpenPolls && pollsDrawer && btnClosePolls) {
        btnOpenPolls.addEventListener("click", () => {
            pollsDrawer.style.transform = "translateX(0)";
            loadActivePolls();
        });

        btnClosePolls.addEventListener("click", () => {
            pollsDrawer.style.transform = "translateX(100%)";
        });
    }

    // ----------------------------------------------------
    // CARGAR Y RENDERIZAR ENCUESTAS
    // ----------------------------------------------------
    const loadActivePolls = async (): Promise<void> => {
        if (!pollsList) return;
        try {
            const response = await fetch(`/Chat/GetActivePolls?groupId=${groupId}`);
            if (!response.ok) throw new Error();

            const polls: PollDto[] = await response.json();
            pollsList.innerHTML = "";

            if (polls.length === 0) {
                pollsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">No hay encuestas activas.</div>`;
                return;
            }

            polls.forEach(poll => {
                const pollCard = document.createElement("div");
                pollCard.className = "card";
                pollCard.style.padding = "14px";
                pollCard.style.borderColor = "rgba(255,255,255,0.06)";
                pollCard.style.background = "rgba(255,255,255,0.01)";
                pollCard.dataset.pollId = poll.id.toString();

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

                pollCard.innerHTML = `
                    <div style="font-weight: 800; font-size: 14px; color: var(--text-primary); margin-bottom: 10px;">${escapeHtml(poll.question)}</div>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;" class="poll-options-list">
                        ${optionsHtml}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); text-align: right;">Total de votos: <span class="poll-total-votes">${totalVotes}</span></div>
                `;

                // Agregar evento de votación
                pollCard.querySelectorAll(".poll-option-row").forEach(row => {
                    row.addEventListener("click", () => {
                        const optionId = parseInt(row.getAttribute("data-option-id") || "");
                        if (!isNaN(optionId)) {
                            handleVote(poll.id, optionId);
                        }
                    });
                });

                pollsList.appendChild(pollCard);
            });

        } catch (e) {
            pollsList.innerHTML = `<div style="text-align: center; color: var(--red-alert); font-size: 12px; padding: 20px 0;">Error al cargar las encuestas.</div>`;
        }
    };

    // Emitir voto por AJAX
    const handleVote = async (pollId: number, optionId: number): Promise<void> => {
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
                throw new Error(text || "Error al emitir el voto.");
            }

            // Recargar encuestas de forma reactiva local
            loadActivePolls();

        } catch (error: any) {
            console.error(error);
            showToast(error.message || "No se pudo registrar el voto.", true);
        }
    };

    // Actualizar resultados en vivo (vía SignalR broadcast)
    const updatePollCardResults = (pollId: number, options: { id: number, optionText: string, voteCount: number }[]): void => {
        const pollCard = pollsList?.querySelector(`[data-poll-id="${pollId}"]`) as HTMLDivElement | null;
        if (!pollCard) return;

        const totalVotes = options.reduce((acc, opt) => acc + opt.voteCount, 0);
        
        // Actualizar total
        const totalSpan = pollCard.querySelector(".poll-total-votes");
        if (totalSpan) totalSpan.textContent = totalVotes.toString();

        options.forEach(opt => {
            const optionRow = pollCard.querySelector(`[data-option-id="${opt.id}"]`) as HTMLDivElement | null;
            if (optionRow) {
                const pct = totalVotes > 0 ? (opt.voteCount / totalVotes) * 100 : 0;
                
                const countSpan = optionRow.querySelector(".opt-vote-count");
                if (countSpan) countSpan.textContent = `${opt.voteCount} (${Math.round(pct)}%)`;

                const progressBar = optionRow.querySelector(".poll-progress-bar") as HTMLDivElement | null;
                if (progressBar) progressBar.style.width = `${pct}%`;
            }
        });
    };

    // ----------------------------------------------------
    // CREAR ENCUESTA (MODAL)
    // ----------------------------------------------------
    if (btnCreatePollPrompt && createPollModal && createPollCard && btnCancelPoll && btnAddPollOption && pollOptionsContainer) {
        
        btnCreatePollPrompt.addEventListener("click", () => {
            // Mostrar modal
            createPollModal.style.display = "flex";
            createPollModal.offsetHeight;
            createPollModal.style.opacity = "1";
            createPollCard.style.transform = "scale(1)";
        });

        const hideModal = () => {
            createPollModal.style.opacity = "0";
            createPollCard.style.transform = "scale(0.9)";
            setTimeout(() => {
                createPollModal.style.display = "none";
                // Limpiar formulario y opciones agregadas extra
                if (createPollForm) createPollForm.reset();
                pollOptionsContainer.innerHTML = `
                    <input type="text" class="form-control-neon poll-option-input" placeholder="Opción 1" required />
                    <input type="text" class="form-control-neon poll-option-input" placeholder="Opción 2" required />
                `;
            }, 250);
        };

        btnCancelPoll.addEventListener("click", hideModal);
        
        // Agregar dinámicamente campos de opción
        btnAddPollOption.addEventListener("click", () => {
            const currentInputs = pollOptionsContainer.querySelectorAll(".poll-option-input");
            if (currentInputs.length >= 6) {
                showToast("Máximo 6 opciones por encuesta.", true);
                return;
            }

            const input = document.createElement("input");
            input.type = "text";
            input.className = "form-control-neon poll-option-input";
            input.placeholder = `Opción ${currentInputs.length + 1}`;
            input.required = true;

            pollOptionsContainer.appendChild(input);
            input.focus();
        });

        // Guardar encuesta por AJAX
        if (createPollForm && pollQuestion && pollDuration) {
            createPollForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const question = pollQuestion.value.trim();
                const optionInputs = pollOptionsContainer.querySelectorAll(".poll-option-input") as NodeListOf<HTMLInputElement>;
                const options: string[] = [];

                optionInputs.forEach(input => {
                    const text = input.value.trim();
                    if (text) options.push(text);
                });

                const duration = parseInt(pollDuration.value);

                if (!question || options.length < 2) return;

                const submitBtn = createPollForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Lanzando...";
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
                            durationMinutes: duration
                        })
                    });

                    if (!response.ok) throw new Error("No se pudo crear la encuesta.");

                    showToast("¡Encuesta lanzada correctamente!", false);
                    hideModal();

                } catch (error) {
                    console.error(error);
                    showToast("Error al crear la encuesta.", true);
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Lanzar";
                    }
                }
            });
        }
    }

    // Anti-forgery token helper local
    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };

    // Escapar HTML contra XSS
    const escapeHtml = (unsafe: string): string => {
        if (!unsafe) return "";
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Lógica del Menú de Acciones de Chat (+)
    if (btnChatActions && chatActionsDropdown && btnCreatePollFromDropdown) {
        btnChatActions.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = chatActionsDropdown.style.display === "block";
            chatActionsDropdown.style.display = isVisible ? "none" : "block";
        });

        document.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
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

    // Cargar historial de chat
    loadMessages();
});

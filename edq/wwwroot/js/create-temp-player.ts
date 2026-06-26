document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const groupNameTitle = document.getElementById("groupNameTitle") as HTMLHeadingElement | null;
    
    // Controles de jugador temporal
    const createTempPlayerForm = document.getElementById("createTempPlayerForm") as HTMLFormElement | null;
    const tempPlayerName = document.getElementById("tempPlayerName") as HTMLInputElement | null;
    const tempPlayerLastName = document.getElementById("tempPlayerLastName") as HTMLInputElement | null;
    const tempPlayerScore = document.getElementById("tempPlayerScore") as HTMLInputElement | null;
    const tempPlayerScoreVal = document.getElementById("tempPlayerScoreVal") as HTMLSpanElement | null;

    if (!groupIdInput || !groupNameTitle || !createTempPlayerForm) return;

    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId)) return;

    // Toast de notificaciones con estilo premium
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

    // Vincular slider del formulario
    if (tempPlayerScore && tempPlayerScoreVal) {
        tempPlayerScore.addEventListener("input", () => {
            tempPlayerScoreVal.textContent = tempPlayerScore.value;
        });
    }

    // Cargar nombre del grupo para el encabezado
    const loadGroupName = async (): Promise<void> => {
        try {
            const response = await fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) {
                console.error("Error al obtener nombre de grupo: respuesta no ok");
                return;
            }

            const data = await response.json();
            groupNameTitle.textContent = `Nuevo Jugador - ${data.groupName}`;

        } catch (error) {
            console.error("Error al obtener nombre de grupo:", error);
        }
    };

    loadGroupName().catch(err => console.error('Error:', err));

    // Crear jugador temporal
    createTempPlayerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!tempPlayerName || !tempPlayerLastName || !tempPlayerScore) return;

        const name = tempPlayerName.value.trim();
        const lastName = tempPlayerLastName.value.trim();
        const score = parseInt(tempPlayerScore.value);

        if (!name || !lastName || isNaN(score)) return;

        const submitBtn = document.getElementById("btnCreateTempPlayer") as HTMLButtonElement | null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add("btn-loading");
            const spinner = document.createElement("span");
            spinner.className = "btn-spinner";
            submitBtn.appendChild(spinner);
        }

        try {
            const response = await fetch(`/Group/CreateTemporaryPlayer?groupId=${groupId}&name=${encodeURIComponent(name)}&lastName=${encodeURIComponent(lastName)}&initialScore=${score}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });

            if (!response.ok) {
                const errMsg = await response.text();
                const finalError = errMsg || "Error al crear el jugador temporal.";

                console.error("Error creando jugador temporal (API):", finalError);
                showToast(finalError, true);

                // Reestablecemos el botón aquí mismo
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove("btn-loading");
                    const existingSpinner = submitBtn.querySelector(".btn-spinner");
                    if (existingSpinner) existingSpinner.remove();
                }

                return; // <--- Cortamos la ejecución para que no siga con el éxito
            }

            showToast("¡Jugador temporal creado e integrado con éxito!", false);
            
            // Limpiar inputs
            tempPlayerName.value = "";
            tempPlayerLastName.value = "";
            tempPlayerScore.value = "6";
            if (tempPlayerScoreVal) tempPlayerScoreVal.textContent = "6";

            // Habilitar botón para poder crear otro
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove("btn-loading");
                const existingSpinner = submitBtn.querySelector(".btn-spinner");
                if (existingSpinner) existingSpinner.remove();
            }

        } catch (error: any) {
            console.error("Error creando jugador temporal:", error);
            showToast(error.message || "No se pudo crear el jugador temporal.", true);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove("btn-loading");
                const existingSpinner = submitBtn.querySelector(".btn-spinner");
                if (existingSpinner) existingSpinner.remove();
            }
        }
    });

    // Anti forgery token helper
    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };
});

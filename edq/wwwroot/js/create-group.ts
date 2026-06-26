document.addEventListener("DOMContentLoaded", () => {
    const createGroupForm = document.getElementById("createGroupForm") as HTMLFormElement | null;
    const groupNameInput = document.getElementById("groupName") as HTMLInputElement | null;
    const btnCreateGroup = document.getElementById("btnCreateGroup") as HTMLButtonElement | null;

    if (!createGroupForm || !groupNameInput || !btnCreateGroup) return;

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

    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };

    createGroupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = groupNameInput.value.trim();
        if (!name) return;

        btnCreateGroup.disabled = true;
        btnCreateGroup.classList.add("btn-loading");
        const spinner = document.createElement("span");
        spinner.className = "btn-spinner";
        btnCreateGroup.appendChild(spinner);

        try {
            const response = await fetch(`/Group/CreateGroup?name=${encodeURIComponent(name)}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });

            if (!response.ok) {
                const errMsg = await response.text();

                console.error("Error al crear grupo:", errMsg);
                showToast(errMsg || "Error al crear el grupo.", true);

                // Limpiás el botón acá mismo
                btnCreateGroup.disabled = false;
                btnCreateGroup.classList.remove("btn-loading");
                const existingSpinner = btnCreateGroup.querySelector(".btn-spinner");
                if (existingSpinner) existingSpinner.remove();

                return; // <--- Súper importante para que no siga ejecutando el código de abajo
            }

            const data = await response.json();
            showToast("¡Grupo creado con éxito!", false);

            setTimeout(() => {
                window.location.href = `/Group/Dashboard?groupId=${data.groupId}`;
            }, 1500);

        } catch (error: any) {
            console.error("Error al crear grupo:", error);
            showToast(error.message || "No se pudo crear el grupo.", true);
            btnCreateGroup.disabled = false;
            btnCreateGroup.classList.remove("btn-loading");
            const existingSpinner = btnCreateGroup.querySelector(".btn-spinner");
            if (existingSpinner) existingSpinner.remove();
        }
    });
});

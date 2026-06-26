document.addEventListener("DOMContentLoaded", () => {
    const groupIdInput = document.getElementById("groupIdInput") as HTMLInputElement | null;
    const groupNameTitle = document.getElementById("groupNameTitle") as HTMLHeadingElement | null;
    const groupNameInput = document.getElementById("groupNameInput") as HTMLInputElement | null;
    
    const btnSaveSettings = document.getElementById("btnSaveSettings") as HTMLButtonElement | null;

    if (!groupIdInput || !groupNameTitle || !groupNameInput || !btnSaveSettings) return;

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

    // Cargar datos por AJAX
    const loadGroupData = async (): Promise<void> => {
        try {
            const response = await fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok) {
                console.error("Error cargando configuración: respuesta no ok");
                return;
            }

            const data = await response.json();

            // 1. Título
            groupNameTitle.textContent = `Ajustes - ${data.groupName}`;

            // 2. Input
            groupNameInput.value = data.groupName;

        } catch (error) {
            console.error("Error cargando configuración:", error);
        }
    };

    // Guardar cambios en el backend
    btnSaveSettings.addEventListener("click", async () => {
        const newName = groupNameInput.value.trim();
        if (!newName) {
            showToast("El nombre del grupo no puede estar vacío.", true);
            return;
        }

        btnSaveSettings.disabled = true;
        btnSaveSettings.classList.add("btn-loading");
        const spinner = document.createElement("span");
        spinner.className = "btn-spinner";
        btnSaveSettings.appendChild(spinner);

        try {
            const response = await fetch(`/Group/UpdateGroupName?groupId=${groupId}&name=${encodeURIComponent(newName)}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });

            if (!response.ok) {
                const errMsg = await response.text();
                // 1. Corregido el texto por defecto aquí:
                const finalError = errMsg || "Error al actualizar la configuración.";

                // 2. Corregido el console.error aquí:
                console.error("Error actualizando configuración (API):", finalError);
                showToast(finalError, true);

                // Reestablecemos el botón aquí mismo
                if (btnSaveSettings) {
                    btnSaveSettings.disabled = false;
                    btnSaveSettings.classList.remove("btn-loading");
                    const existingSpinner = btnSaveSettings.querySelector(".btn-spinner");
                    if (existingSpinner) existingSpinner.remove();
                }

                return;
            }

            showToast("¡Nombre del grupo actualizado con éxito!", false);
            
            setTimeout(() => {
                window.location.href = `/Group/AdminPanel?groupId=${groupId}`;
            }, 1500);

        } catch (error: any) {
            console.error("Error al guardar cambios de grupo:", error);
            showToast(error.message || "No se pudo actualizar el nombre del grupo.", true);
            btnSaveSettings.disabled = false;
            btnSaveSettings.classList.remove("btn-loading");
            const existingSpinner = btnSaveSettings.querySelector(".btn-spinner");
            if (existingSpinner) existingSpinner.remove();
        }
    });

    // Anti forgery token helper
    const getAntiForgeryToken = (): string => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
        return tokenInput ? tokenInput.value : "";
    };

    // Carga inicial
    loadGroupData().catch(err => console.error('Error:', err));
});

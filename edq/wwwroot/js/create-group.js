"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const createGroupForm = document.getElementById("createGroupForm");
    const groupNameInput = document.getElementById("groupName");
    const btnCreateGroup = document.getElementById("btnCreateGroup");
    if (!createGroupForm || !groupNameInput || !btnCreateGroup)
        return;
    // Toast de notificaciones con estilo premium
    const showToast = (message, isError = false) => {
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
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    };
    createGroupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = groupNameInput.value.trim();
        if (!name)
            return;
        btnCreateGroup.disabled = true;
        btnCreateGroup.textContent = "Creando...";
        try {
            const response = await fetch(`/Group/CreateGroup?name=${encodeURIComponent(name)}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });
            if (!response.ok) {
                const errMsg = await response.text();
                throw new Error(errMsg || "Error al crear el grupo.");
            }
            const data = await response.json();
            showToast("¡Grupo creado con éxito!", false);
            setTimeout(() => {
                window.location.href = `/Group/Dashboard?groupId=${data.groupId}`;
            }, 1500);
        }
        catch (error) {
            console.error("Error al crear grupo:", error);
            showToast(error.message || "No se pudo crear el grupo.", true);
            btnCreateGroup.disabled = false;
            btnCreateGroup.textContent = "➕ Crear Grupo";
        }
    });
});

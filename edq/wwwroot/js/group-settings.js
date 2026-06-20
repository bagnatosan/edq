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
    const groupIdInput = document.getElementById("groupIdInput");
    const groupNameTitle = document.getElementById("groupNameTitle");
    const groupNameInput = document.getElementById("groupNameInput");
    const btnSaveSettings = document.getElementById("btnSaveSettings");
    if (!groupIdInput || !groupNameTitle || !groupNameInput || !btnSaveSettings)
        return;
    const groupId = parseInt(groupIdInput.value);
    if (isNaN(groupId))
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
    // Cargar datos por AJAX
    const loadGroupData = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok)
                throw new Error("Error al obtener datos del grupo.");
            const data = yield response.json();
            // 1. Título
            groupNameTitle.textContent = `Ajustes - ${data.groupName}`;
            // 2. Input
            groupNameInput.value = data.groupName;
        }
        catch (error) {
            console.error("Error cargando configuración:", error);
        }
    });
    // Guardar cambios en el backend
    btnSaveSettings.addEventListener("click", () => __awaiter(void 0, void 0, void 0, function* () {
        const newName = groupNameInput.value.trim();
        if (!newName) {
            alert("El nombre del grupo no puede estar vacío.");
            return;
        }
        btnSaveSettings.disabled = true;
        btnSaveSettings.textContent = "Guardando...";
        try {
            const response = yield fetch(`/Group/UpdateGroupName?groupId=${groupId}&name=${encodeURIComponent(newName)}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });
            if (!response.ok) {
                const errMsg = yield response.text();
                throw new Error(errMsg || "Error al actualizar el nombre del grupo.");
            }
            showToast("¡Nombre del grupo actualizado con éxito!", false);
            setTimeout(() => {
                window.location.href = `/Group/AdminPanel?groupId=${groupId}`;
            }, 1500);
        }
        catch (error) {
            console.error("Error al guardar cambios de grupo:", error);
            showToast(error.message || "No se pudo actualizar el nombre del grupo.", true);
            btnSaveSettings.disabled = false;
            btnSaveSettings.innerHTML = `💾 Guardar Nombre`;
        }
    }));
    // Anti forgery token helper
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    };
    // Carga inicial
    loadGroupData();
});

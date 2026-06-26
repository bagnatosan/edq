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
    createGroupForm.addEventListener("submit", (e) => __awaiter(void 0, void 0, void 0, function* () {
        e.preventDefault();
        const name = groupNameInput.value.trim();
        if (!name)
            return;
        btnCreateGroup.disabled = true;
        btnCreateGroup.classList.add("btn-loading");
        const spinner = document.createElement("span");
        spinner.className = "btn-spinner";
        btnCreateGroup.appendChild(spinner);
        try {
            const response = yield fetch(`/Group/CreateGroup?name=${encodeURIComponent(name)}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });
            if (!response.ok) {
                const errMsg = yield response.text();
                throw new Error(errMsg || "Error al crear el grupo.");
            }
            const data = yield response.json();
            showToast("¡Grupo creado con éxito!", false);
            setTimeout(() => {
                window.location.href = `/Group/Dashboard?groupId=${data.groupId}`;
            }, 1500);
        }
        catch (error) {
            console.error("Error al crear grupo:", error);
            showToast(error.message || "No se pudo crear el grupo.", true);
            btnCreateGroup.disabled = false;
            btnCreateGroup.classList.remove("btn-loading");
            const existingSpinner = btnCreateGroup.querySelector(".btn-spinner");
            if (existingSpinner)
                existingSpinner.remove();
        }
    }));
});

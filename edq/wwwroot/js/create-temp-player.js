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
    // Controles de jugador temporal
    const createTempPlayerForm = document.getElementById("createTempPlayerForm");
    const tempPlayerName = document.getElementById("tempPlayerName");
    const tempPlayerLastName = document.getElementById("tempPlayerLastName");
    const tempPlayerScore = document.getElementById("tempPlayerScore");
    const tempPlayerScoreVal = document.getElementById("tempPlayerScoreVal");
    if (!groupIdInput || !groupNameTitle || !createTempPlayerForm)
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
    // Vincular slider del formulario
    if (tempPlayerScore && tempPlayerScoreVal) {
        tempPlayerScore.addEventListener("input", () => {
            tempPlayerScoreVal.textContent = tempPlayerScore.value;
        });
    }
    // Cargar nombre del grupo para el encabezado
    const loadGroupName = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/Group/GetGroupDashboardData?groupId=${groupId}`);
            if (!response.ok)
                throw new Error("Error al cargar los datos del grupo.");
            const data = yield response.json();
            groupNameTitle.textContent = `Nuevo Jugador - ${data.groupName}`;
        }
        catch (error) {
            console.error("Error al obtener nombre de grupo:", error);
        }
    });
    loadGroupName();
    // Crear jugador temporal
    createTempPlayerForm.addEventListener("submit", (e) => __awaiter(void 0, void 0, void 0, function* () {
        e.preventDefault();
        if (!tempPlayerName || !tempPlayerLastName || !tempPlayerScore)
            return;
        const name = tempPlayerName.value.trim();
        const lastName = tempPlayerLastName.value.trim();
        const score = parseInt(tempPlayerScore.value);
        if (!name || !lastName || isNaN(score))
            return;
        const submitBtn = document.getElementById("btnCreateTempPlayer");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add("btn-loading");
            const spinner = document.createElement("span");
            spinner.className = "btn-spinner";
            submitBtn.appendChild(spinner);
        }
        try {
            const response = yield fetch(`/Group/CreateTemporaryPlayer?groupId=${groupId}&name=${encodeURIComponent(name)}&lastName=${encodeURIComponent(lastName)}&initialScore=${score}`, {
                method: "POST",
                headers: {
                    "RequestVerificationToken": getAntiForgeryToken()
                }
            });
            if (!response.ok) {
                const errMsg = yield response.text();
                throw new Error(errMsg || "Error al crear el jugador temporal.");
            }
            showToast("¡Jugador temporal creado e integrado con éxito!", false);
            // Limpiar inputs
            tempPlayerName.value = "";
            tempPlayerLastName.value = "";
            tempPlayerScore.value = "6";
            if (tempPlayerScoreVal)
                tempPlayerScoreVal.textContent = "6";
            // Habilitar botón para poder crear otro
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove("btn-loading");
                const existingSpinner = submitBtn.querySelector(".btn-spinner");
                if (existingSpinner)
                    existingSpinner.remove();
            }
        }
        catch (error) {
            console.error("Error creando jugador temporal:", error);
            showToast(error.message || "No se pudo crear el jugador temporal.", true);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove("btn-loading");
                const existingSpinner = submitBtn.querySelector(".btn-spinner");
                if (existingSpinner)
                    existingSpinner.remove();
            }
        }
    }));
    // Anti forgery token helper
    const getAntiForgeryToken = () => {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    };
});

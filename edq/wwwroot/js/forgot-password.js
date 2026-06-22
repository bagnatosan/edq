"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    if (form) {
        form.addEventListener("submit", () => {
            const btn = form.querySelector('button[type="submit"]');
            if (btn && !btn.classList.contains("btn-loading")) {
                btn.classList.add("btn-loading");
                const spinner = document.createElement("span");
                spinner.className = "btn-spinner";
                btn.appendChild(spinner);
            }
        });
    }
});

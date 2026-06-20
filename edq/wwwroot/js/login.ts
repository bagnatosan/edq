document.addEventListener("DOMContentLoaded", () => {
    const authWrapper = document.getElementById("authWrapper") as HTMLDivElement | null;
    const loginForm = document.getElementById("loginForm") as HTMLDivElement | null;
    const registerForm = document.getElementById("registerForm") as HTMLDivElement | null;
    const linkGoToRegister = document.getElementById("linkGoToRegister") as HTMLAnchorElement | null;
    const linkGoToLogin = document.getElementById("linkGoToLogin") as HTMLAnchorElement | null;
    const profilePhotoInput = document.getElementById("profilePhotoInput") as HTMLInputElement | null;
    const fileUploadBtn = document.getElementById("fileUploadBtn") as HTMLDivElement | null;

    if (!authWrapper || !loginForm || !registerForm) return;

    // Función para ajustar la altura del contenedor dinámicamente según el formulario visible
    const adjustContainerHeight = (): void => {
        const activeForm = authWrapper.classList.contains("show-register") ? registerForm : loginForm;
        authWrapper.style.height = `${activeForm.offsetHeight}px`;
    };

    // Ajustar altura inicial al cargar la página
    setTimeout(adjustContainerHeight, 100);

    // Alternar a Registro
    if (linkGoToRegister) {
        linkGoToRegister.addEventListener("click", (e: MouseEvent) => {
            e.preventDefault();
            authWrapper.classList.add("show-register");
            adjustContainerHeight();
        });
    }

    // Alternar a Login
    if (linkGoToLogin) {
        linkGoToLogin.addEventListener("click", (e: MouseEvent) => {
            e.preventDefault();
            authWrapper.classList.remove("show-register");
            adjustContainerHeight();
        });
    }

    // Mostrar el nombre del archivo de foto seleccionado
    if (profilePhotoInput && fileUploadBtn) {
        profilePhotoInput.addEventListener("change", () => {
            if (profilePhotoInput.files && profilePhotoInput.files.length > 0) {
                fileUploadBtn.textContent = `✔️ ${profilePhotoInput.files[0].name}`;
                fileUploadBtn.style.borderColor = "var(--neon-green-solid)";
                fileUploadBtn.style.color = "var(--neon-green)";
            } else {
                fileUploadBtn.textContent = "📷 Seleccionar archivo...";
                fileUploadBtn.style.borderColor = "var(--text-secondary)";
                fileUploadBtn.style.color = "var(--text-secondary)";
            }
            // Reajustar la altura en caso de que cambie por el texto
            setTimeout(adjustContainerHeight, 50);
        });
    }

    // Reajustar la altura si cambia el tamaño de la ventana (responsive layout)
    window.addEventListener("resize", adjustContainerHeight);
});

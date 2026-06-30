interface SimPlayer {
    name: string;
    score: number;
}

document.addEventListener("DOMContentLoaded", () => {
    const simTeamA = document.getElementById("simTeamA");
    const simTeamB = document.getElementById("simTeamB");
    const simConsole = document.getElementById("simConsole");
    const simDiffVal = document.getElementById("simDiffVal");
    const simTimeVal = document.getElementById("simTimeVal");
    const btnStartSim = document.getElementById("btnStartSim") as HTMLButtonElement | null;
    const btnResetSim = document.getElementById("btnResetSim") as HTMLButtonElement | null;

    if (!simTeamA || !simTeamB || !simConsole || !simDiffVal || !simTimeVal || !btnStartSim || !btnResetSim) return;

    const basePlayers: SimPlayer[] = [
        { name: "Lucas", score: 9 },
        { name: "Mateo", score: 8 },
        { name: "Tomas", score: 8 },
        { name: "Juan", score: 7 },
        { name: "Santi", score: 7 },
        { name: "Nico", score: 6 },
        { name: "Fede", score: 6 },
        { name: "Gabi", score: 5 },
        { name: "Leo", score: 4 },
        { name: "Alan", score: 3 }
    ];

    let teamA: SimPlayer[] = [];
    let teamB: SimPlayer[] = [];
    let simInterval: number | null = null;
    let iterationsWithoutImprovement = 0;
    const maxIterations = 60;
    let startTime = 0;
    let currentDifference = 0;

    const renderLists = (highlightA?: string, highlightB?: string) => {
        simTeamA.innerHTML = teamA.map(p => `
            <div class="player-card ${p.name === highlightA ? 'highlight-swap' : ''}" style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 6px; border-radius: 4px; display: flex; justify-content: space-between; font-size: 13px; background: rgba(255,255,255,0.01); transition: background-color 0.2s;">
                <span>${p.name}</span>
                <span style="color: var(--neon-green); font-weight: 700;">★ ${p.score}</span>
            </div>
        `).join("");

        simTeamB.innerHTML = teamB.map(p => `
            <div class="player-card ${p.name === highlightB ? 'highlight-swap' : ''}" style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 6px; border-radius: 4px; display: flex; justify-content: space-between; font-size: 13px; background: rgba(255,255,255,0.01); transition: background-color 0.2s;">
                <span>${p.name}</span>
                <span style="color: var(--neon-green); font-weight: 700;">★ ${p.score}</span>
            </div>
        `).join("");

        const sumA = teamA.reduce((sum, p) => sum + p.score, 0);
        const sumB = teamB.reduce((sum, p) => sum + p.score, 0);
        currentDifference = Math.Abs(sumA - sumB);
        simDiffVal.textContent = currentDifference.toString();
        
        const elapsed = (performance.now() - startTime).toFixed(1);
        simTimeVal.textContent = `${elapsed} ms`;
    };

    const Math = {
        Abs: (val: number) => val < 0 ? -val : val
    };

    const logToConsole = (text: string, isSuccess: boolean = false) => {
        const line = document.createElement("div");
        line.style.padding = "2px 0";
        line.style.fontSize = "11px";
        line.style.borderBottom = "1px solid rgba(255,255,255,0.02)";
        line.style.color = isSuccess ? "var(--neon-green)" : "var(--text-muted)";
        line.textContent = text;
        simConsole.appendChild(line);
        simConsole.scrollTop = simConsole.scrollHeight;
    };

    const initSim = () => {
        if (simInterval) {
            clearInterval(simInterval);
            simInterval = null;
        }
        simConsole.innerHTML = "";
        iterationsWithoutImprovement = 0;
        
        // Inicializar con la peor asignación posible (fuertes contra débiles) para requerir más iteraciones y mostrar la optimización
        teamA = [...basePlayers].slice(0, 5);
        teamB = [...basePlayers].slice(5);

        startTime = performance.now();
        renderLists();
        logToConsole("Iniciando balanceo: mezcla aleatoria inicial...");
        btnStartSim.disabled = false;
        btnStartSim.textContent = "Iniciar Simulación";
    };

    const stepSim = () => {
        if (currentDifference <= 1 || iterationsWithoutImprovement >= maxIterations) {
            if (simInterval) clearInterval(simInterval);
            logToConsole(`¡Optimización completada! Diferencia final: ${currentDifference}. Convergencia lograda en ${iterationsWithoutImprovement} iteraciones sin mejora.`, true);
            btnStartSim.textContent = "Completado";
            btnStartSim.disabled = true;
            return;
        }

        const idxA = window.Math.floor(window.Math.random() * teamA.length);
        const idxB = window.Math.floor(window.Math.random() * teamB.length);

        const playerA = teamA[idxA];
        const playerB = teamB[idxB];

        const sumA = teamA.reduce((sum, p) => sum + p.score, 0);
        const sumB = teamB.reduce((sum, p) => sum + p.score, 0);

        const sumAAfter = sumA - playerA.score + playerB.score;
        const sumBAfter = sumB - playerB.score + playerA.score;
        const nextDifference = Math.Abs(sumAAfter - sumBAfter);

        if (nextDifference < currentDifference) {
            teamA[idxA] = playerB;
            teamB[idxB] = playerA;
            iterationsWithoutImprovement = 0;
            renderLists(playerB.name, playerA.name);
            logToConsole(`Intercambio exitoso: ${playerA.name} (★${playerA.score}) ⇆ ${playerB.name} (★${playerB.score}). Nueva diferencia: ${nextDifference}`, true);
        } else {
            iterationsWithoutImprovement++;
            logToConsole(`Evaluando: ${playerA.name} ⇆ ${playerB.name}. Diferencia sería ${nextDifference} (Rechazado)`);
        }
    };

    btnStartSim.addEventListener("click", () => {
        if (simInterval) {
            clearInterval(simInterval);
            simInterval = null;
            btnStartSim.textContent = "Reanudar Simulación";
        } else {
            startTime = performance.now();
            simInterval = window.setInterval(stepSim, 250);
            btnStartSim.textContent = "Pausar Simulación";
        }
    });

    btnResetSim.addEventListener("click", () => {
        initSim();
    });

    // Carga inicial de datos estáticos
    initSim();
});

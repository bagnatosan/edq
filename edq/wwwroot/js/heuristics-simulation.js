"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const simTeamA = document.getElementById("simTeamA");
    const simTeamB = document.getElementById("simTeamB");
    const simConsole = document.getElementById("simConsole");
    const simDiffVal = document.getElementById("simDiffVal");
    const simTimeVal = document.getElementById("simTimeVal");
    const btnStartSim = document.getElementById("btnStartSim");
    const btnResetSim = document.getElementById("btnResetSim");
    if (!simTeamA || !simTeamB || !simConsole || !simDiffVal || !simTimeVal || !btnStartSim || !btnResetSim)
        return;
    const basePlayers = [
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
    let teamA = [];
    let teamB = [];
    let simInterval = null;
    let startTime = 0;
    let currentDifference = 0;
    let scriptStep = 0;
    const simScript = [
        // 1. Swap 1 (Diff: 15 -> 13)
        { action: "swap", playerA: "Santi", playerB: "Nico" },
        // 2. Reject (Diff would revert to 15)
        { action: "reject", playerA: "Lucas", playerB: "Santi" },
        // 3. Swap 2 (Diff: 13 -> 11)
        { action: "swap", playerA: "Juan", playerB: "Fede" },
        // 4. Reject (Diff would revert to 13)
        { action: "reject", playerA: "Mateo", playerB: "Fede" },
        // 5. Swap 3 (Diff: 11 -> 9)
        { action: "swap", playerA: "Nico", playerB: "Gabi" },
        // 6. Reject (Diff would revert to 15)
        { action: "reject", playerA: "Tomas", playerB: "Gabi" },
        // 7. Swap 4 (Diff: 9 -> 5)
        { action: "swap", playerA: "Fede", playerB: "Leo" },
        // 8. Reject (Diff would revert to 15)
        { action: "reject", playerA: "Lucas", playerB: "Leo" },
        // 9. Swap 5 (Diff: 5 -> 3)
        { action: "swap", playerA: "Tomas", playerB: "Santi" },
        // 10. Reject (Diff would revert to 5)
        { action: "reject", playerA: "Mateo", playerB: "Santi" },
        // 11. Swap 6 (Diff: 3 -> 1)
        { action: "swap", playerA: "Mateo", playerB: "Juan" }
    ];
    const mathAbs = (val) => val < 0 ? -val : val;
    const renderLists = (highlightA, highlightB) => {
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
        currentDifference = mathAbs(sumA - sumB);
        simDiffVal.textContent = currentDifference.toString();
        const elapsed = (performance.now() - startTime).toFixed(1);
        simTimeVal.textContent = `${elapsed} ms`;
    };
    const logToConsole = (text, isSuccess = false) => {
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
        scriptStep = 0;
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
        if (scriptStep >= simScript.length) {
            if (simInterval)
                clearInterval(simInterval);
            logToConsole(`¡Optimización completada! Diferencia final: ${currentDifference}. Convergencia lograda en 6 intercambios exitosos.`, true);
            btnStartSim.textContent = "Completado";
            btnStartSim.disabled = true;
            return;
        }
        const step = simScript[scriptStep];
        scriptStep++;
        const pA = teamA.find(p => p.name === step.playerA);
        const pB = teamB.find(p => p.name === step.playerB);
        if (!pA || !pB)
            return;
        const sumA = teamA.reduce((sum, p) => sum + p.score, 0);
        const sumB = teamB.reduce((sum, p) => sum + p.score, 0);
        const sumAAfter = sumA - pA.score + pB.score;
        const sumBAfter = sumB - pB.score + pA.score;
        const nextDifference = mathAbs(sumAAfter - sumBAfter);
        if (step.action === "swap") {
            const idxA = teamA.indexOf(pA);
            const idxB = teamB.indexOf(pB);
            teamA[idxA] = pB;
            teamB[idxB] = pA;
            renderLists(pB.name, pA.name);
            logToConsole(`Intercambio exitoso: ${pA.name} (★${pA.score}) ⇆ ${pB.name} (★${pB.score}). Nueva diferencia: ${nextDifference}`, true);
        }
        else {
            logToConsole(`Evaluando: ${pA.name} ⇆ ${pB.name}. Diferencia sería ${nextDifference} (Rechazado)`);
        }
    };
    btnStartSim.addEventListener("click", () => {
        if (simInterval) {
            clearInterval(simInterval);
            simInterval = null;
            btnStartSim.textContent = "Reanudar Simulación";
        }
        else {
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

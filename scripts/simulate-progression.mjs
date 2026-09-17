// Rejoue des stratégies réalistes — sessions courtes, app fermée entre deux,
// crédit hors-ligne plafonné comme un vrai retour — pour mesurer le temps
// réel jusqu'à chaque palier visuel. Sert à documenter la courbe dans le
// rapport V0 avec des chiffres mesurés, jamais inventés, et à calibrer
// l'équilibrage : ni un jeu fini en quelques minutes, ni un jeu qui ne bouge
// jamais pendant une vraie absence.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInitialState } from "../src/engine/state.js";
import {
  applyTick,
  applyTap,
  applyOfflineProgress,
  purchaseProductionUpgrade,
  purchaseGlobalUpgrade,
} from "../src/engine/simulation.js";
import { STAGES, PRODUCTION_ORDER, GLOBAL_UPGRADES } from "../src/engine/balance.js";
import { formatDuration } from "../src/ui/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 1000;
const MAX_SIM_MS = 10 * 24 * 3600 * 1000; // borne large (10 j) pour repérer un équilibrage qui ne termine jamais.

function greedyBuyAll(state) {
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of PRODUCTION_ORDER) {
      if (purchaseProductionUpgrade(state, id).ok) bought = true;
    }
    for (const id of Object.keys(GLOBAL_UPGRADES)) {
      if (purchaseGlobalUpgrade(state, id).ok) bought = true;
    }
  }
}

function recordStageCrossings(state, elapsed, stageTimesMs, nextStageIndexRef) {
  while (nextStageIndexRef.value < STAGES.length && state.totalGrowth >= STAGES[nextStageIndexRef.value].threshold) {
    stageTimesMs[nextStageIndexRef.value] = elapsed;
    nextStageIndexRef.value += 1;
  }
}

// Modèle réaliste : l'app tourne seulement pendant des sessions actives
// (tap à ~1/s + achat immédiat de tout ce qui est affordable), puis se
// FERME (aucun applyTick pendant l'intervalle) — la reprise passe par le
// même calcul hors-ligne plafonné que le vrai jeu, jamais par un tick
// continu déguisé.
function runSessionStrategy({ name, sessionsPerDay, sessionMinutes, tapsPerSecond }) {
  const state = createInitialState(0);
  let elapsed = 0;
  const stageTimesMs = { 0: 0 };
  const nextStageIndexRef = { value: 1 };
  const gapMs = (24 * 3600 * 1000) / sessionsPerDay;
  const sessionMs = sessionMinutes * 60 * 1000;
  let totalOfflineGain = 0;

  while (elapsed < MAX_SIM_MS && nextStageIndexRef.value < STAGES.length) {
    // Fermeture depuis la fin de la session précédente (ou depuis t=0).
    if (elapsed > 0) {
      const offline = applyOfflineProgress(state, gapMs - sessionMs);
      totalOfflineGain += offline.gained;
      elapsed += gapMs - sessionMs;
      recordStageCrossings(state, elapsed, stageTimesMs, nextStageIndexRef);
      if (nextStageIndexRef.value >= STAGES.length) break;
    }

    // Session active : ticks réguliers + taps + achats immédiats.
    let sessionElapsed = 0;
    while (sessionElapsed < sessionMs && nextStageIndexRef.value < STAGES.length) {
      applyTick(state, STEP_MS, elapsed + sessionElapsed + STEP_MS);
      for (let i = 0; i < tapsPerSecond; i += 1) applyTap(state, elapsed + sessionElapsed);
      greedyBuyAll(state);
      sessionElapsed += STEP_MS;
      recordStageCrossings(state, elapsed + sessionElapsed, stageTimesMs, nextStageIndexRef);
    }
    elapsed += sessionMs;
  }

  return {
    name,
    reachedAllStages: nextStageIndexRef.value >= STAGES.length,
    cappedAtMs: elapsed >= MAX_SIM_MS ? elapsed : null,
    stageTimesMs,
    finalTotalGrowth: state.totalGrowth,
    totalTaps: state.stats.totalTaps,
    totalOfflineGain: Math.round(totalOfflineGain),
  };
}

// Scénario de contrôle : onglet laissé ouvert et actif en continu, sans
// jamais fermer l'app ni interagir — mesure la dérive purement passive,
// jamais plafonnée puisque le jeu tourne réellement (pas de "retour").
function runContinuousIdle() {
  const state = createInitialState(0);
  let elapsed = 0;
  const stageTimesMs = { 0: 0 };
  const nextStageIndexRef = { value: 1 };

  while (elapsed < MAX_SIM_MS && nextStageIndexRef.value < STAGES.length) {
    applyTick(state, STEP_MS, elapsed + STEP_MS);
    elapsed += STEP_MS;
    recordStageCrossings(state, elapsed, stageTimesMs, nextStageIndexRef);
  }

  return {
    name: "Onglet laissé ouvert en continu, jamais d'achat (contrôle)",
    reachedAllStages: nextStageIndexRef.value >= STAGES.length,
    cappedAtMs: elapsed >= MAX_SIM_MS ? elapsed : null,
    stageTimesMs,
    finalTotalGrowth: state.totalGrowth,
    totalTaps: 0,
    totalOfflineGain: 0,
  };
}

const results = [
  runSessionStrategy({ name: "Léger : 2 sessions/jour de 1 min", sessionsPerDay: 2, sessionMinutes: 1, tapsPerSecond: 1 }),
  runSessionStrategy({ name: "Modéré : 3 sessions/jour de 3 min", sessionsPerDay: 3, sessionMinutes: 3, tapsPerSecond: 1 }),
  runSessionStrategy({ name: "Assidu : 5 sessions/jour de 5 min", sessionsPerDay: 5, sessionMinutes: 5, tapsPerSecond: 1.5 }),
  runContinuousIdle(),
];

console.log("\n=== HAVEN V0 — simulation de progression (sessions réalistes) ===\n");
for (const result of results) {
  console.log(`Stratégie : ${result.name}`);
  for (const stage of STAGES) {
    const t = result.stageTimesMs[stage.id];
    console.log(
      `  Palier ${stage.id} — ${stage.name.padEnd(24)} ${t !== undefined ? formatDuration(t) : `non atteint (>${formatDuration(MAX_SIM_MS)})`}`
    );
  }
  console.log(
    `  Taps totaux : ${result.totalTaps} · Gain hors-ligne cumulé : ${result.totalOfflineGain} · Vitalité cumulée finale : ${Math.round(result.finalTotalGrowth)}`
  );
  console.log("");
}

const outPath = join(__dirname, "..", "docs", "haven-v0-simulation-results.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`Résultats écrits dans ${outPath}`);

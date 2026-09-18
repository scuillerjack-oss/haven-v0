// Simulations économiques V2 (cahier des charges V2, points 2 et 8) : la
// bêta Android a révélé un début trop lent. Ce script mesure, avec le
// vrai moteur (jamais une estimation manuelle), si la nouvelle courbe de
// mapDefinitions.js tient les deux objectifs simultanés :
//   - un début très rapide (première amélioration en 20-40s, plusieurs
//     décisions dans les 2-3 premières minutes) ;
//   - une durée totale de Map 1 qui ne s'est pas encore raccourcie par
//     rapport au problème déjà signalé en V1 (7-30 min de jeu ACTIF).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, applyOfflineProgress, purchaseMapUpgrade, canRenaissance } from "../src/engine/simulation.js";
import { UPGRADE_PATH_IDS } from "../src/engine/mapUpgrades.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { progressRatio } from "../src/engine/mapEconomy.js";
import { formatDuration } from "../src/ui/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 1000;

function greedyBuyEverything(game) {
  let bought = 0;
  let again = true;
  while (again) {
    again = false;
    const mapDef = getMapDefinition(game.currentMapId);
    const mapState = game.maps[game.currentMapId];
    for (const pathId of UPGRADE_PATH_IDS) {
      if (purchaseMapUpgrade(game, mapState, mapDef, pathId).ok) {
        again = true;
        bought += 1;
      }
    }
  }
  return bought;
}

// --- Q1 : joueur actif continu (aucune fermeture d'app), on capture des
// clichés à 1/3/10/30 min et 1h : argent, nombre d'achats cumulés, et le
// premier instant d'achat toutes familles confondues. C'est la mesure la
// plus directe du "je fais ma première décision en X secondes". ---
function activeStartSim() {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  const checkpoints = [60_000, 3 * 60_000, 10 * 60_000, 30 * 60_000, 3600_000];
  const snapshots = [];
  let elapsed = 0;
  let totalPurchases = 0;
  let firstPurchaseAt = null;
  let checkpointIdx = 0;
  const MAX_MS = 3600_000;

  while (elapsed < MAX_MS) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    const bought = greedyBuyEverything(game);
    if (bought > 0) {
      totalPurchases += bought;
      if (firstPurchaseAt === null) firstPurchaseAt = elapsed;
    }
    while (checkpointIdx < checkpoints.length && elapsed >= checkpoints[checkpointIdx]) {
      snapshots.push({
        atMs: checkpoints[checkpointIdx],
        money: Math.round(game.money * 100) / 100,
        totalPurchases,
        progressRatio: progressRatio(mapState, mapDef),
      });
      checkpointIdx += 1;
    }
  }
  return { firstPurchaseAt, snapshots };
}

// --- Q2 : combien de temps (jeu actif continu, sans fermeture) pour finir
// la Map 1 — pour vérifier que la nouvelle courbe n'a pas raccourci ce qui
// était déjà signalé comme trop court en V1 (7-30 min actif). ---
function activeMapCompletionSim() {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  const MAX_MS = 48 * 3600_000;
  let elapsed = 0;
  let totalPurchases = 0;
  while (elapsed < MAX_MS && progressRatio(mapState, mapDef) < 1) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    totalPurchases += greedyBuyEverything(game);
  }
  return {
    mapCompleteActiveMs: progressRatio(mapState, mapDef) >= 1 ? elapsed : null,
    totalPurchases,
  };
}

// --- Q8 (reformulé V2) : profils réalistes avec hors-ligne, comme en V1,
// mais on ajoute le NOMBRE de décisions/achats accessibles pendant les
// premières minutes, pas seulement le temps jusqu'à 100%. ---
function runSessionProfile({ name, sessionsPerDay, sessionMinutes }) {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  let elapsed = 0;
  const gapMs = (24 * 3600 * 1000) / sessionsPerDay;
  const sessionMs = sessionMinutes * 60 * 1000;
  const MAX_MS = 10 * 24 * 3600 * 1000;
  let totalPurchases = 0;
  let firstPurchaseAt = null;
  let purchasesInFirst3Min = 0;
  let mapCompleteAt = null;
  let activeMs = 0;
  let activeMsAtMapComplete = null;
  let prestigeAvailableAt = null;

  while (elapsed < MAX_MS) {
    if (elapsed > 0) {
      applyOfflineProgress(game, gapMs - sessionMs);
      elapsed += gapMs - sessionMs;
      if (mapCompleteAt === null && progressRatio(mapState, mapDef) >= 1) {
        mapCompleteAt = elapsed;
        activeMsAtMapComplete = activeMs;
      }
      if (prestigeAvailableAt === null && canRenaissance(game)) prestigeAvailableAt = elapsed;
      if (mapCompleteAt !== null && prestigeAvailableAt !== null) break;
    }
    let sessionElapsed = 0;
    while (sessionElapsed < sessionMs) {
      applyTick(game, STEP_MS);
      const bought = greedyBuyEverything(game);
      sessionElapsed += STEP_MS;
      activeMs += STEP_MS;
      const now = elapsed + sessionElapsed;
      if (bought > 0) {
        totalPurchases += bought;
        if (firstPurchaseAt === null) firstPurchaseAt = now;
        if (now <= 3 * 60_000) purchasesInFirst3Min += bought;
      }
      if (mapCompleteAt === null && progressRatio(mapState, mapDef) >= 1) {
        mapCompleteAt = now;
        activeMsAtMapComplete = activeMs;
      }
      if (prestigeAvailableAt === null && canRenaissance(game)) prestigeAvailableAt = now;
    }
    elapsed += sessionMs;
    if (mapCompleteAt !== null && prestigeAvailableAt !== null) break;
  }

  return {
    name,
    firstPurchaseAt,
    purchasesInFirst3Min,
    totalPurchases,
    mapCompleteAt,
    activeMsAtMapComplete,
    prestigeAvailableAt,
  };
}

// --- Vérification du plafond de vitesse visuelle : aucune phase générée
// ne doit jamais descendre sous MIN_VISUAL_PHASE_MS / MIN_VISUAL_TRANSPORT_
// INTERVAL_MS, à AUCUN niveau, de AUCUNE famille. ---
function visualFloorsRespected() {
  const mapDef = getMapDefinition("water");
  const results = [];
  for (const [pathId, family] of Object.entries(mapDef.producerUpgrades)) {
    for (const lvl of family.levels) {
      if (lvl.multiplier === undefined) continue;
      for (const [phaseKey, famId] of Object.entries(mapDef.phaseFamily)) {
        if (famId !== pathId) continue;
        const durationMs = mapDef.phases[phaseKey] * lvl.multiplier;
        results.push({ pathId, level: lvl.level, phaseKey, durationMs });
      }
    }
  }
  const minPhaseFloorMs = 250;
  const worstPhase = results.reduce((min, r) => (r.durationMs < min.durationMs ? r : min), results[0]);
  const transportResults = mapDef.transportFrequencyUpgrades.levels.map((l) => l.intervalMs);
  const worstTransportMs = Math.min(...transportResults);
  return {
    allPhasesRespectFloor: results.every((r) => r.durationMs >= minPhaseFloorMs - 1e-6),
    worstPhase,
    allTransportRespectFloor: transportResults.every((ms) => ms >= 6000),
    worstTransportMs,
  };
}

// --- Exécution ---
console.log("\n=== HAVEN V2 — simulations économiques (début rapide + longueur totale) ===\n");

console.log("Q1 — Joueur actif continu, clichés à 1/3/10/30 min et 1h :");
const activeStart = activeStartSim();
console.log(`  Première décision (achat) : ${activeStart.firstPurchaseAt !== null ? formatDuration(activeStart.firstPurchaseAt) : "aucune sous 1h"}`);
for (const s of activeStart.snapshots) {
  console.log(
    `  ${formatDuration(s.atMs).padEnd(8)} -> ${s.totalPurchases} achat(s) cumulé(s), ${s.money.toFixed(1)} argent, ${(s.progressRatio * 100).toFixed(2)}% de la map`
  );
}
console.log("");

console.log("Q2 — Temps jusqu'à Map 1 complète (jeu actif continu, sans fermeture) :");
const activeCompletion = activeMapCompletionSim();
console.log(
  `  ${activeCompletion.mapCompleteActiveMs !== null ? formatDuration(activeCompletion.mapCompleteActiveMs) : "non atteint sous 6h"} (${activeCompletion.totalPurchases} achats au total)`
);
console.log("");

console.log("Q8 — Profils réalistes avec hors-ligne (décisions ET temps) :");
const profiles = [
  { name: "Léger : 2 sessions/jour de 1 min", sessionsPerDay: 2, sessionMinutes: 1 },
  { name: "Modéré : 3 sessions/jour de 3 min", sessionsPerDay: 3, sessionMinutes: 3 },
  { name: "Assidu : 5 sessions/jour de 5 min", sessionsPerDay: 5, sessionMinutes: 5 },
];
const profileResults = profiles.map(runSessionProfile);
for (const r of profileResults) {
  console.log(`Profil : ${r.name}`);
  console.log(`  Première décision (achat) : ${r.firstPurchaseAt !== null ? formatDuration(r.firstPurchaseAt) : "aucune"}`);
  console.log(`  Achats cumulés dans les 3 premières min de jeu actif : ${r.purchasesInFirst3Min}`);
  console.log(`  Map 1 complète : ${r.mapCompleteAt !== null ? formatDuration(r.mapCompleteAt) : "non atteint sous 10 j"}`);
  console.log(`    dont temps ACTIF cumulé : ${r.activeMsAtMapComplete !== null ? formatDuration(r.activeMsAtMapComplete) : "n/a"}`);
  console.log(`  Renaissance disponible : ${r.prestigeAvailableAt !== null ? formatDuration(r.prestigeAvailableAt) : "non atteint sous 10 j"}`);
  console.log(`  Achats cumulés totaux : ${r.totalPurchases}`);
  console.log("");
}

console.log("Plafonds de vitesse visuelle (aucune animation ne doit jamais descendre en dessous) :");
const floors = visualFloorsRespected();
console.log(`  Toutes les phases respectent MIN_VISUAL_PHASE_MS (250ms) : ${floors.allPhasesRespectFloor}`);
console.log(`  Pire cas phase : ${floors.worstPhase.pathId}/${floors.worstPhase.phaseKey} niveau ${floors.worstPhase.level} -> ${floors.worstPhase.durationMs.toFixed(1)}ms`);
console.log(`  Tous les intervalles de transport respectent MIN_VISUAL_TRANSPORT_INTERVAL_MS (6000ms) : ${floors.allTransportRespectFloor}`);
console.log(`  Pire cas transport : ${floors.worstTransportMs}ms`);
console.log("");

const output = { activeStart, activeCompletion, profileResults, floors };
const outPath = join(__dirname, "..", "docs", "haven-v2-simulation-results.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Résultats écrits dans ${outPath}`);

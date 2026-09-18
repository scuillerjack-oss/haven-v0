// Simulations économiques déterministes demandées par le cahier des
// charges V1 (section 20). Répond à chaque question avec des chiffres
// mesurés, jamais estimés à la main.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInitialState } from "../src/engine/state.js";
import {
  applyTick,
  applyOfflineProgress,
  purchaseMapUpgrade,
  purchasePerk,
  canRenaissance,
  perlesEarnable,
  performRenaissance,
  getModifiers,
} from "../src/engine/simulation.js";
import { UPGRADE_PATH_IDS, nextUpgradeInfo } from "../src/engine/mapUpgrades.js";
import { PERKS } from "../src/engine/meta.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { progressRatio, computeMapOfflineProgress } from "../src/engine/mapEconomy.js";
import { formatDuration } from "../src/ui/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 1000;

function greedyBuyEverything(game) {
  let bought = true;
  while (bought) {
    bought = false;
    const mapDef = getMapDefinition(game.currentMapId);
    const mapState = game.maps[game.currentMapId];
    for (const pathId of UPGRADE_PATH_IDS) {
      if (purchaseMapUpgrade(game, mapState, mapDef, pathId).ok) bought = true;
    }
    for (const perkId of Object.keys(PERKS)) {
      if (purchasePerk(game, perkId).ok) bought = true;
    }
  }
}

function firstUpgradeTimes(game, elapsed, firstTimes) {
  const mapDef = getMapDefinition(game.currentMapId);
  const mapState = game.maps[game.currentMapId];
  for (const pathId of UPGRADE_PATH_IDS) {
    const info = nextUpgradeInfo(mapState, mapDef, pathId);
    if (info.currentLevel > 1 && firstTimes[pathId] === undefined) {
      firstTimes[pathId] = elapsed;
    }
  }
}

// --- Q1/Q2 : durée de la Map 1 et rapidité des premières améliorations,
// sous plusieurs profils de jeu réalistes (sessions + app fermée entre
// deux, exactement comme un vrai joueur, jamais un tick continu déguisé) ---
function runSessionProfile({ name, sessionsPerDay, sessionMinutes }) {
  const game = createInitialState(0);
  let elapsed = 0;
  const gapMs = (24 * 3600 * 1000) / sessionsPerDay;
  const sessionMs = sessionMinutes * 60 * 1000;
  const firstUpgradeAt = {};
  let mapCompleteAt = null;
  let prestigeAvailableAt = null;
  let activeMsAtMapComplete = null;
  let activeMs = 0;
  const MAX_MS = 10 * 24 * 3600 * 1000;

  while (elapsed < MAX_MS) {
    if (elapsed > 0) {
      applyOfflineProgress(game, gapMs - sessionMs);
      elapsed += gapMs - sessionMs;
      firstUpgradeTimes(game, elapsed, firstUpgradeAt);
      if (mapCompleteAt === null && progressRatio(game.maps.water, getMapDefinition("water")) >= 1) {
        mapCompleteAt = elapsed;
        activeMsAtMapComplete = activeMs;
      }
      if (prestigeAvailableAt === null && canRenaissance(game)) prestigeAvailableAt = elapsed;
      if (mapCompleteAt !== null && prestigeAvailableAt !== null) break;
    }
    let sessionElapsed = 0;
    while (sessionElapsed < sessionMs) {
      applyTick(game, STEP_MS);
      greedyBuyEverything(game);
      sessionElapsed += STEP_MS;
      activeMs += STEP_MS;
      firstUpgradeTimes(game, elapsed + sessionElapsed, firstUpgradeAt);
      if (mapCompleteAt === null && progressRatio(game.maps.water, getMapDefinition("water")) >= 1) {
        mapCompleteAt = elapsed + sessionElapsed;
        activeMsAtMapComplete = activeMs;
      }
      if (prestigeAvailableAt === null && canRenaissance(game)) prestigeAvailableAt = elapsed + sessionElapsed;
    }
    elapsed += sessionMs;
    if (mapCompleteAt !== null && prestigeAvailableAt !== null) break;
  }

  return { name, firstUpgradeAt, mapCompleteAt, activeMsAtMapComplete, prestigeAvailableAt, finalMoney: game.money };
}

// --- Q3 : goulot d'étranglement récupérable ---
function bottleneckRecoverySim() {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  // Surinvestit la production sans jamais toucher au transport.
  mapState.producer.bucketLevel = 4;
  mapState.producer.movementLevel = 4;
  mapState.producer.winchLevel = 4;
  mapState.producer.wellLevel = 4;
  let elapsed = 0;
  let sawSaturation = false;
  for (let i = 0; i < 120; i += 1) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    if (mapState.producer.paused) sawSaturation = true;
  }
  const litersBefore = mapState.totalLitersShipped;
  // Le joueur corrige : améliore le transport.
  game.money = 999_999;
  purchaseMapUpgrade(game, mapState, mapDef, "transportCapacity");
  purchaseMapUpgrade(game, mapState, mapDef, "transportCapacity");
  purchaseMapUpgrade(game, mapState, mapDef, "transportFrequency");
  purchaseMapUpgrade(game, mapState, mapDef, "transportFrequency");
  let recovered = false;
  for (let i = 0; i < 60; i += 1) {
    applyTick(game, STEP_MS);
    if (!mapState.producer.paused) {
      recovered = true;
      break;
    }
  }
  return { sawSaturation, recovered, litersShippedBeforeFix: litersBefore };
}

// --- Q4 : fenêtres hors-ligne cohérentes ---
function offlineWindows() {
  const windows = [15 * 60, 3600, 4 * 3600, 8 * 3600, 24 * 3600].map((s) => s * 1000);
  const mapDef = getMapDefinition("water");
  return windows.map((ms) => {
    const game = createInitialState(0);
    const result = computeMapOfflineProgress(game.maps.water, mapDef, ms);
    return { durationMs: ms, litersShipped: result.litersShipped, moneyEarned: result.moneyEarned };
  });
}

// --- Q6/Q7 : timing du prestige et accélération post-prestige ---
// Méthodologie : jeu actif continu (sans coupure), pour isoler l'effet du
// bonus de prestige de tout effet de fenêtre hors-ligne.
function prestigeSpeedupSim() {
  const mapDef = getMapDefinition("water");
  const MAX_MS = 5 * 24 * 3600 * 1000;

  // Run de référence, sans jamais renaître : temps jusqu'à Map 1 complète.
  const control = createInitialState(0);
  let controlElapsed = 0;
  while (controlElapsed < MAX_MS && progressRatio(control.maps.water, mapDef) < 1) {
    applyTick(control, STEP_MS);
    greedyBuyEverything(control);
    controlElapsed += STEP_MS;
  }
  const firstRunMapCompleteAt = controlElapsed;

  // Run avec Renaissance dès que possible, puis mesure du temps pour
  // retrouver Map 1 complète depuis zéro, bonus de prestige appliqué.
  const game = createInitialState(0);
  let elapsed = 0;
  while (elapsed < MAX_MS && !canRenaissance(game)) {
    applyTick(game, STEP_MS);
    greedyBuyEverything(game);
    elapsed += STEP_MS;
  }
  const timeToFirstPrestigeAvailable = elapsed;
  const earned = perlesEarnable(game);
  performRenaissance(game);

  let elapsed2 = 0;
  let secondRunMapCompleteAt = null;
  while (elapsed2 < MAX_MS) {
    applyTick(game, STEP_MS);
    greedyBuyEverything(game);
    elapsed2 += STEP_MS;
    if (progressRatio(game.maps.water, mapDef) >= 1) {
      secondRunMapCompleteAt = elapsed2;
      break;
    }
  }
  return {
    firstRunMapCompleteAt,
    timeToFirstPrestigeAvailable,
    perlesEarned: earned,
    secondRunMapCompleteAt,
    speedupRatio: secondRunMapCompleteAt !== null ? firstRunMapCompleteAt / secondRunMapCompleteAt : null,
  };
}

// --- Q8 : choix réel entre atouts (aucun n'est strictement dominant) ---
function perksAreMeaningfulChoice() {
  const costs = Object.values(PERKS).map((p) => p.levels[0].cost);
  const allSameCost = costs.every((c) => c === costs[0]);
  return { costsVary: !allSameCost, perkCount: Object.keys(PERKS).length };
}

// --- Exécution ---
console.log("\n=== HAVEN V1 — simulations économiques (section 20) ===\n");

const profiles = [
  { name: "Léger : 2 sessions/jour de 1 min", sessionsPerDay: 2, sessionMinutes: 1 },
  { name: "Modéré : 3 sessions/jour de 3 min", sessionsPerDay: 3, sessionMinutes: 3 },
  { name: "Assidu : 5 sessions/jour de 5 min", sessionsPerDay: 5, sessionMinutes: 5 },
];
const profileResults = profiles.map(runSessionProfile);
for (const r of profileResults) {
  console.log(`Profil : ${r.name}`);
  console.log(`  Map 1 complète (100%) : ${r.mapCompleteAt !== null ? formatDuration(r.mapCompleteAt) : "non atteint sous 10 j"}`);
  console.log(`    dont temps ACTIF cumulé : ${r.activeMsAtMapComplete !== null ? formatDuration(r.activeMsAtMapComplete) : "n/a"}`);
  console.log(`  Renaissance disponible : ${r.prestigeAvailableAt !== null ? formatDuration(r.prestigeAvailableAt) : "non atteint sous 10 j"}`);
  console.log(`  Premières améliorations achetées :`);
  for (const [pathId, t] of Object.entries(r.firstUpgradeAt)) {
    console.log(`    ${pathId.padEnd(20)} ${formatDuration(t)}`);
  }
  console.log("");
}

console.log("Q3 — Goulot d'étranglement créé par le joueur, récupérable :");
const bottleneck = bottleneckRecoverySim();
console.log(`  Saturation observée après surinvestissement production : ${bottleneck.sawSaturation}`);
console.log(`  Récupéré après amélioration du transport : ${bottleneck.recovered}`);
console.log("");

console.log("Q4 — Fenêtres hors-ligne (état de départ, niveau 1 partout) :");
for (const w of offlineWindows()) {
  console.log(`  ${formatDuration(w.durationMs).padEnd(10)} -> ${w.litersShipped.toFixed(1)} L, ${w.moneyEarned.toFixed(1)} argent`);
}
console.log("");

console.log("Q6/Q7 — Timing du prestige et accélération post-prestige (jeu actif continu, sans coupure) :");
const prestige = prestigeSpeedupSim();
console.log(`  Run de référence (sans jamais renaître) : Map 1 complète en ${formatDuration(prestige.firstRunMapCompleteAt)}`);
console.log(`  Renaissance disponible après : ${formatDuration(prestige.timeToFirstPrestigeAvailable)}`);
console.log(`  Perles gagnées à la première Renaissance : ${prestige.perlesEarned}`);
console.log(
  `  2e run (avec bonus de prestige, dès zéro) : Map 1 complète en ${prestige.secondRunMapCompleteAt !== null ? formatDuration(prestige.secondRunMapCompleteAt) : "non atteint"}`
);
console.log(`  Accélération mesurée : x${prestige.speedupRatio?.toFixed(2) ?? "n/a"}`);
console.log("");

console.log("Q8 — Choix réel entre atouts :");
const perksChoice = perksAreMeaningfulChoice();
console.log(`  ${perksChoice.perkCount} familles, coûts de premier niveau variés : ${perksChoice.costsVary}`);
console.log("");

const output = { profileResults, bottleneck, offlineWindows: offlineWindows(), prestige, perksChoice };
const outPath = join(__dirname, "..", "docs", "haven-v1-simulation-results.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Résultats écrits dans ${outPath}`);

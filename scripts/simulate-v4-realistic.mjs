// V4, section "ÉQUILIBRAGE" du cahier des charges : la bêta humaine V3
// (un vrai joueur, pas un simulateur glouton) a pu faire progresser
// sensiblement le fermier/la production SANS ressentir le besoin
// d'améliorer le camion-citerne. `simulate-v3-bottleneck.mjs` ne rejoue
// qu'une stratégie gloutonne (achète tout ce qui est affordable, sur
// TOUTES les familles, à chaque tick) : elle ne peut donc pas révéler ce
// défaut, puisqu'elle achète déjà la citerne dès que possible.
//
// Ce script rejoue des séquences d'achats biaisées, plus proches d'un
// joueur réel qui préfère naturellement les familles "fermier" (seau,
// déplacement, corde/treuil, puits, rendement de vente) et néglige ou
// retarde stockage/citerne/fréquence transport :
//
// - "producerOnly"  : n'achète JAMAIS stockage/citerne/fréquence, quel
//   que soit l'argent disponible (le biais maximal — le joueur n'a
//   simplement jamais pensé à ces familles).
// - "producerFirst" : achète toujours en priorité les familles fermier,
//   mais dépense l'argent qui traîne (rien de fermier affordable ce
//   tick) sur stockage/citerne/fréquence plutôt que de le laisser
//   inutilisé — modélise un joueur qui finit par y toucher, mais tard.
//
// Sert de garde-fou permanent : si l'un de ces profils ne ressent jamais
// de pression réelle (le fermier ne se bloque jamais, "transport" ne
// devient jamais visible) avant un temps de jeu actif raisonnable, la
// courbe est déséquilibrée exactement comme la bêta l'a révélé.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, purchaseMapUpgrade } from "../src/engine/simulation.js";
import { UPGRADE_PATH_IDS } from "../src/engine/mapUpgrades.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { bottleneckKind } from "../src/engine/mapEconomy.js";
import { formatDuration } from "../src/ui/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 1000;
const MAX_MS = 6 * 3600_000;

const FARMER_PATHS = ["bucket", "movement", "winch", "well", "globalProductivity"];
const TRANSPORT_PATHS = ["buffer", "transportCapacity", "transportFrequency"];
// Le camion-citerne spécifiquement (pas le stockage, que le joueur associe
// plus facilement à "s'occuper de son eau") : c'est exactement le biais
// décrit par la bêta humaine — stockage acheté sans y penser, citerne/
// fréquence jamais considérées comme "faisant partie du fermier".
const FARMER_PLUS_BUFFER_PATHS = [...FARMER_PATHS, "buffer"];
const TRUCK_ONLY_PATHS = ["transportCapacity", "transportFrequency"];
const CATCH_UP_AT_MS = 45 * 60_000;

// Achète tout ce qui est affordable parmi `pathIds`, dans l'ordre donné,
// en boucle jusqu'à ce que plus rien ne le soit (plusieurs niveaux d'une
// même famille peuvent tomber le même tick une fois l'argent accumulé).
function buyAllAffordable(game, mapState, mapDef, pathIds) {
  let boughtAny = false;
  let again = true;
  while (again) {
    again = false;
    for (const pathId of pathIds) {
      if (purchaseMapUpgrade(game, mapState, mapDef, pathId).ok) {
        again = true;
        boughtAny = true;
      }
    }
  }
  return boughtAny;
}

const STRATEGIES = {
  producerOnly(game, mapState, mapDef) {
    buyAllAffordable(game, mapState, mapDef, FARMER_PATHS);
  },
  producerFirst(game, mapState, mapDef) {
    buyAllAffordable(game, mapState, mapDef, FARMER_PATHS);
    buyAllAffordable(game, mapState, mapDef, TRANSPORT_PATHS);
  },
  // Le biais réellement décrit par la bêta : la citerne/fréquence ne sont
  // JAMAIS achetées, même si de l'argent reste inutilisé — le joueur ne
  // les a simplement jamais considérées, contrairement au stockage.
  neverBuysTruck(game, mapState, mapDef) {
    buyAllAffordable(game, mapState, mapDef, FARMER_PLUS_BUFFER_PATHS);
  },
  // Même biais que ci-dessus pendant CATCH_UP_AT_MS, puis un joueur qui
  // "se rend enfin compte" et rattrape en glouton sur tout le reste de la
  // partie — modélise le moment où le joueur finit par toucher la citerne.
  neverBuysTruckThenCatchUp(game, mapState, mapDef, elapsed) {
    if (elapsed < CATCH_UP_AT_MS) {
      buyAllAffordable(game, mapState, mapDef, FARMER_PLUS_BUFFER_PATHS);
    } else {
      buyAllAffordable(game, mapState, mapDef, UPGRADE_PATH_IDS);
    }
  },
  greedy(game, mapState, mapDef) {
    buyAllAffordable(game, mapState, mapDef, UPGRADE_PATH_IDS);
  },
};

function runStrategy(name) {
  const buy = STRATEGIES[name];
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  let elapsed = 0;
  let lastKind = null;
  let firstTransportKindAt = null;
  let firstStorageFullAt = null;
  const macroSequence = [];
  const checkpoints = [5, 10, 20, 30, 60, 120, 180].map((m) => m * 60_000);
  const checkpointResults = [];
  let nextCheckpointIdx = 0;

  while (elapsed < MAX_MS) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    buy(game, mapState, mapDef, elapsed);

    const kind = bottleneckKind(mapState, mapDef);
    if (kind !== lastKind) {
      macroSequence.push({ atMs: elapsed, kind });
      lastKind = kind;
    }
    if (kind === "transport" && firstTransportKindAt === null) firstTransportKindAt = elapsed;
    if (kind === "storageFull" && firstStorageFullAt === null) firstStorageFullAt = elapsed;

    while (nextCheckpointIdx < checkpoints.length && elapsed >= checkpoints[nextCheckpointIdx]) {
      checkpointResults.push({
        atMs: checkpoints[nextCheckpointIdx],
        money: Math.round(game.money),
        totalLitersShipped: Math.round(mapState.totalLitersShipped),
        levels: {
          bucket: mapState.producer.bucketLevel,
          movement: mapState.producer.movementLevel,
          winch: mapState.producer.winchLevel,
          well: mapState.producer.wellLevel,
          buffer: mapState.buffer.level,
          transportCapacity: mapState.transport.capacityLevel,
          transportFrequency: mapState.transport.frequencyLevel,
          globalProductivity: mapState.globalProductivityLevel,
        },
        kind,
      });
      nextCheckpointIdx += 1;
    }

    // Sortie anticipée une fois storageFull observé ET tous les checkpoints
    // pertinents couverts : rejouer 6h de plus n'apporte plus d'information.
    if (firstStorageFullAt !== null && nextCheckpointIdx >= checkpoints.length) break;
  }

  return {
    name,
    firstTransportKindAt,
    firstStorageFullAt,
    macroSequence: macroSequence.slice(0, 20),
    macroSequenceTotalCount: macroSequence.length,
    checkpointResults,
    reachedMaxMsWithoutStall: firstStorageFullAt === null,
  };
}

console.log("\n=== HAVEN V4 — séquences d'achats réalistes (biais fermier) ===\n");
console.log("Objectif : vérifier qu'un joueur qui privilégie naturellement le fermier");
console.log("finit quand même par ressentir une vraie pression sur le transport,");
console.log("dans un temps de jeu actif raisonnable — pas seulement sous achat glouton.\n");

const results = {};
for (const name of Object.keys(STRATEGIES)) {
  const r = runStrategy(name);
  results[name] = r;
  console.log(`--- Stratégie "${name}" ---`);
  console.log(`  premier "transport" (goulot analytique) : ${r.firstTransportKindAt !== null ? formatDuration(r.firstTransportKindAt) : "jamais sous 6h"}`);
  console.log(`  premier "storageFull" (fermier bloqué, signal ressenti) : ${r.firstStorageFullAt !== null ? formatDuration(r.firstStorageFullAt) : "jamais sous 6h"}`);
  for (const cp of r.checkpointResults) {
    console.log(
      `  t=${formatDuration(cp.atMs)} -> argent=${cp.money}, litres=${cp.totalLitersShipped}, goulot=${cp.kind}, ` +
        `seau=${cp.levels.bucket} deplacement=${cp.levels.movement} treuil=${cp.levels.winch} puits=${cp.levels.well} ` +
        `stockage=${cp.levels.buffer} citerne=${cp.levels.transportCapacity} frequence=${cp.levels.transportFrequency} ` +
        `rendement=${cp.levels.globalProductivity}`
    );
  }
  console.log("");
}

const outPath = join(__dirname, "..", "docs", "haven-v4-realistic-purchases-results.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`Résultats écrits dans ${outPath}`);

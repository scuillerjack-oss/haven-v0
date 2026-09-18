// Simulation/replay reproductible demandée par le cahier des charges V3
// (section 2 et section 8) : rejoue une partie réaliste avec le vrai
// moteur (jamais une estimation à la main) et trace la séquence des
// goulots d'étranglement successifs (bottleneckKind), pour vérifier que
// stockage/citerne cessent d'être des branches inutiles pendant une
// longue partie du début de Map 1 — le défaut exact révélé par la bêta
// humaine V2 : déplacement/corde-treuil/puits déjà maxés, seau vers le
// niveau 7, alors que le diagnostic du jeu indiquait encore en permanence
// « la production limite le débit ».
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, purchaseMapUpgrade } from "../src/engine/simulation.js";
import { UPGRADE_PATH_IDS, nextUpgradeInfo } from "../src/engine/mapUpgrades.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { bottleneckKind } from "../src/engine/mapEconomy.js";
import { formatDuration } from "../src/ui/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 1000;
const MAX_MS = 3 * 3600_000;

function isMaxed(mapState, mapDef, pathId) {
  return nextUpgradeInfo(mapState, mapDef, pathId).next === undefined;
}

function greedyBuyEverything(game) {
  let again = true;
  while (again) {
    again = false;
    const mapDef = getMapDefinition(game.currentMapId);
    const mapState = game.maps[game.currentMapId];
    for (const pathId of UPGRADE_PATH_IDS) {
      if (purchaseMapUpgrade(game, mapState, mapDef, pathId).ok) again = true;
    }
  }
}

const game = createInitialState(0);
const mapDef = getMapDefinition("water");
const mapState = game.maps.water;
let elapsed = 0;
let lastKind = null;
const macroSequence = [];
const maxedAt = {};
let speedFamiliesMaxedReport = null;

while (elapsed < MAX_MS) {
  applyTick(game, STEP_MS);
  elapsed += STEP_MS;
  greedyBuyEverything(game);

  for (const pathId of UPGRADE_PATH_IDS) {
    if (maxedAt[pathId] === undefined && isMaxed(mapState, mapDef, pathId)) maxedAt[pathId] = elapsed;
  }

  const kind = bottleneckKind(mapState, mapDef);
  if (kind !== lastKind) {
    macroSequence.push({
      atMs: elapsed,
      kind,
      levels: {
        bucket: mapState.producer.bucketLevel,
        movement: mapState.producer.movementLevel,
        winch: mapState.producer.winchLevel,
        well: mapState.producer.wellLevel,
        buffer: mapState.buffer.level,
        transportCapacity: mapState.transport.capacityLevel,
        transportFrequency: mapState.transport.frequencyLevel,
      },
    });
    lastKind = kind;
  }

  const speedMaxed = ["movement", "winch", "well"].every((p) => isMaxed(mapState, mapDef, p));
  if (speedMaxed && speedFamiliesMaxedReport === null) {
    speedFamiliesMaxedReport = {
      atMs: elapsed,
      bucketLevel: mapState.producer.bucketLevel,
      bufferLevel: mapState.buffer.level,
      transportCapacityLevel: mapState.transport.capacityLevel,
      transportFrequencyLevel: mapState.transport.frequencyLevel,
      bottleneckKind: kind,
      citerneMaxed: isMaxed(mapState, mapDef, "transportCapacity"),
    };
  }
}

console.log("\n=== HAVEN V3 — simulation de l'alternance des goulots d'étranglement ===\n");
console.log("Cas de régression V2 (bêta humaine) : au moment où déplacement/corde-treuil/puits sont");
console.log("TOUS au niveau maximum, le diagnostic du jeu ne doit plus jamais être resté bloqué sur");
console.log("« production » sans que stockage/citerne aient eu une chance réelle de compter.\n");

if (speedFamiliesMaxedReport) {
  const r = speedFamiliesMaxedReport;
  console.log(`Etat au moment où les 3 familles de vitesse sont maxées (t=${formatDuration(r.atMs)}) :`);
  console.log(`  seau niveau ${r.bucketLevel}, stockage niveau ${r.bufferLevel}, citerne niveau ${r.transportCapacityLevel}, fréquence niveau ${r.transportFrequencyLevel}`);
  console.log(`  goulot actuel : ${r.bottleneckKind}`);
  console.log(`  citerne déjà épuisée à ce moment : ${r.citerneMaxed}`);
} else {
  console.log("Les 3 familles de vitesse ne maxent jamais sous 3h.");
}

console.log(`\nSéquence macro des goulots (${macroSequence.length} changements) :`);
for (const t of macroSequence.slice(0, 20)) {
  console.log(`  t=${formatDuration(t.atMs)} -> ${t.kind}`);
}
if (macroSequence.length > 20) console.log(`  ... (${macroSequence.length - 20} de plus, voir le JSON complet)`);

console.log("\nNiveau maximum atteint (temps) par famille :");
for (const [k, v] of Object.entries(maxedAt)) {
  console.log(`  ${k}: ${formatDuration(v)}`);
}

// Le régime permanent une fois la citerne/le stockage sollicités oscille
// très vite entre "transport" et "storageFull" (un camion qui passe puis
// repart) : on ne garde que les 30 premiers changements pour l'artefact
// écrit sur disque, largement suffisant pour vérifier l'alternance sans
// gonfler ce fichier de milliers d'entrées redondantes.
const output = { speedFamiliesMaxedReport, macroSequence: macroSequence.slice(0, 30), macroSequenceTotalCount: macroSequence.length, maxedAt };
const outPath = join(__dirname, "..", "docs", "haven-v3-bottleneck-simulation-results.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nRésultats écrits dans ${outPath}`);

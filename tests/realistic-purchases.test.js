// V4 (section "ÉQUILIBRAGE" du cahier des charges post-bêta V3) : la bêta
// humaine a signalé qu'un joueur pouvait investir uniquement dans le
// fermier et voir son argent progresser sans jamais ressentir le besoin
// d'améliorer le camion-citerne. `tests/bottleneck.test.js` ne rejoue
// qu'une stratégie gloutonne (achète tout ce qui est affordable, citerne
// comprise) : elle ne peut donc pas révéler ce défaut. Ce fichier rejoue
// une séquence d'achats réellement biaisée (voir
// scripts/simulate-v4-realistic.mjs pour l'exploration complète) et fige
// deux garanties permanentes :
//
// 1. Le message affiché au joueur pendant "storageFull" doit nommer la
//    citerne — cause racine identifiée : le texte précédent ("Stockage
//    plein : le travailleur attend") ne recommandait rien de concret, et
//    un joueur qui l'aurait suivi à la lettre aurait plutôt acheté du
//    stockage (qui ne fait que retarder la saturation, jamais la
//    résoudre).
// 2. Un joueur qui ignore complètement la citerne/fréquence transport
//    (mais continue d'acheter stockage + toutes les familles fermier,
//    rendement de vente compris) doit être RÉELLEMENT freiné : la
//    saturation doit survenir vite (le fermier se bloque), et le débit
//    réel (litres livrés, pas seulement l'argent affiché) doit rester
//    très en retrait par rapport à une partie qui investit aussi dans le
//    transport — sinon rien ne le pousse jamais à s'y intéresser.
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, purchaseMapUpgrade } from "../src/engine/simulation.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { bottleneckKind, BOTTLENECK_TEXT } from "../src/engine/mapEconomy.js";

const STEP_MS = 1000;
const FARMER_PLUS_BUFFER_PATHS = ["bucket", "movement", "winch", "well", "globalProductivity", "buffer"];
const ALL_PATHS = [...FARMER_PLUS_BUFFER_PATHS, "transportCapacity", "transportFrequency"];

function buyAllAffordable(game, mapState, mapDef, pathIds) {
  let again = true;
  while (again) {
    again = false;
    for (const pathId of pathIds) {
      if (purchaseMapUpgrade(game, mapState, mapDef, pathId).ok) again = true;
    }
  }
}

function runFor(mapId, maxMs, pathIds) {
  const game = createInitialState(0);
  const mapDef = getMapDefinition(mapId);
  const mapState = game.maps[mapId];
  let elapsed = 0;
  let firstStorageFullAt = null;
  while (elapsed < maxMs) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    buyAllAffordable(game, mapState, mapDef, pathIds);
    if (firstStorageFullAt === null && bottleneckKind(mapState, mapDef) === "storageFull") {
      firstStorageFullAt = elapsed;
    }
  }
  return { game, mapState, firstStorageFullAt, totalLitersShipped: mapState.totalLitersShipped };
}

test("le message de « storageFull » nomme explicitement la citerne (jamais seulement « stockage plein »)", () => {
  const { title, desc } = BOTTLENECK_TEXT.storageFull;
  const text = `${title} ${desc}`.toLowerCase();
  assert.ok(text.includes("citerne"), `le message ne mentionne pas la citerne : "${text}"`);
});

test("un joueur qui ignore complètement la citerne/fréquence transport se bloque quand même vite (pression réelle, jamais « jamais »)", () => {
  const MAX_MS = 20 * 60_000;
  const { firstStorageFullAt } = runFor("water", MAX_MS, FARMER_PLUS_BUFFER_PATHS);
  assert.ok(
    firstStorageFullAt !== null,
    `« storageFull » n'est jamais atteint en ${MAX_MS / 60_000} min en ignorant la citerne — le joueur ne ressentirait jamais de pression`
  );
});

test("ignorer la citerne coûte réellement du débit : bien moins de litres livrés qu'une partie qui investit aussi dans le transport, au même instant", () => {
  const CHECK_AT_MS = 60 * 60_000;
  const neglectingTruck = runFor("water", CHECK_AT_MS, FARMER_PLUS_BUFFER_PATHS);
  const investingEverywhere = runFor("water", CHECK_AT_MS, ALL_PATHS);

  assert.ok(
    neglectingTruck.totalLitersShipped < investingEverywhere.totalLitersShipped * 0.5,
    `ignorer la citerne ne coûte presque rien en débit réel (${neglectingTruck.totalLitersShipped} L vs ${investingEverywhere.totalLitersShipped} L) — ` +
      "rien n'inciterait un joueur réel à s'y intéresser"
  );
});

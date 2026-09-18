// Régression V2 (section 2 du cahier des charges) : la bêta Android a
// montré un début trop lent (plusieurs minutes de quasi-spectateur avant
// la première décision). Recalibré via scripts/simulate-v2.mjs, mais un
// test permanent est nécessaire pour empêcher qu'une future recalibration
// ne réintroduise, sans le vouloir, ni un début trop lent, ni (à
// l'inverse) une map qui se termine en quelques minutes de hors-ligne à
// peine — le problème inverse déjà signalé dans le rapport V1.
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, applyOfflineProgress, purchaseMapUpgrade } from "../src/engine/simulation.js";
import { UPGRADE_PATH_IDS } from "../src/engine/mapUpgrades.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { progressRatio } from "../src/engine/mapEconomy.js";

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

test("le premier achat est accessible en 40 secondes ou moins de jeu actif (objectif : 20-40s)", () => {
  const game = createInitialState(0);
  let elapsed = 0;
  let firstPurchaseAt = null;
  const MAX_MS = 60_000;
  while (elapsed < MAX_MS && firstPurchaseAt === null) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    if (greedyBuyEverything(game) > 0) firstPurchaseAt = elapsed;
  }
  assert.ok(firstPurchaseAt !== null, "aucun achat possible dans la première minute de jeu actif");
  assert.ok(firstPurchaseAt <= 40_000, `premier achat à ${firstPurchaseAt}ms, au-delà de l'objectif de 40s`);
});

test("plusieurs décisions (achats) sont possibles dans les 3 premières minutes de jeu actif", () => {
  const game = createInitialState(0);
  let elapsed = 0;
  let totalPurchases = 0;
  const THREE_MIN = 3 * 60_000;
  while (elapsed < THREE_MIN) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    totalPurchases += greedyBuyEverything(game);
  }
  assert.ok(totalPurchases >= 5, `seulement ${totalPurchases} achat(s) en 3 min, "plusieurs" attendu (>= 5)`);
});

test("la map ne se termine jamais en quelques minutes de jeu actif continu (progression globale non raccourcie)", () => {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  let elapsed = 0;
  const THREE_HOURS = 3 * 3600_000;
  while (elapsed < THREE_HOURS) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    greedyBuyEverything(game);
  }
  assert.ok(
    progressRatio(mapState, mapDef) < 1,
    "la map 1 est déjà complète après seulement 3h de jeu actif continu sans aucune fermeture d'app : trop court"
  );
});

// Profils réalistes (session courte + hors-ligne plafonné entre les deux,
// jamais un tick continu déguisé) : sert de garde-fou contre un
// raccourcissement accidentel de la durée totale par rapport à la V1, où
// elle était déjà jugée trop courte (7-30 min actives selon le profil).
function runSessionProfile({ sessionsPerDay, sessionMinutes }) {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  let elapsed = 0;
  const gapMs = (24 * 3600 * 1000) / sessionsPerDay;
  const sessionMs = sessionMinutes * 60 * 1000;
  const MAX_MS = 20 * 24 * 3600 * 1000;
  let activeMs = 0;
  let mapCompleteActiveMs = null;

  while (elapsed < MAX_MS) {
    if (elapsed > 0) {
      applyOfflineProgress(game, gapMs - sessionMs);
      elapsed += gapMs - sessionMs;
      if (mapCompleteActiveMs === null && progressRatio(mapState, mapDef) >= 1) mapCompleteActiveMs = activeMs;
      if (mapCompleteActiveMs !== null) break;
    }
    let sessionElapsed = 0;
    while (sessionElapsed < sessionMs) {
      applyTick(game, STEP_MS);
      greedyBuyEverything(game);
      sessionElapsed += STEP_MS;
      activeMs += STEP_MS;
      if (mapCompleteActiveMs === null && progressRatio(mapState, mapDef) >= 1) mapCompleteActiveMs = activeMs;
    }
    elapsed += sessionMs;
    if (mapCompleteActiveMs !== null) break;
  }
  return mapCompleteActiveMs;
}

test("profil léger (2 sessions/jour de 1 min) : au moins 5 min de jeu actif cumulé avant Map 1 complète (référence V1 : 7 min)", () => {
  const activeMs = runSessionProfile({ sessionsPerDay: 2, sessionMinutes: 1 });
  assert.ok(activeMs !== null, "map jamais complétée sous 20 jours");
  assert.ok(activeMs >= 5 * 60_000, `seulement ${activeMs}ms de jeu actif, en dessous du plancher de non-régression`);
});

test("profil assidu (5 sessions/jour de 5 min) : au moins 20 min de jeu actif cumulé avant Map 1 complète (référence V1 : 30 min)", () => {
  const activeMs = runSessionProfile({ sessionsPerDay: 5, sessionMinutes: 5 });
  assert.ok(activeMs !== null, "map jamais complétée sous 20 jours");
  assert.ok(activeMs >= 20 * 60_000, `seulement ${activeMs}ms de jeu actif, en dessous du plancher de non-régression`);
});

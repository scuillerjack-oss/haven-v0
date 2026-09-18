// Régression V3 (cahier des charges post-bêta V2, section 2) : la bêta
// humaine a montré un déséquilibre structurel — déplacement/corde-treuil/
// puits atteignaient déjà leur niveau maximum, seau vers le niveau 7,
// pendant que stockage et citerne pouvaient rester au niveau 1 SANS jamais
// devenir limitants. Le diagnostic du jeu indiquait alors en permanence
// « La production limite le débit » : aucune raison économique réelle
// d'investir dans l'infrastructure aval. Ce fichier fige, avec le vrai
// moteur, le cas de régression exact et l'alternance de goulots attendue.
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, purchaseMapUpgrade } from "../src/engine/simulation.js";
import { UPGRADE_PATH_IDS, nextUpgradeInfo } from "../src/engine/mapUpgrades.js";
import { getMapDefinition } from "../src/engine/mapDefinitions.js";
import { bottleneckKind } from "../src/engine/mapEconomy.js";

const STEP_MS = 1000;

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

// Rejoue une partie réaliste (achat de tout ce qui est affordable, comme
// un joueur assidu) et enregistre, à chaque instant où les 3 familles de
// vitesse du travailleur (déplacement/corde-treuil/puits) sont TOUTES au
// niveau maximum pour la première fois, l'état complet de la chaîne.
function replayUntilAllSpeedFamiliesMaxed(maxMs) {
  const game = createInitialState(0);
  const mapDef = getMapDefinition("water");
  const mapState = game.maps.water;
  let elapsed = 0;
  const kindsSeen = new Set();
  const macroSequence = [];
  let lastKind = null;

  while (elapsed < maxMs) {
    applyTick(game, STEP_MS);
    elapsed += STEP_MS;
    greedyBuyEverything(game);
    const kind = bottleneckKind(mapState, mapDef);
    kindsSeen.add(kind);
    if (kind !== lastKind) {
      macroSequence.push(kind);
      lastKind = kind;
    }
    const speedMaxed = ["movement", "winch", "well"].every((p) => isMaxed(mapState, mapDef, p));
    if (speedMaxed) {
      return {
        atMs: elapsed,
        bucketLevel: mapState.producer.bucketLevel,
        bufferLevel: mapState.buffer.level,
        transportCapacityLevel: mapState.transport.capacityLevel,
        transportFrequencyLevel: mapState.transport.frequencyLevel,
        kindAtThatMoment: kind,
        citerneHasLevelsLeft: !isMaxed(mapState, mapDef, "transportCapacity"),
        kindsSeen,
        macroSequence,
        game,
        mapState,
        mapDef,
        elapsedSoFar: elapsed,
      };
    }
  }
  return null;
}

test("cas de régression exact : quand déplacement+corde/treuil+puits sont TOUS au maximum, le goulot n'est plus « production » (stockage/citerne doivent déjà compter)", () => {
  const state = replayUntilAllSpeedFamiliesMaxed(3 * 3600_000);
  assert.ok(state !== null, "les 3 familles de vitesse ne maxent jamais sous 3h — calibration à revoir");
  assert.notEqual(
    state.kindAtThatMoment,
    "production",
    `régression : au moment où mouvement/corde/puits sont tous maxés (bucket niveau ${state.bucketLevel}), ` +
      `le goulot est encore "production" — stockage (niveau ${state.bufferLevel}) et citerne ` +
      `(niveau ${state.transportCapacityLevel}) restent non pertinents, exactement le défaut signalé par la bêta.`
  );
});

test("la citerne (transportCapacity) a encore des niveaux réellement achetables au moment où elle devient pertinente (jamais épuisée avant d'avoir servi)", () => {
  const state = replayUntilAllSpeedFamiliesMaxed(3 * 3600_000);
  assert.ok(state !== null);
  assert.ok(
    state.citerneHasLevelsLeft,
    "la citerne est déjà à son niveau maximum au moment où mouvement/corde/puits maxent — " +
      "aucune décision réelle ne reste possible sur cet axe quand il devient enfin pertinent"
  );
});

test("une vraie alternance de goulots se produit pendant la partie (jamais un seul état figé du début à la fin)", () => {
  const state = replayUntilAllSpeedFamiliesMaxed(3 * 3600_000);
  assert.ok(state !== null);
  // On continue de rejouer un peu au-delà de ce premier jalon pour laisser
  // le temps à un second changement de maillon limitant de se produire.
  let elapsed = state.elapsedSoFar;
  const kindsSeen = state.kindsSeen;
  const macroSequence = state.macroSequence;
  let lastKind = macroSequence[macroSequence.length - 1];
  const EXTRA_MS = 90 * 60_000;
  const deadline = elapsed + EXTRA_MS;
  while (elapsed < deadline) {
    applyTick(state.game, STEP_MS);
    elapsed += STEP_MS;
    greedyBuyEverything(state.game);
    const kind = bottleneckKind(state.mapState, state.mapDef);
    kindsSeen.add(kind);
    if (kind !== lastKind) {
      macroSequence.push(kind);
      lastKind = kind;
    }
  }
  assert.ok(kindsSeen.has("production"), "« production » n'a jamais été le goulot — improbable, à vérifier");
  assert.ok(
    kindsSeen.has("transport") || kindsSeen.has("storageFull"),
    "le goulot ne bascule jamais vers le transport/stockage sur toute la partie : stockage et citerne restent inutiles"
  );
  // Au moins un aller-retour lisible (pas seulement un unique verrou final) :
  // la séquence macro doit contenir "production" à nouveau APRÈS un premier
  // passage par un état non-production, preuve d'une vraie alternance.
  const firstNonProduction = macroSequence.findIndex((k) => k !== "production");
  const returnsToProduction = firstNonProduction >= 0 && macroSequence.slice(firstNonProduction + 1).includes("production");
  assert.ok(
    returnsToProduction,
    `séquence macro observée : ${JSON.stringify(macroSequence.slice(0, 20))}... — pas d'alternance lisible, seulement un verrouillage final`
  );
});

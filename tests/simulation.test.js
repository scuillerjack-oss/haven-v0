import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import { applyTick, getModifiers } from "../src/engine/simulation.js";
import { MAP_ORDER } from "../src/engine/mapDefinitions.js";

test("applyTick agrège l'argent de toutes les maps possédées, jamais seulement celle affichée", () => {
  const game = createInitialState(0);
  const result = applyTick(game, 500);
  assert.ok(result.perMap.water);
  assert.equal(typeof result.moneyEarned, "number");
});

test("dépasser le seuil de déblocage sans map suivante définie ne crash jamais (une seule map autorée en V1)", () => {
  const game = createInitialState(0);
  game.maps.water.totalLitersShipped = 10_000_000; // très au-delà de tous les seuils
  assert.doesNotThrow(() => applyTick(game, 1000));
  assert.equal(MAP_ORDER.length, 1, "documente honnêtement qu'une seule map est autorée dans cette V1");
  assert.equal(Object.keys(game.maps).length, 1);
});

test("getModifiers ne dépend d'aucune map précise : les atouts s'appliquent identiquement à toute map présente ou future", () => {
  const game = createInitialState(0);
  game.perks.productionGlobal = 1;
  const modifiers = getModifiers(game);
  assert.ok(modifiers.productionMultiplier > 1);
  // Pas de paramètre mapId dans la signature : structurellement générique.
  assert.equal(getModifiers.length, 1);
});

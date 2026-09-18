import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import {
  purchasePerk,
  perlesEarnable,
  canRenaissance,
  performRenaissance,
  RENAISSANCE_MIN_PERLES,
} from "../src/engine/simulation.js";
import { PERKS } from "../src/engine/meta.js";

test("un atout refuse si les Perles manquent, accepte sinon, débite le coût exact", () => {
  const game = createInitialState(0);
  const cost = PERKS.productionGlobal.levels[0].cost;
  game.perles = cost - 1;
  assert.equal(purchasePerk(game, "productionGlobal").ok, false);
  game.perles = cost;
  const result = purchasePerk(game, "productionGlobal");
  assert.equal(result.ok, true);
  assert.equal(game.perles, 0);
  assert.equal(game.perks.productionGlobal, 1);
});

test("perlesEarnable croît avec l'argent gagné dans la run, jamais négatif", () => {
  const game = createInitialState(0);
  assert.equal(perlesEarnable(game), 0);
  game.totalMoneyEarnedThisRun = 10_000;
  assert.ok(perlesEarnable(game) > 0);
});

test("la Renaissance est refusée sous le seuil minimal de Perles", () => {
  const game = createInitialState(0);
  game.totalMoneyEarnedThisRun = 1; // perlesEarnable proche de 0
  assert.equal(canRenaissance(game), false);
  const result = performRenaissance(game);
  assert.equal(result.ok, false);
});

test("la Renaissance réinitialise la progression de run mais conserve Perles/atouts/tutoriels/audio", () => {
  const game = createInitialState(0);
  // assez d'argent gagné pour dépasser le seuil minimal de Perles
  game.totalMoneyEarnedThisRun = RENAISSANCE_MIN_PERLES ** 2 + 100;
  game.maps.water.totalLitersShipped = 5000;
  game.maps.water.producer.bucketLevel = 3;
  game.money = 12345;
  game.audio.volume = 0.42;
  game.tutorial.seen.firstUpgrade = true;
  game.perks.productionGlobal = 1;

  const before = perlesEarnable(game);
  const result = performRenaissance(game);
  assert.equal(result.ok, true);
  assert.equal(result.earned, before);

  assert.equal(game.perles, before);
  assert.equal(game.money, 0);
  assert.equal(game.totalMoneyEarnedThisRun, 0);
  assert.equal(game.maps.water.totalLitersShipped, 0);
  assert.equal(game.maps.water.producer.bucketLevel, 1);
  assert.equal(game.prestigeCount, 1);
  // conservé :
  assert.equal(game.audio.volume, 0.42);
  assert.equal(game.tutorial.seen.firstUpgrade, true);
  assert.equal(game.perks.productionGlobal, 1);
});

test("chaque Renaissance ultérieure ajoute son propre bonus de production (le run suivant va plus vite)", async () => {
  const { getModifiers } = await import("../src/engine/simulation.js");
  const game = createInitialState(0);
  const before = getModifiers(game).productionMultiplier;
  game.totalMoneyEarnedThisRun = RENAISSANCE_MIN_PERLES ** 2 + 100;
  performRenaissance(game);
  const after = getModifiers(game).productionMultiplier;
  assert.ok(after > before);
});

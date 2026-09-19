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
import { PERKS, perkEffect, perkValue } from "../src/engine/meta.js";
import { offlineCapHours, offlineEfficiency, BASE_OFFLINE_CAP_HOURS, BASE_OFFLINE_EFFICIENCY } from "../src/engine/balance.js";
import { getModifiers } from "../src/engine/simulation.js";
import { formatUpgradeEffect } from "../src/ui/format.js";

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

test("un atout au niveau maximum refuse un nouvel achat", () => {
  const game = createInitialState(0);
  game.perles = 999999;
  for (let i = 0; i < PERKS.offlineEfficiency.levels.length + 2; i += 1) {
    purchasePerk(game, "offlineEfficiency");
  }
  const maxLevel = PERKS.offlineEfficiency.levels.at(-1).level;
  assert.equal(game.perks.offlineEfficiency, maxLevel);
  const result = purchasePerk(game, "offlineEfficiency");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "max");
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

// V4 (section "ATOUTS / PERLES" du cahier des charges post-bêta V3) : plus
// aucun texte d'atout ne doit contenir un pourcentage littéral non résolu
// ("+X %") — la grandeur réelle vient de perkEffect(), jamais d'un texte
// statique.
test("aucune description d'atout ne contient un pourcentage littéral non résolu", () => {
  for (const [id, def] of Object.entries(PERKS)) {
    assert.doesNotMatch(def.description, /\bX\s*%/i, `${id} contient encore un "X %" littéral`);
  }
});

test("« Vitesse des cycles » est retiré (une accélération globale aggravait le déséquilibre production/transport)", () => {
  assert.equal("cycleSpeed" in PERKS, false);
});

test("« Cap hors-ligne » n'a plus qu'un seul palier généreux (les paliers supplémentaires n'avaient aucune utilité perceptible)", () => {
  assert.equal(PERKS.offlineCap.levels.length, 1);
});

// La grandeur affichée par perkEffect() doit être la VRAIE valeur que le
// moteur applique, jamais une approximation recalculée côté UI (même
// exigence que pour upgradeEffect(), voir tests/upgrades.test.js).
test("perkEffect() reflète exactement ce que le moteur applique pour chaque atout", () => {
  for (const perkId of Object.keys(PERKS)) {
    const game = createInitialState(0);
    game.perles = 999_999;
    const beforeValue = perkValue(game, perkId);
    const nextLevel = PERKS[perkId].levels[0];
    const effect = perkEffect(perkId, beforeValue, nextLevel.value);
    assert.ok(effect, `${perkId} devrait produire un affichage d'effet`);

    purchasePerk(game, perkId);

    if (perkId === "productionGlobal") {
      assert.ok(Math.abs(effect.next / 100 - (getModifiers(game).productionMultiplier - 1)) < 1e-9);
    } else if (perkId === "storageGlobal") {
      assert.ok(Math.abs(effect.next / 100 - (getModifiers(game).storageMultiplier - 1)) < 1e-9);
    } else if (perkId === "logistics") {
      assert.ok(Math.abs(-effect.next / 100 - (1 - getModifiers(game).logisticsMultiplier)) < 1e-9);
      assert.ok(effect.next <= 0, "une réduction de délai doit s'afficher négative, jamais « +X % »");
    } else if (perkId === "upgradeCostReduction") {
      assert.ok(Math.abs(-effect.next / 100 - perkValue(game, "upgradeCostReduction")) < 1e-9);
      assert.ok(effect.next <= 0, "une réduction de coût doit s'afficher négative, jamais « +X % »");
    } else if (perkId === "offlineEfficiency") {
      assert.ok(Math.abs(effect.next / 100 - offlineEfficiency(game, perkValue)) < 1e-9);
    } else if (perkId === "offlineCap") {
      assert.equal(effect.next, offlineCapHours(game, perkValue));
      assert.equal(effect.current, BASE_OFFLINE_CAP_HOURS);
    } else if (perkId === "perleGain") {
      assert.equal(effect.next, nextLevel.value * 100);
    }

    // Jamais un texte cassé (double signe, "NaN", unité manquante).
    const text = formatUpgradeEffect(effect);
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /\+-|-\+|NaN/);
  }
});

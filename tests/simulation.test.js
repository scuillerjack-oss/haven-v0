import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import {
  applyTick,
  applyTap,
  purchaseProductionUpgrade,
  purchaseGlobalUpgrade,
  productionPerSecond,
  tapValue,
  isProductionUnlocked,
  crossedStages,
} from "../src/engine/simulation.js";
import { PRODUCTIONS, GLOBAL_UPGRADES, STAGES } from "../src/engine/balance.js";

test("la source produit dès le début (automatisation précoce)", () => {
  const state = createInitialState(0);
  assert.ok(productionPerSecond(state) > 0);
});

test("un tick fait avancer vitality et totalGrowth ensemble", () => {
  const state = createInitialState(0);
  const before = productionPerSecond(state);
  applyTick(state, 4000, 4000);
  assert.ok(state.vitality > 0);
  assert.equal(state.vitality, state.totalGrowth);
  assert.ok(Math.abs(state.vitality - before * 4) < 1e-9);
});

test("tap ajoute une valeur immédiate et compte le nombre de taps", () => {
  const state = createInitialState(0);
  const { gained } = applyTap(state, 100);
  assert.equal(gained, tapValue(state));
  assert.equal(state.stats.totalTaps, 1);
  assert.equal(state.vitality, gained);
});

test("une production verrouillée ne peut pas être achetée", () => {
  const state = createInitialState(0);
  state.vitality = 1_000_000;
  assert.equal(isProductionUnlocked(state, "flora"), false);
  const result = purchaseProductionUpgrade(state, "flora");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "locked");
});

test("achat production : refuse si pas assez de vitality, accepte sinon, débite le coût exact", () => {
  const state = createInitialState(0);
  state.totalGrowth = PRODUCTIONS.soil.unlockAt; // débloque le sol
  state.vitality = 5;
  const tooExpensive = purchaseProductionUpgrade(state, "soil");
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.reason, "cannot_afford");

  const cost = PRODUCTIONS.soil.levels[0].cost;
  state.vitality = cost;
  const ok = purchaseProductionUpgrade(state, "soil");
  assert.equal(ok.ok, true);
  assert.equal(state.vitality, 0);
  assert.equal(state.productions.soil.level, 1);
});

test("une production au niveau maximum refuse un nouvel achat", () => {
  const state = createInitialState(0);
  state.totalGrowth = 999999;
  state.vitality = 999999;
  const def = PRODUCTIONS.source;
  // monte au niveau max
  for (let i = 0; i < def.levels.length + 2; i += 1) {
    purchaseProductionUpgrade(state, "source");
  }
  assert.equal(state.productions.source.level, def.levels[def.levels.length - 1].level);
  const result = purchaseProductionUpgrade(state, "source");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "max");
});

test("amélioration globale : verrouillée puis achetable une seule fois", () => {
  const state = createInitialState(0);
  const def = GLOBAL_UPGRADES.meditationPath;
  const lockedAttempt = purchaseGlobalUpgrade(state, "meditationPath");
  assert.equal(lockedAttempt.reason, "locked");

  state.totalGrowth = def.unlockAt;
  state.vitality = def.cost;
  const first = purchaseGlobalUpgrade(state, "meditationPath");
  assert.equal(first.ok, true);
  assert.equal(state.vitality, 0);

  state.vitality = def.cost;
  const second = purchaseGlobalUpgrade(state, "meditationPath");
  assert.equal(second.ok, false);
  assert.equal(second.reason, "already_owned");
});

test("le sentier de méditation multiplie bien la valeur du tap", () => {
  const state = createInitialState(0);
  const before = tapValue(state);
  state.globalUpgrades.meditationPath = true;
  const after = tapValue(state);
  assert.equal(after, before * GLOBAL_UPGRADES.meditationPath.tapMultiplier);
});

test("crossedStages détecte chaque palier traversé, y compris plusieurs d'un coup", () => {
  const single = crossedStages(0, STAGES[1].threshold);
  assert.deepEqual(single.map((s) => s), [1]);

  const bigJump = STAGES[3].threshold;
  const jump = crossedStages(0, bigJump);
  const expected = STAGES.filter((s) => s.threshold > 0 && s.threshold <= bigJump).map((s) => s.id);
  assert.deepEqual(jump, expected);

  const none = crossedStages(20, 25);
  assert.deepEqual(none, []);
});

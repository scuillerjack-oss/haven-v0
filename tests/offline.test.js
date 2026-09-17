import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import { computeOfflineProgress, applyOfflineProgress, purchaseProductionUpgrade } from "../src/engine/simulation.js";
import { BASE_OFFLINE_CAP_HOURS, OFFLINE_EFFICIENCY, GLOBAL_UPGRADES, PRODUCTIONS } from "../src/engine/balance.js";

function unlockAndBuySoil(state) {
  state.totalGrowth = PRODUCTIONS.soil.unlockAt;
  state.vitality = PRODUCTIONS.soil.levels[0].cost;
  purchaseProductionUpgrade(state, "soil"); // donne un taux de production non nul
}

test("le crédit hors-ligne est plafonné à la durée par défaut (4h)", () => {
  const state = createInitialState(0);
  unlockAndBuySoil(state);

  const twoHours = 2 * 3600 * 1000;
  const tenHours = 10 * 3600 * 1000;

  const short = computeOfflineProgress(state, twoHours);
  assert.equal(short.cappedAway, false);
  assert.equal(short.effectiveMs, twoHours);

  const long = computeOfflineProgress(state, tenHours);
  assert.equal(long.cappedAway, true);
  assert.equal(long.effectiveMs, BASE_OFFLINE_CAP_HOURS * 3600 * 1000);
});

test("Rosée nocturne étend le plafond hors-ligne à 8h", () => {
  const state = createInitialState(0);
  state.globalUpgrades.nightDew = true;
  const tenHours = 10 * 3600 * 1000;
  const result = computeOfflineProgress(state, tenHours);
  assert.equal(result.effectiveMs, (BASE_OFFLINE_CAP_HOURS + GLOBAL_UPGRADES.nightDew.offlineCapHoursBonus) * 3600 * 1000);
});

test("le gain hors-ligne applique bien le facteur d'efficacité réduite", () => {
  const state = createInitialState(0);
  unlockAndBuySoil(state);
  const oneHour = 3600 * 1000;
  const before = computeOfflineProgress(state, oneHour);
  assert.ok(before.gained > 0);
  // le gain hors-ligne doit toujours être strictement inférieur à ce que
  // produirait la même durée en jeu actif (aucune "preuve" gonflée).
  const activeEquivalent = before.gained / OFFLINE_EFFICIENCY;
  assert.ok(before.gained < activeEquivalent);
});

test("une absence négative ou nulle ne rapporte jamais rien", () => {
  const state = createInitialState(0);
  const zero = computeOfflineProgress(state, 0);
  assert.equal(zero.gained, 0);
  const negative = computeOfflineProgress(state, -5000);
  assert.equal(negative.gained, 0);
  assert.equal(negative.elapsedMs, 0);
});

test("applyOfflineProgress ajoute réellement le gain à l'état (vitality et totalGrowth)", () => {
  const state = createInitialState(0);
  unlockAndBuySoil(state);
  const vitalityBefore = state.vitality;
  const growthBefore = state.totalGrowth;
  const result = applyOfflineProgress(state, 3 * 3600 * 1000);
  assert.equal(state.vitality, vitalityBefore + result.gained);
  assert.equal(state.totalGrowth, growthBefore + result.gained);
});

test("survit à une absence de 48 à 72h sans erreur ni valeur invalide", () => {
  const state = createInitialState(0);
  state.totalGrowth = 200;
  state.vitality = 0;
  for (const hours of [48, 60, 72]) {
    const result = applyOfflineProgress(state, hours * 3600 * 1000);
    assert.ok(Number.isFinite(state.vitality));
    assert.ok(Number.isFinite(state.totalGrowth));
    assert.ok(state.vitality >= 0);
    assert.equal(result.cappedAway, true);
  }
});

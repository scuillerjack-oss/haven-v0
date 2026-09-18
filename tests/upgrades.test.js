import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, createMapState } from "../src/engine/state.js";
import { WATER_MAP } from "../src/engine/mapDefinitions.js";
import { purchaseMapUpgrade, nextUpgradeInfo, upgradeEffect, UPGRADE_PATH_IDS } from "../src/engine/mapUpgrades.js";
import {
  producerBucketLiters,
  bufferCapacity,
  transportCapacity,
  transportIntervalMs,
  producerPhaseDurations,
} from "../src/engine/mapEconomy.js";

test("un achat refuse si l'argent manque, accepte sinon, débite le coût exact", () => {
  const game = createInitialState(0);
  const map = game.maps.water;
  const info = nextUpgradeInfo(map, WATER_MAP, "bucket");
  game.money = info.next.cost - 1;
  const tooExpensive = purchaseMapUpgrade(game, map, WATER_MAP, "bucket");
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.reason, "cannot_afford");

  game.money = info.next.cost;
  const ok = purchaseMapUpgrade(game, map, WATER_MAP, "bucket");
  assert.equal(ok.ok, true);
  assert.equal(game.money, 0);
  assert.equal(map.producer.bucketLevel, info.next.level);
});

test("une amélioration au niveau maximum refuse un nouvel achat", () => {
  const game = createInitialState(0);
  const map = game.maps.water;
  game.money = 999999;
  for (let i = 0; i < WATER_MAP.producerUpgrades.bucket.levels.length + 2; i += 1) {
    purchaseMapUpgrade(game, map, WATER_MAP, "bucket");
  }
  const maxLevel = WATER_MAP.producerUpgrades.bucket.levels.at(-1).level;
  assert.equal(map.producer.bucketLevel, maxLevel);
  const result = purchaseMapUpgrade(game, map, WATER_MAP, "bucket");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "max");
});

test("l'atout de réduction de coût réduit bien le prix réellement débité", () => {
  const game = createInitialState(0);
  const map = game.maps.water;
  const info = nextUpgradeInfo(map, WATER_MAP, "movement");

  game.perks.upgradeCostReduction = 1; // niveau 1 : -10% (voir meta.js)
  game.money = info.next.cost; // le plein tarif ne devrait pas être nécessaire
  const result = purchaseMapUpgrade(game, map, WATER_MAP, "movement");
  assert.equal(result.ok, true);
  assert.ok(game.money > 0, "le coût réduit doit être strictement inférieur au tarif plein");
  assert.ok(Math.abs(game.money - info.next.cost * 0.1) < 1e-9, "arrondi flottant toléré, pas la valeur");
});

test("chaque famille d'amélioration a un effet distinct sur le cycle ou la capacité", () => {
  const families = ["bucket", "movement", "winch", "well"];
  for (const family of families) {
    const map = createMapState();
    const game = createInitialState(0);
    game.money = 999999;
    const before = JSON.stringify(map);
    purchaseMapUpgrade(game, map, WATER_MAP, family);
    assert.notEqual(JSON.stringify(map), before, `${family} devrait changer l'état`);
  }
});

// Section 3 du cahier des charges V2 : jamais un pourcentage abstrait seul
// quand une grandeur concrète est disponible — et cette grandeur doit être
// la VRAIE valeur du moteur, pas une approximation recalculée côté UI.
test("la grandeur affichée par upgradeEffect() correspond exactement à ce que le moteur applique réellement", () => {
  for (const pathId of UPGRADE_PATH_IDS) {
    const map = createMapState();
    const info = nextUpgradeInfo(map, WATER_MAP, pathId);
    const effect = upgradeEffect(WATER_MAP, pathId, info.current, info.next);
    assert.ok(effect, `${pathId} devrait produire un affichage d'effet`);

    // On achète réellement le niveau suivant et on relit la grandeur au
    // moteur, plutôt que de faire confiance à une formule dupliquée.
    const game = createInitialState(0);
    game.money = 999_999;
    purchaseMapUpgrade(game, map, WATER_MAP, pathId);

    if (pathId === "bucket") {
      assert.equal(effect.current, 1); // seau niveau 1 : 1 L/trajet (baseValue)
      assert.equal(effect.next, producerBucketLiters(map, WATER_MAP));
    } else if (pathId === "buffer") {
      assert.equal(effect.next, bufferCapacity(map, WATER_MAP));
    } else if (pathId === "transportCapacity") {
      assert.equal(effect.next, transportCapacity(map, WATER_MAP));
    } else if (pathId === "transportFrequency") {
      assert.equal(effect.next * 1000, transportIntervalMs(map, WATER_MAP));
    } else if (pathId === "movement" || pathId === "winch" || pathId === "well") {
      const phaseKey = { movement: "walkToWell", winch: "lowerBucket", well: "wellFill" }[pathId];
      const durations = producerPhaseDurations(map, WATER_MAP);
      const real = durations.find((p) => p.key === phaseKey).durationMs;
      assert.ok(Math.abs(effect.next * 1000 - real) < 1e-6);
    } else if (pathId === "globalProductivity") {
      // Grandeur concrète (argent par litre vendu), jamais un pourcentage
      // abstrait : voir mapEconomy.js, ce multiplicateur ne fait circuler
      // aucun litre de plus, il augmente seulement le prix réellement payé.
      assert.equal(map.globalProductivityLevel, info.next.level);
      assert.ok(Math.abs(effect.next - WATER_MAP.pricePerLiter * info.next.multiplier) < 1e-9);
    }
  }
});

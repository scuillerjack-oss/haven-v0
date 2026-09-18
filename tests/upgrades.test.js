import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, createMapState } from "../src/engine/state.js";
import { WATER_MAP } from "../src/engine/mapDefinitions.js";
import { purchaseMapUpgrade, nextUpgradeInfo } from "../src/engine/mapUpgrades.js";

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
  assert.equal(game.money, info.next.cost * 0.1);
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

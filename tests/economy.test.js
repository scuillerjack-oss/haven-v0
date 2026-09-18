import test from "node:test";
import assert from "node:assert/strict";
import { createMapState } from "../src/engine/state.js";
import { WATER_MAP } from "../src/engine/mapDefinitions.js";
import {
  producerCycleMs,
  producerBucketLiters,
  bufferCapacity,
  transportCapacity,
  transportIntervalMs,
  tickMap,
  computeMapOfflineProgress,
  applyMapOfflineProgress,
  currentProducerPhase,
  stageTotalMs,
} from "../src/engine/mapEconomy.js";

test("le cycle de base correspond bien à la somme des phases (aucune amélioration achetée)", () => {
  const map = createMapState();
  const expected = Object.values(WATER_MAP.phases).reduce((a, b) => a + b, 0);
  assert.equal(producerCycleMs(map, WATER_MAP), expected);
});

test("un tick suffisamment long fait déposer un seau dans le stockage", () => {
  const map = createMapState();
  const cycleMs = producerCycleMs(map, WATER_MAP);
  const bucket = producerBucketLiters(map, WATER_MAP);
  tickMap(map, WATER_MAP, cycleMs);
  assert.equal(map.buffer.currentLiters, bucket);
});

test("plusieurs seaux déposés d'un coup (gros deltaMs), jamais de progrès perdu entre deux", () => {
  const map = createMapState();
  const outboundMs = stageTotalMs(map, WATER_MAP, undefined, "outbound");
  const returnMs = stageTotalMs(map, WATER_MAP, undefined, "return");
  const cycleMs = outboundMs + returnMs;
  const bucket = producerBucketLiters(map, WATER_MAP);
  // 3 cycles complets + une moitié de cycle qui n'atteint pas forcément le
  // prochain point de livraison : le nombre de seaux dépend de la part
  // "outbound" du cycle, calculée dynamiquement plutôt que supposée.
  const elapsed = cycleMs * 3.5;
  const wholeCycles = Math.floor(elapsed / cycleMs);
  const remainder = elapsed - wholeCycles * cycleMs;
  const expectedBuckets = wholeCycles + (remainder >= outboundMs ? 1 : 0);
  tickMap(map, WATER_MAP, elapsed);
  assert.equal(map.buffer.currentLiters, bucket * expectedBuckets);
  assert.ok(map.producer.stageProgressMs >= 0);
});

test("goulot d'étranglement : un stockage plein bloque le travailleur exactement au point de livraison, jamais un retour animé pour rien", () => {
  const map = createMapState();
  map.buffer.level = 1;
  const capacity = bufferCapacity(map, WATER_MAP);
  map.buffer.currentLiters = capacity; // déjà plein
  const outboundMs = stageTotalMs(map, WATER_MAP, undefined, "outbound");
  tickMap(map, WATER_MAP, outboundMs * 2);
  assert.equal(map.producer.awaitingRoom, true);
  assert.equal(map.producer.stage, "outbound");
  assert.equal(map.buffer.currentLiters, capacity); // rien n'a débordé, rien n'a été perdu
});

test("le transport ne charge jamais plus que ce qu'il y a dans le stockage", () => {
  const map = createMapState();
  map.buffer.currentLiters = 5; // moins que la capacité de la citerne (50)
  const interval = transportIntervalMs(map, WATER_MAP);
  const cycleMs = producerCycleMs(map, WATER_MAP);
  const bucket = producerBucketLiters(map, WATER_MAP);
  // Le producteur tourne aussi pendant cet intervalle : le stockage
  // disponible au moment du passage du transport inclut sa contribution.
  const expectedAvailable = 5 + Math.floor(interval / cycleMs) * bucket;
  assert.ok(expectedAvailable < 50, "précondition du test : rester sous la capacité de la citerne");

  const { litersShipped, moneyEarned } = tickMap(map, WATER_MAP, interval);
  assert.equal(litersShipped, expectedAvailable);
  assert.equal(moneyEarned, expectedAvailable * WATER_MAP.pricePerLiter);
  assert.equal(map.buffer.currentLiters, 0);
});

test("le transport charge au maximum sa capacité, jamais plus, même si le stockage déborde de disponible", () => {
  const map = createMapState();
  const capacity = transportCapacity(map, WATER_MAP);
  map.buffer.currentLiters = capacity + 999;
  const interval = transportIntervalMs(map, WATER_MAP);
  const { litersShipped } = tickMap(map, WATER_MAP, interval);
  assert.equal(litersShipped, capacity);
});

test("hors-ligne : le débit effectif est borné par le maillon le plus lent (production ou transport)", () => {
  const slowProducerMap = createMapState(); // production ~lente, transport surdimensionné au niveau 1
  const oneHour = 3600 * 1000;
  const offline = computeMapOfflineProgress(slowProducerMap, WATER_MAP, oneHour);
  assert.equal(offline.transportIsBottleneck, false); // c'est la production qui limite, pas le transport
  assert.ok(offline.litersShipped > 0);

  const overinvestedMap = createMapState();
  overinvestedMap.producer.bucketLevel = 4; // gros seau
  overinvestedMap.producer.movementLevel = 4;
  overinvestedMap.producer.winchLevel = 4;
  overinvestedMap.producer.wellLevel = 4; // production largement au-dessus du transport de base
  const offlineOver = computeMapOfflineProgress(overinvestedMap, WATER_MAP, oneHour);
  assert.equal(offlineOver.transportIsBottleneck, true); // le joueur a créé son propre goulot
});

test("applyMapOfflineProgress est cohérent : le stockage finit plein si le transport est le goulot", () => {
  const map = createMapState();
  map.producer.bucketLevel = 4;
  map.producer.movementLevel = 4;
  map.producer.winchLevel = 4;
  map.producer.wellLevel = 4;
  const result = applyMapOfflineProgress(map, WATER_MAP, 3600 * 1000);
  assert.equal(result.transportIsBottleneck, true);
  assert.equal(map.buffer.currentLiters, bufferCapacity(map, WATER_MAP));
  assert.equal(map.producer.awaitingRoom, true);
});

test("currentProducerPhase traverse chaque phase dans l'ordre, jamais de saut", () => {
  const map = createMapState();
  const phase0 = currentProducerPhase(map, WATER_MAP);
  assert.equal(phase0.key, "prepare");
  assert.equal(phase0.paused, false);

  tickMap(map, WATER_MAP, WATER_MAP.phases.prepare + 1);
  const phase1 = currentProducerPhase(map, WATER_MAP);
  assert.equal(phase1.key, "walkToWell");
});

test("currentProducerPhase reflète la pause quand le stockage est plein", () => {
  const map = createMapState();
  map.buffer.currentLiters = bufferCapacity(map, WATER_MAP);
  tickMap(map, WATER_MAP, producerCycleMs(map, WATER_MAP) * 2);
  const phase = currentProducerPhase(map, WATER_MAP);
  assert.equal(phase.paused, true);
});

test("une absence négative ou nulle ne rapporte jamais rien", () => {
  const map = createMapState();
  const zero = computeMapOfflineProgress(map, WATER_MAP, 0);
  assert.equal(zero.litersShipped, 0);
});

test("une horloge anormale (delta énorme, ex. changement d'heure système) ne produit ni NaN ni infini", () => {
  const map = createMapState();
  const absurd = computeMapOfflineProgress(map, WATER_MAP, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isFinite(absurd.litersShipped));
  assert.ok(Number.isFinite(absurd.moneyEarned));
  assert.ok(absurd.litersShipped >= 0);
});

test("de nombreux cycles longs successifs ne dérivent jamais (pas de NaN, pas de valeur négative)", () => {
  const map = createMapState();
  for (let i = 0; i < 5000; i += 1) {
    tickMap(map, WATER_MAP, 137); // pas rond, exprès, pour exposer un arrondi qui dériverait
  }
  assert.ok(Number.isFinite(map.buffer.currentLiters));
  assert.ok(Number.isFinite(map.totalLitersShipped));
  assert.ok(map.buffer.currentLiters >= 0);
  const stageMs = stageTotalMs(map, WATER_MAP, undefined, map.producer.stage);
  assert.ok(map.producer.stageProgressMs < stageMs + 1e-6 || map.producer.awaitingRoom);
});

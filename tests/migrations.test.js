import test from "node:test";
import assert from "node:assert/strict";
import { migrateSave } from "../src/engine/migrations.js";
import { SAVE_VERSION } from "../src/engine/balance.js";

test("rejette une entrée nulle, non-objet, ou sans version", () => {
  assert.equal(migrateSave(null), null);
  assert.equal(migrateSave(undefined), null);
  assert.equal(migrateSave("oops"), null);
  assert.equal(migrateSave({}), null);
  assert.equal(migrateSave({ version: 0 }), null);
});

test("accepte une sauvegarde déjà à jour sans la modifier", () => {
  const save = { version: SAVE_VERSION, money: 42 };
  const result = migrateSave(save);
  assert.equal(result.money, 42);
  assert.equal(result.version, SAVE_VERSION);
});

test("rejette une sauvegarde d'une version future inconnue plutôt que de la corrompre", () => {
  const result = migrateSave({ version: SAVE_VERSION + 5, money: 10 });
  assert.equal(result, null);
});

test("une sauvegarde de la version courante mais avec des champs manquants est complétée, jamais un crash", () => {
  const truncated = { version: SAVE_VERSION, money: 500 }; // pas de perks, maps, audio, tutorial, telemetry
  const result = migrateSave(truncated);
  assert.equal(result.money, 500); // préservé
  assert.equal(typeof result.perks.productionGlobal, "number");
  assert.ok(result.maps.water);
  assert.ok(result.audio);
  assert.ok(result.tutorial.seen);
  assert.ok(result.telemetry.sessions);
});

test("une sauvegarde de la version courante avec des atouts partiellement présents complète seulement ce qui manque", () => {
  const partial = { version: SAVE_VERSION, perks: { productionGlobal: 2 } };
  const result = migrateSave(partial);
  assert.equal(result.perks.productionGlobal, 2); // préservé, pas écrasé
  assert.equal(result.perks.cycleSpeed, 0); // complété
});

test("migre une sauvegarde V1 (version 2, ancien modèle de cycle) vers le nouveau modèle outbound/return sans perdre la progression économique", () => {
  const v1Save = {
    version: 2,
    money: 777,
    perles: 12,
    maps: {
      water: {
        producer: { bucketLevel: 3, movementLevel: 2, winchLevel: 1, wellLevel: 1, cycleProgressMs: 4200, paused: false },
        buffer: { level: 2, currentLiters: 88 },
        transport: { capacityLevel: 1, frequencyLevel: 1, timerMs: 500 },
        globalProductivityLevel: 1,
        totalLitersShipped: 999,
      },
    },
  };
  const migrated = migrateSave(v1Save);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.money, 777);
  assert.equal(migrated.perles, 12);
  // progression économique préservée :
  assert.equal(migrated.maps.water.producer.bucketLevel, 3);
  assert.equal(migrated.maps.water.buffer.currentLiters, 88);
  assert.equal(migrated.maps.water.totalLitersShipped, 999);
  // nouvel état d'animation, propre, jamais un champ de l'ancien modèle qui traîne :
  assert.equal(migrated.maps.water.producer.stage, "outbound");
  assert.equal(migrated.maps.water.producer.stageProgressMs, 0);
  assert.equal(migrated.maps.water.producer.awaitingRoom, false);
  assert.equal("cycleProgressMs" in migrated.maps.water.producer, false);
  assert.equal("paused" in migrated.maps.water.producer, false);
});

test("migre une sauvegarde V0 (version 1) vers une run V1 neuve, sans planter et sans supprimer les préférences audio", () => {
  const v0Save = {
    version: 1,
    vitality: 12345,
    totalGrowth: 12345,
    audio: { muted: true, volume: 0.3 },
  };
  const migrated = migrateSave(v0Save);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.audio.muted, true);
  assert.equal(migrated.audio.volume, 0.3);
  assert.equal(migrated.money, 0);
  assert.ok(migrated.maps.water);
  assert.equal(migrated.telemetry.migratedFromV0.previousTotalGrowth, 12345);
});

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

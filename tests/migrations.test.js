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
  const save = { version: SAVE_VERSION, vitality: 42 };
  const result = migrateSave(save);
  assert.equal(result.vitality, 42);
  assert.equal(result.version, SAVE_VERSION);
});

test("rejette une sauvegarde d'une version future inconnue plutôt que de la corrompre", () => {
  const result = migrateSave({ version: SAVE_VERSION + 5, vitality: 10 });
  assert.equal(result, null);
});

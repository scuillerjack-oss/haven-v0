import test from "node:test";
import assert from "node:assert/strict";

// Simule localStorage en mémoire (les tests tournent sous node:test, sans DOM).
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

globalThis.localStorage = new MemoryStorage();

const { loadState, saveState, clearSave, SAVE_KEY } = await import("../src/save.js");
const { createInitialState } = await import("../src/engine/state.js");
const { applyTap } = await import("../src/engine/simulation.js");

test("sans sauvegarde existante, loadState renvoie un état neuf", () => {
  localStorage.removeItem(SAVE_KEY);
  const { state, fresh, rejected } = loadState(1000);
  assert.equal(fresh, true);
  assert.equal(rejected, false);
  assert.equal(state.vitality, 0);
});

test("save puis load redonne un état équivalent (reprise après rechargement)", () => {
  const state = createInitialState(1000);
  applyTap(state, 1500);
  applyTap(state, 1600);
  saveState(state);

  const { state: reloaded, fresh, rejected } = loadState(1700);
  assert.equal(fresh, false);
  assert.equal(rejected, false);
  assert.equal(reloaded.vitality, state.vitality);
  assert.equal(reloaded.stats.totalTaps, 2);
});

test("une sauvegarde corrompue (JSON invalide) est rejetée proprement, jamais un crash", () => {
  localStorage.setItem(SAVE_KEY, "{ not json");
  const { state, fresh, rejected } = loadState(2000);
  assert.equal(rejected, true);
  assert.equal(fresh, true);
  assert.equal(state.vitality, 0);
});

test("une sauvegarde d'une version future inconnue est rejetée proprement", () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 999, vitality: 50 }));
  const { state, rejected } = loadState(2000);
  assert.equal(rejected, true);
  assert.equal(state.vitality, 0);
});

test("clearSave supprime bien la sauvegarde", () => {
  const state = createInitialState(1000);
  saveState(state);
  clearSave();
  const { fresh } = loadState(1000);
  assert.equal(fresh, true);
});

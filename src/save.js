import { migrateSave } from "./engine/migrations.js";
import { createInitialState } from "./engine/state.js";

export const SAVE_KEY = "haven-v0-save";

function hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadState(now = Date.now()) {
  if (!hasLocalStorage()) return { state: createInitialState(now), fresh: true, rejected: false };
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { state: createInitialState(now), fresh: true, rejected: false };
  }
  if (!raw) return { state: createInitialState(now), fresh: true, rejected: false };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: createInitialState(now), fresh: true, rejected: true };
  }

  const migrated = migrateSave(parsed);
  if (!migrated) {
    return { state: createInitialState(now), fresh: true, rejected: true };
  }
  return { state: migrated, fresh: false, rejected: false };
}

export function saveState(state) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

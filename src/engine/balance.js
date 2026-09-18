export const SAVE_VERSION = 2;
export const TICK_MS = 200;

export const BASE_OFFLINE_CAP_HOURS = 4;
export const BASE_OFFLINE_EFFICIENCY = 0.8; // légèrement < 1 : rester ouvert reste un peu meilleur.

export function offlineCapHours(gameState, perkValueFn) {
  return BASE_OFFLINE_CAP_HOURS + perkValueFn(gameState, "offlineCap");
}

export function offlineEfficiency(gameState, perkValueFn) {
  return Math.min(1, BASE_OFFLINE_EFFICIENCY + perkValueFn(gameState, "offlineEfficiency"));
}

import { getMapDefinition, MAP_ORDER } from "./mapDefinitions.js";
import { tickMap, applyMapOfflineProgress, isNextMapUnlocked } from "./mapEconomy.js";
import { purchaseMapUpgrade, nextUpgradeInfo } from "./mapUpgrades.js";
import {
  perkValue,
  purchasePerk,
  perlesEarnable,
  canRenaissance,
  prestigeProductionMultiplier,
  RENAISSANCE_MIN_PERLES,
} from "./meta.js";
import { offlineCapHours, offlineEfficiency, BASE_OFFLINE_EFFICIENCY } from "./balance.js";
import { createMapState } from "./state.js";

export { purchaseMapUpgrade, nextUpgradeInfo, purchasePerk, perlesEarnable, canRenaissance, RENAISSANCE_MIN_PERLES };

// Modificateurs de méta-progression (atouts + bonus de prestige),
// génériques : s'appliquent identiquement à toute map, présente ou future.
export function getModifiers(gameState) {
  const prestige = prestigeProductionMultiplier(gameState);
  return {
    productionMultiplier: (1 + perkValue(gameState, "productionGlobal")) * prestige,
    cycleSpeedMultiplier: 1 - perkValue(gameState, "cycleSpeed"),
    storageMultiplier: 1 + perkValue(gameState, "storageGlobal"),
    logisticsMultiplier: 1 - perkValue(gameState, "logistics"),
  };
}

function forEachOwnedMap(gameState, fn) {
  for (const mapId of Object.keys(gameState.maps)) {
    const def = getMapDefinition(mapId);
    if (def) fn(mapId, gameState.maps[mapId], def);
  }
}

// Toutes les maps possédées produisent, même celles qu'on ne regarde pas
// (section 12 : "les anciennes maps peuvent continuer à produire en
// arrière-plan"). Rien n'est animé hors écran, seule l'économie tourne.
export function applyTick(gameState, deltaMs) {
  const modifiers = getModifiers(gameState);
  let moneyEarned = 0;
  const perMap = {};
  forEachOwnedMap(gameState, (mapId, mapState, mapDef) => {
    const result = tickMap(mapState, mapDef, deltaMs, modifiers);
    moneyEarned += result.moneyEarned;
    perMap[mapId] = result;
  });
  gameState.money += moneyEarned;
  gameState.totalMoneyEarnedThisRun += moneyEarned;
  checkMapUnlocks(gameState);
  return { moneyEarned, perMap };
}

export function applyOfflineProgress(gameState, elapsedMs) {
  const capMs = offlineCapHours(gameState, perkValue) * 3600 * 1000;
  const efficiency = offlineEfficiency(gameState, perkValue);
  const clampedElapsed = Math.max(elapsedMs, 0);
  const effectiveMs = Math.min(clampedElapsed, capMs);

  const modifiers = getModifiers(gameState);
  let moneyEarned = 0;
  const perMap = {};
  forEachOwnedMap(gameState, (mapId, mapState, mapDef) => {
    const result = applyMapOfflineProgress(mapState, mapDef, effectiveMs * efficiency, modifiers);
    moneyEarned += result.moneyEarned;
    perMap[mapId] = result;
  });
  gameState.money += moneyEarned;
  gameState.totalMoneyEarnedThisRun += moneyEarned;
  checkMapUnlocks(gameState);

  return {
    moneyEarned,
    elapsedMs: clampedElapsed,
    effectiveMs,
    cappedAway: clampedElapsed > capMs,
    capMs,
    perMap,
  };
}

function checkMapUnlocks(gameState) {
  const currentIndex = MAP_ORDER.indexOf(gameState.currentMapId);
  const nextMapId = MAP_ORDER[currentIndex + 1];
  if (!nextMapId || gameState.maps[nextMapId]) return; // pas de map suivante, ou déjà débloquée
  const currentDef = getMapDefinition(gameState.currentMapId);
  const currentState = gameState.maps[gameState.currentMapId];
  if (isNextMapUnlocked(currentState, currentDef)) {
    gameState.maps[nextMapId] = createMapState();
    gameState.telemetry.unlocks.push({ mapId: nextMapId, at: Date.now() });
  }
}

// Renaissance : convertit la progression de la run en Perles, réinitialise
// les maps (progression temporaire), conserve tout le reste (Perles,
// atouts, tutoriels vus, audio). Le reset ne se déclenche jamais tout seul.
export function performRenaissance(gameState, now = Date.now()) {
  if (!canRenaissance(gameState)) return { ok: false, reason: "not_enough_perles" };
  const earned = perlesEarnable(gameState);

  gameState.perles += earned;
  gameState.prestigeCount += 1;
  gameState.money = 0;
  gameState.totalMoneyEarnedThisRun = 0;
  gameState.currentMapId = "water";
  gameState.maps = { water: createMapState() };
  gameState.telemetry.prestiges.push({ at: now, perlesEarned: earned, prestigeCount: gameState.prestigeCount });

  return { ok: true, earned };
}

export { BASE_OFFLINE_EFFICIENCY };

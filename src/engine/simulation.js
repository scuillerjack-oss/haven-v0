import {
  PRODUCTIONS,
  PRODUCTION_ORDER,
  GLOBAL_UPGRADES,
  productionLevelData,
  nextProductionUpgrade,
  offlineCapHours,
  stageForGrowth,
  OFFLINE_EFFICIENCY,
} from "./balance.js";

export function isProductionUnlocked(state, productionId) {
  const def = PRODUCTIONS[productionId];
  if (!def) return false;
  return state.totalGrowth >= def.unlockAt;
}

export function isGlobalUpgradeUnlocked(state, upgradeId) {
  const def = GLOBAL_UPGRADES[upgradeId];
  if (!def) return false;
  return state.totalGrowth >= def.unlockAt;
}

export function productionPerSecond(state) {
  let total = 0;
  for (const id of PRODUCTION_ORDER) {
    const level = state.productions[id]?.level ?? 0;
    if (level <= 0) continue;
    const data = productionLevelData(id, level);
    if (data) total += data.rate;
  }
  return total;
}

export function tapValue(state) {
  const sourceLevel = state.productions.source?.level ?? 1;
  const data = productionLevelData("source", sourceLevel);
  const base = data ? data.tapBase : 1;
  const mult = state.globalUpgrades.meditationPath ? GLOBAL_UPGRADES.meditationPath.tapMultiplier : 1;
  return base * mult;
}

function addGrowth(state, amount) {
  if (amount <= 0) return;
  state.vitality += amount;
  state.totalGrowth += amount;
  state.stats.lifetimeVitality += amount;
}

// Applique le temps écoulé pendant que le jeu est ouvert (boucle active,
// petits pas de TICK_MS). Ne fait jamais de saut brutal : c'est
// applyOfflineProgress qui gère les longues absences séparément.
export function applyTick(state, deltaMs, now = Date.now()) {
  const dtSec = Math.max(deltaMs, 0) / 1000;
  const gained = productionPerSecond(state) * dtSec;
  addGrowth(state, gained);
  state.lastTick = now;
  return { state, gained };
}

export function applyTap(state, now = Date.now()) {
  const gained = tapValue(state);
  addGrowth(state, gained);
  state.stats.totalTaps += 1;
  state.lastTick = now;
  return { state, gained };
}

export function purchaseProductionUpgrade(state, productionId) {
  const def = PRODUCTIONS[productionId];
  if (!def) return { ok: false, reason: "unknown" };
  if (!isProductionUnlocked(state, productionId)) return { ok: false, reason: "locked" };
  const currentLevel = state.productions[productionId]?.level ?? 0;
  const next = nextProductionUpgrade(productionId, currentLevel);
  if (!next) return { ok: false, reason: "max" };
  if (state.vitality < next.cost) return { ok: false, reason: "cannot_afford", cost: next.cost };
  state.vitality -= next.cost;
  state.productions[productionId].level = next.level;
  return { ok: true, level: next.level, label: next.label };
}

export function purchaseGlobalUpgrade(state, upgradeId) {
  const def = GLOBAL_UPGRADES[upgradeId];
  if (!def) return { ok: false, reason: "unknown" };
  if (state.globalUpgrades[upgradeId]) return { ok: false, reason: "already_owned" };
  if (state.totalGrowth < def.unlockAt) return { ok: false, reason: "locked" };
  if (state.vitality < def.cost) return { ok: false, reason: "cannot_afford", cost: def.cost };
  state.vitality -= def.cost;
  state.globalUpgrades[upgradeId] = true;
  return { ok: true };
}

// Le calcul hors-ligne est un instantané honnête : le taux de production
// au moment de la fermeture, plafonné en durée, réduit d'un facteur
// d'efficacité. Ce n'est jamais présenté comme une preuve de rétention
// réelle — seulement comme un crédit clairement expliqué au retour.
export function computeOfflineProgress(state, elapsedMs) {
  const capMs = offlineCapHours(state) * 3600 * 1000;
  const clampedElapsed = Math.max(elapsedMs, 0);
  const effectiveMs = Math.min(clampedElapsed, capMs);
  const rate = productionPerSecond(state);
  const gained = rate * (effectiveMs / 1000) * OFFLINE_EFFICIENCY;
  return {
    gained,
    effectiveMs,
    elapsedMs: clampedElapsed,
    cappedAway: clampedElapsed > capMs,
    capMs,
  };
}

export function applyOfflineProgress(state, elapsedMs) {
  const result = computeOfflineProgress(state, elapsedMs);
  if (result.gained > 0) addGrowth(state, result.gained);
  return result;
}

export function crossedStages(prevTotalGrowth, newTotalGrowth) {
  const prevStage = stageForGrowth(prevTotalGrowth);
  const newStage = stageForGrowth(newTotalGrowth);
  if (newStage.id === prevStage.id) return [];
  const crossed = [];
  for (let id = prevStage.id + 1; id <= newStage.id; id += 1) {
    crossed.push(id);
  }
  return crossed;
}

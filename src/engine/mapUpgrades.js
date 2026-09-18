// Achats d'améliorations de chaîne : chaque achat a un coût (en argent du
// compte), un niveau suivant et un effet visible (voir mapDefinitions.js).
// Fonctions génériques pour éviter de dupliquer 8 fois la même logique.

import { perkValue } from "./meta.js";

const UPGRADE_PATHS = {
  bucket: { defPath: (def) => def.producerUpgrades.bucket, getState: (m) => m.producer, field: "bucketLevel" },
  movement: { defPath: (def) => def.producerUpgrades.movement, getState: (m) => m.producer, field: "movementLevel" },
  winch: { defPath: (def) => def.producerUpgrades.winch, getState: (m) => m.producer, field: "winchLevel" },
  well: { defPath: (def) => def.producerUpgrades.well, getState: (m) => m.producer, field: "wellLevel" },
  buffer: { defPath: (def) => def.bufferUpgrades, getState: (m) => m.buffer, field: "level" },
  transportCapacity: {
    defPath: (def) => def.transportCapacityUpgrades,
    getState: (m) => m.transport,
    field: "capacityLevel",
  },
  transportFrequency: {
    defPath: (def) => def.transportFrequencyUpgrades,
    getState: (m) => m.transport,
    field: "frequencyLevel",
  },
  globalProductivity: {
    defPath: (def) => def.globalProductivityUpgrades,
    getState: (m) => m,
    field: "globalProductivityLevel",
  },
};

export const UPGRADE_PATH_IDS = Object.keys(UPGRADE_PATHS);

export function nextUpgradeInfo(mapState, mapDef, pathId) {
  const path = UPGRADE_PATHS[pathId];
  if (!path) return null;
  const familyDef = path.defPath(mapDef);
  const currentLevel = path.getState(mapState)[path.field];
  const current = familyDef.levels.find((l) => l.level === currentLevel);
  const next = familyDef.levels.find((l) => l.level === currentLevel + 1);
  return { familyDef, currentLevel, current, next };
}

// L'interface ne doit jamais se contenter d'indications abstraites
// ("Vitesse +2%") : chaque carte affiche la grandeur concrète, valeur
// actuelle -> valeur suivante, directement dérivée des vraies valeurs du
// moteur (jamais recalculée à la main côté UI). Une phase "de référence"
// représente chaque famille de vitesse (déplacement/treuil/puits) puisque
// leur multiplicateur s'applique à plusieurs phases à la fois.
const PRODUCER_REFERENCE_PHASE = {
  movement: "walkToWell",
  winch: "lowerBucket",
  well: "wellFill",
};

export function upgradeEffect(mapDef, pathId, currentLevelObj, nextLevelObj) {
  switch (pathId) {
    case "bucket":
      return { kind: "liters", current: currentLevelObj.liters, next: nextLevelObj.liters, suffix: "par trajet" };
    case "buffer":
      return { kind: "liters", current: currentLevelObj.capacity, next: nextLevelObj.capacity, suffix: "de stockage" };
    case "transportCapacity":
      return { kind: "liters", current: currentLevelObj.capacity, next: nextLevelObj.capacity, suffix: "par passage" };
    case "transportFrequency":
      return {
        kind: "seconds",
        current: currentLevelObj.intervalMs / 1000,
        next: nextLevelObj.intervalMs / 1000,
        suffix: "entre deux passages",
      };
    case "movement":
    case "winch":
    case "well": {
      const phaseKey = PRODUCER_REFERENCE_PHASE[pathId];
      const baseMs = mapDef.phases[phaseKey];
      return {
        kind: "seconds",
        current: (baseMs * currentLevelObj.multiplier) / 1000,
        next: (baseMs * nextLevelObj.multiplier) / 1000,
        suffix: "",
      };
    }
    case "globalProductivity":
      return {
        kind: "percent",
        current: (currentLevelObj.multiplier - 1) * 100,
        next: (nextLevelObj.multiplier - 1) * 100,
        suffix: "de productivité",
      };
    default:
      return null;
  }
}

export function purchaseMapUpgrade(gameState, mapState, mapDef, pathId) {
  const path = UPGRADE_PATHS[pathId];
  if (!path) return { ok: false, reason: "unknown" };
  const info = nextUpgradeInfo(mapState, mapDef, pathId);
  if (!info.next) return { ok: false, reason: "max" };
  const costMultiplier = 1 - perkValue(gameState, "upgradeCostReduction");
  const cost = info.next.cost * costMultiplier;
  if (gameState.money < cost) return { ok: false, reason: "cannot_afford", cost };
  gameState.money -= cost;
  path.getState(mapState)[path.field] = info.next.level;
  return { ok: true, level: info.next.level, label: info.next.label };
}

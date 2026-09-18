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
  const next = familyDef.levels.find((l) => l.level === currentLevel + 1);
  return { familyDef, currentLevel, next };
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

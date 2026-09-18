// Méta-progression : Perles, atouts permanents universels, Renaissance
// (prestige). Survit aux réinitialisations de run — c'est tout son rôle.

export const RENAISSANCE_MIN_PERLES = 100; // hypothèse de calibrage (section 14.1) — voir rapport V1.
export const PRESTIGE_PRODUCTION_BONUS_PER_RUN = 0.1; // +10% par Renaissance déjà effectuée — hypothèse à calibrer.

// 8 familles, génériques à toute map présente ou future (jamais "seau +10%").
export const PERKS = {
  productionGlobal: {
    name: "Production globale",
    description: "+X % de production sur toute chaîne",
    levels: [
      { level: 1, cost: 5, value: 0.1 },
      { level: 2, cost: 15, value: 0.22 },
      { level: 3, cost: 40, value: 0.35 },
    ],
  },
  cycleSpeed: {
    name: "Vitesse des cycles",
    description: "-X % de durée de cycle sur toute chaîne",
    levels: [
      { level: 1, cost: 8, value: 0.1 },
      { level: 2, cost: 25, value: 0.2 },
      { level: 3, cost: 60, value: 0.3 },
    ],
  },
  offlineEfficiency: {
    name: "Efficacité hors-ligne",
    description: "Renforce le crédit hors-ligne",
    levels: [
      { level: 1, cost: 10, value: 0.1 },
      { level: 2, cost: 30, value: 0.2 },
    ],
  },
  storageGlobal: {
    name: "Stockage global",
    description: "+X % de capacité de tampon sur toute map",
    levels: [
      { level: 1, cost: 8, value: 0.15 },
      { level: 2, cost: 25, value: 0.35 },
    ],
  },
  logistics: {
    name: "Logistique",
    description: "+X % d'efficacité de transport (livraisons plus fréquentes)",
    levels: [
      { level: 1, cost: 12, value: 0.15 },
      { level: 2, cost: 35, value: 0.3 },
    ],
  },
  upgradeCostReduction: {
    name: "Coût des améliorations",
    description: "-X % léger sur le coût de toutes les améliorations",
    levels: [
      { level: 1, cost: 15, value: 0.1 },
      { level: 2, cost: 45, value: 0.18 },
    ],
  },
  offlineCap: {
    name: "Cap hors-ligne",
    description: "+durée maximale de crédit hors-ligne",
    levels: [
      { level: 1, cost: 10, value: 2 },
      { level: 2, cost: 30, value: 5 },
      { level: 3, cost: 70, value: 10 },
    ],
  },
  perleGain: {
    name: "Gain de Perles",
    description: "+X % de Perles gagnées à chaque Renaissance",
    levels: [
      { level: 1, cost: 20, value: 0.15 },
      { level: 2, cost: 60, value: 0.3 },
    ],
  },
};

export function perkLevelData(perkId, level) {
  const def = PERKS[perkId];
  if (!def || level <= 0) return null;
  return def.levels.find((l) => l.level === level) ?? null;
}

export function perkValue(gameState, perkId) {
  const level = gameState.perks[perkId] ?? 0;
  const data = perkLevelData(perkId, level);
  return data ? data.value : 0;
}

export function nextPerkInfo(gameState, perkId) {
  const def = PERKS[perkId];
  if (!def) return null;
  const currentLevel = gameState.perks[perkId] ?? 0;
  const next = def.levels.find((l) => l.level === currentLevel + 1);
  return { def, currentLevel, next };
}

export function purchasePerk(gameState, perkId) {
  const info = nextPerkInfo(gameState, perkId);
  if (!info) return { ok: false, reason: "unknown" };
  if (!info.next) return { ok: false, reason: "max" };
  if (gameState.perles < info.next.cost) return { ok: false, reason: "cannot_afford", cost: info.next.cost };
  gameState.perles -= info.next.cost;
  gameState.perks[perkId] = info.next.level;
  return { ok: true, level: info.next.level };
}

// Perles gagnables MAINTENANT si le joueur renaît, sans les dépenser —
// affiché en continu pour nourrir la décision "renaître ou pousser plus
// loin" (section 14.3). Racine carrée : les premiers gains sont rapides,
// la suite ralentit sans jamais s'arrêter.
export function perlesEarnable(gameState) {
  const bonus = 1 + perkValue(gameState, "perleGain");
  return Math.floor(Math.sqrt(Math.max(0, gameState.totalMoneyEarnedThisRun)) * bonus);
}

export function canRenaissance(gameState) {
  return perlesEarnable(gameState) >= RENAISSANCE_MIN_PERLES;
}

export function prestigeProductionMultiplier(gameState) {
  return 1 + gameState.prestigeCount * PRESTIGE_PRODUCTION_BONUS_PER_RUN;
}

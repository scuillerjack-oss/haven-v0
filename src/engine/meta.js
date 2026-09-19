// Méta-progression : Perles, atouts permanents universels, Renaissance
// (prestige). Survit aux réinitialisations de run — c'est tout son rôle.
import { BASE_OFFLINE_EFFICIENCY, BASE_OFFLINE_CAP_HOURS } from "./balance.js";

export const RENAISSANCE_MIN_PERLES = 100; // hypothèse de calibrage (section 14.1) — voir rapport V1.
export const PRESTIGE_PRODUCTION_BONUS_PER_RUN = 0.1; // +10% par Renaissance déjà effectuée — hypothèse à calibrer.

// V4 (section "ATOUTS / PERLES" du cahier des charges post-bêta V3), après
// audit :
// - "Vitesse des cycles" est SUPPRIMÉ : une accélération globale du cycle du
//   fermier (déplacement+treuil+puits à la fois) rouvre exactement le
//   défaut d'équilibrage diagnostiqué et corrigé ailleurs en V4 (voir
//   tests/realistic-purchases.test.js) — un joueur qui l'achète peut encore
//   moins ressentir le besoin d'améliorer le camion. Les Perles déjà
//   dépensées dessus sont remboursées par la migration V3->V4 (voir
//   migrations.js), jamais une perte silencieuse d'acquis.
// - "Cap hors-ligne" passe de 3 paliers dégressifs à un seul palier
//   généreux : la bêta a signalé qu'une absence réelle d'environ 7h était
//   déjà comptée en entier, rendant les paliers supplémentaires (jusqu'à
//   14h) invisibles en pratique. Un unique palier qui couvre large (une
//   journée complète) reste perceptible sans empiler des niveaux dont le
//   joueur ne peut pas sentir la différence.
// - "Stockage global" est renommé : son ancien nom entrait en collision
//   avec le "Stockage" par map (bufferUpgrades, mapDefinitions.js) — un
//   joueur ne pouvait pas deviner s'il s'agissait du même bouton. Le
//   nouveau nom précise explicitement la portée (toutes les maps, en plus
//   du Stockage propre à chaque map).
// - Chaque description ne contient plus jamais de pourcentage littéral :
//   la grandeur réelle (actuelle -> suivante) est calculée par
//   perkEffect() ci-dessous et affichée par l'UI (voir hud.js), jamais un
//   texte "+X %" statique.
export const PERKS = {
  productionGlobal: {
    name: "Production globale",
    description: "Bonus permanent sur la production, valable pour toute map présente ou future.",
    levels: [
      { level: 1, cost: 5, value: 0.1 },
      { level: 2, cost: 15, value: 0.22 },
      { level: 3, cost: 40, value: 0.35 },
    ],
  },
  offlineEfficiency: {
    name: "Efficacité hors-ligne",
    description: "Une plus grande part du temps passé hors-ligne est comptée comme si vous aviez joué.",
    levels: [
      { level: 1, cost: 10, value: 0.1 },
      { level: 2, cost: 30, value: 0.2 },
    ],
  },
  storageGlobal: {
    name: "Stockage (toutes les maps)",
    description: "Bonus de capacité de stockage permanent, cumulable avec le Stockage propre à chaque map.",
    levels: [
      { level: 1, cost: 8, value: 0.15 },
      { level: 2, cost: 25, value: 0.35 },
    ],
  },
  logistics: {
    name: "Logistique",
    description: "Le camion-citerne effectue ses tournées plus souvent, sur toute map.",
    levels: [
      { level: 1, cost: 12, value: 0.15 },
      { level: 2, cost: 35, value: 0.3 },
    ],
  },
  upgradeCostReduction: {
    name: "Coût des améliorations",
    description: "Toutes les améliorations de chaîne coûtent un peu moins cher.",
    levels: [
      { level: 1, cost: 15, value: 0.1 },
      { level: 2, cost: 45, value: 0.18 },
    ],
  },
  offlineCap: {
    name: "Cap hors-ligne",
    description: "Une absence est comptée en entier bien plus longtemps avant d'atteindre un plafond.",
    levels: [{ level: 1, cost: 15, value: 20 }],
  },
  perleGain: {
    name: "Gain de Perles",
    description: "Chaque Renaissance rapporte davantage de Perles.",
    levels: [
      { level: 1, cost: 20, value: 0.15 },
      { level: 2, cost: 60, value: 0.3 },
    ],
  },
};

// Grandeur concrète (valeur actuelle -> valeur suivante) pour chaque atout,
// même logique que upgradeEffect() (mapUpgrades.js) : jamais un pourcentage
// abstrait affiché seul quand la vraie valeur appliquée par le moteur est
// calculable. `currentValue`/`nextValue` sont les valeurs brutes stockées
// dans PERKS (0 si l'atout n'est pas encore possédé).
export function perkEffect(perkId, currentValue, nextValue) {
  switch (perkId) {
    case "productionGlobal":
      return { kind: "percent", current: currentValue * 100, next: nextValue * 100, suffix: "de production" };
    case "storageGlobal":
      return { kind: "percent", current: currentValue * 100, next: nextValue * 100, suffix: "de capacité de stockage" };
    case "perleGain":
      return { kind: "percent", current: currentValue * 100, next: nextValue * 100, suffix: "de Perles par Renaissance" };
    case "logistics":
      // Réduction du délai entre deux passages du camion : afficher un
      // signe négatif (jamais "+X %" pour une chose qui diminue).
      return { kind: "percent", current: -(currentValue * 100), next: -(nextValue * 100), suffix: "de délai entre deux passages du camion" };
    case "upgradeCostReduction":
      return { kind: "percent", current: -(currentValue * 100), next: -(nextValue * 100), suffix: "sur le coût de chaque amélioration" };
    case "offlineEfficiency": {
      const currentPct = Math.min(1, BASE_OFFLINE_EFFICIENCY + currentValue) * 100;
      const nextPct = Math.min(1, BASE_OFFLINE_EFFICIENCY + nextValue) * 100;
      return { kind: "percent", current: currentPct, next: nextPct, suffix: "du temps hors-ligne réellement compté" };
    }
    case "offlineCap":
      return {
        kind: "hours",
        current: BASE_OFFLINE_CAP_HOURS + currentValue,
        next: BASE_OFFLINE_CAP_HOURS + nextValue,
        suffix: "d'absence pleinement comptée",
      };
    default:
      return null;
  }
}

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

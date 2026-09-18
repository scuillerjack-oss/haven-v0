// Définitions data-driven des maps (section 21 du cahier des charges V1) :
// une nouvelle map s'ajoute ici, jamais en dupliquant le moteur. Une seule
// map est réellement autorée dans cette V1/V2 ("water").
//
// V2 : les familles d'amélioration sont générées (pas tapées à la main)
// via une courbe de coûts/valeurs géométrique — un multiplicateur global
// unique aurait soit rendu le début trop lent, soit raccourci toute la
// map (c'est exactement le problème que la bêta a révélé). Deux formes de
// courbes :
//
// - "valeur croissante sans plafond" (seau, stockage, citerne,
//   productivité) : chaque niveau coûte plus cher ET rapporte plus,
//   géométriquement — l'axe de progression long terme, jamais limité par
//   la lisibilité de l'animation.
// - "durée décroissante VERS UN PLAFOND" (déplacement, treuil, puits,
//   fréquence transport) : le multiplicateur de temps descend linéairement
//   vers un plancher dérivé de MIN_VISUAL_PHASE_MS / MIN_VISUAL_TRANSPORT_
//   INTERVAL_MS — jamais une animation qui finit par durer 0ms. Une fois
//   le plancher atteint, l'axe est épuisé : la progression économique doit
//   alors venir des familles non plafonnées (section 4 du cahier des
//   charges V2 — "vitesse infinie").

// Aucune phase animée (marche/treuil/puits) ne doit jamais descendre sous
// cette durée à l'écran, quel que soit le niveau d'amélioration acheté.
export const MIN_VISUAL_PHASE_MS = 250;
// Le camion doit rester un événement visible, jamais un aller-retour instantané.
export const MIN_VISUAL_TRANSPORT_INTERVAL_MS = 6000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Le plancher lui-même doit arrondir VERS LE HAUT (jamais vers le plus
// proche) : un multiplicateur arrondi au plus proche pourrait redescendre
// sous MIN_VISUAL_PHASE_MS une fois réappliqué à la phase la plus courte
// (ex. 0.1042 arrondi "au plus proche" donne 0.10, qui repasse sous le
// plancher). round2 reste sûr pour tous les niveaux intermédiaires car ils
// sont toujours strictement au-dessus de ce plancher déjà majoré.
function ceil2(n) {
  return Math.ceil(n * 100) / 100;
}

// Coût géométrique commun aux deux formes de courbe : le niveau 1 est le
// départ gratuit ; chaque niveau suivant coûte baseCost * costGrowth^(n-2).
function costAt(level, baseCost, costGrowth) {
  return level === 1 ? 0 : Math.round(baseCost * Math.pow(costGrowth, level - 2));
}

// Familles sans plafond : valeur = baseValue * valueGrowth^(n-1).
function growingValueLevels({ count, baseCost, costGrowth, baseValue, valueGrowth, valueKey, labels }) {
  const levels = [];
  for (let level = 1; level <= count; level += 1) {
    levels.push({
      level,
      cost: costAt(level, baseCost, costGrowth),
      [valueKey]: round2(baseValue * Math.pow(valueGrowth, level - 1)),
      label: labels[level - 1] ?? `Amélioration ${level}`,
    });
  }
  return levels;
}

// Familles plafonnées par un temps minimal visuel : le multiplicateur (ou
// l'intervalle) descend LINÉAIREMENT de 1 (ou de la valeur de base) vers
// le plancher, atteint pile au dernier niveau — jamais en dessous.
function shrinkingMultiplierLevels({ count, baseCost, costGrowth, floorMultiplier, labels }) {
  const levels = [];
  for (let level = 1; level <= count; level += 1) {
    const t = (level - 1) / (count - 1);
    const multiplier = 1 - (1 - floorMultiplier) * t;
    levels.push({
      level,
      cost: costAt(level, baseCost, costGrowth),
      multiplier: round2(multiplier),
      label: labels[level - 1] ?? `Amélioration ${level}`,
    });
  }
  return levels;
}

function shrinkingIntervalLevels({ count, baseCost, costGrowth, baseIntervalMs, floorIntervalMs, labels }) {
  const levels = [];
  for (let level = 1; level <= count; level += 1) {
    const t = (level - 1) / (count - 1);
    const intervalMs = Math.round(baseIntervalMs - (baseIntervalMs - floorIntervalMs) * t);
    levels.push({
      level,
      cost: costAt(level, baseCost, costGrowth),
      intervalMs,
      label: labels[level - 1] ?? `Amélioration ${level}`,
    });
  }
  return levels;
}

// Durées de base (ms) de chaque phase du cycle du travailleur. Les phases
// "prepare" et "pour" sont fixes (flaveur, non améliorables) ; les autres
// sont réduites par leur famille d'amélioration respective.
const PHASES = {
  prepare: 500,
  walkToWell: 1800,
  lowerBucket: 1200,
  wellFill: 2400,
  raiseBucket: 1200,
  walkToStorage: 1800,
  pour: 500,
  walkBack: 1200,
};

// Plancher de chaque famille temporelle, dérivé du plus court trajet
// qu'elle affecte (jamais fixé à la main) : c'est la phase la plus courte
// qui détermine jusqu'où le multiplicateur peut descendre sans passer
// sous MIN_VISUAL_PHASE_MS.
const MOVEMENT_FLOOR = MIN_VISUAL_PHASE_MS / Math.min(PHASES.walkToWell, PHASES.walkToStorage, PHASES.walkBack);
const WINCH_FLOOR = MIN_VISUAL_PHASE_MS / Math.min(PHASES.lowerBucket, PHASES.raiseBucket);
const WELL_FLOOR = MIN_VISUAL_PHASE_MS / PHASES.wellFill;

export const WATER_MAP = {
  id: "water",
  name: "La chaîne de l'eau",
  pricePerLiter: 2,
  phases: PHASES,
  // Quelle clé de phase chaque famille d'amélioration réduit.
  phaseFamily: {
    walkToWell: "movement",
    walkToStorage: "movement",
    walkBack: "movement",
    lowerBucket: "winch",
    raiseBucket: "winch",
    wellFill: "well",
  },
  producerUpgrades: {
    bucket: {
      name: "Seau",
      levels: growingValueLevels({
        count: 12,
        baseCost: 3,
        costGrowth: 2.45,
        baseValue: 1,
        valueGrowth: 1.25,
        valueKey: "liters",
        labels: ["Seau en bois", "Seau renforcé", "Seau large", "Seau XXL", "Seau cerclé de fer"],
      }),
    },
    movement: {
      name: "Déplacement",
      levels: shrinkingMultiplierLevels({
        count: 8,
        baseCost: 4,
        costGrowth: 1.7,
        floorMultiplier: ceil2(MOVEMENT_FLOOR),
        labels: ["Pas tranquille", "Bonnes chaussures", "Foulée rapide", "Sprint"],
      }),
    },
    winch: {
      name: "Corde / treuil",
      levels: shrinkingMultiplierLevels({
        count: 7,
        baseCost: 6,
        costGrowth: 1.75,
        floorMultiplier: ceil2(WINCH_FLOOR),
        labels: ["Corde simple", "Poulie", "Treuil à manivelle", "Treuil motorisé"],
      }),
    },
    well: {
      name: "Puits",
      levels: shrinkingMultiplierLevels({
        count: 8,
        baseCost: 8,
        costGrowth: 1.8,
        floorMultiplier: ceil2(WELL_FLOOR),
        labels: ["Puits étroit", "Puits élargi", "Puits profond", "Source captée"],
      }),
    },
  },
  bufferUpgrades: {
    name: "Stockage",
    levels: growingValueLevels({
      count: 8,
      baseCost: 6,
      costGrowth: 2.1,
      baseValue: 10,
      valueGrowth: 1.3,
      valueKey: "capacity",
      labels: ["Bassin", "Citerne enterrée", "Réservoir", "Château d'eau"],
    }),
  },
  transportCapacityUpgrades: {
    name: "Citerne",
    levels: growingValueLevels({
      count: 8,
      baseCost: 8,
      costGrowth: 2.9,
      baseValue: 4,
      valueGrowth: 1.2,
      valueKey: "capacity",
      labels: ["Petite citerne", "Citerne moyenne", "Grande citerne", "Semi-remorque"],
    }),
  },
  transportFrequencyUpgrades: {
    name: "Fréquence transport",
    levels: shrinkingIntervalLevels({
      count: 8,
      baseCost: 5,
      costGrowth: 1.7,
      baseIntervalMs: 12_000,
      floorIntervalMs: MIN_VISUAL_TRANSPORT_INTERVAL_MS,
      labels: ["Tournée régulière", "Chauffeur motivé", "Deuxième chauffeur", "Flotte dédiée"],
    }),
  },
  // V3 : renommé après vérification de l'effet réel dans le moteur
  // (section 3 du cahier des charges post-bêta) — "Productivité" ne
  // disait pas au joueur QUOI exactement ce multiplicateur modifiait.
  // Vérifié dans mapEconomy.js (tickTransport / computeMapOfflineProgress) :
  // il ne fait jamais circuler plus d'eau que la production ou le
  // transport ne le permettent déjà — il multiplie uniquement l'argent
  // gagné par litre vendu, uniformément sur toute la chaîne. D'où le nom
  // et l'affichage en prix par litre (voir upgradeEffect() dans
  // mapUpgrades.js), jamais un pourcentage abstrait pour cette famille.
  globalProductivityUpgrades: {
    name: "Rendement de vente",
    levels: growingValueLevels({
      count: 8,
      baseCost: 60,
      costGrowth: 2.4,
      baseValue: 1,
      valueGrowth: 1.15,
      valueKey: "multiplier",
      labels: ["Tarif standard", "Meilleure clientèle", "Contrat de gros"],
    }),
  },
  // Repères de progression (litres cumulés livrés par cette map) — calibrés
  // par simulation (scripts/simulate-v2.mjs) : le début doit rester rapide
  // (premier achat en ~24s, plusieurs décisions en 2-3 min) SANS raccourcir
  // la durée totale déjà jugée trop courte en V1 (7-30 min actives selon le
  // profil). Cette valeur a été choisie pour retrouver, avec la nouvelle
  // courbe, une durée totale (active et calendaire) au moins égale à celle
  // mesurée en V1 sur les 3 profils de référence — voir le rapport V2.
  nextMapUnlockLitersShipped: 300_000,
  mapCompleteLitersShipped: 600_000,
};

export const MAP_DEFINITIONS = { water: WATER_MAP };
export const MAP_ORDER = ["water"];

export function getMapDefinition(mapId) {
  return MAP_DEFINITIONS[mapId] ?? null;
}

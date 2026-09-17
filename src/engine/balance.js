// Toutes les constantes d'équilibrage du jeu vivent ici : aucune valeur
// magique ailleurs. `totalGrowth` (cumul de Vitalité jamais gagné,
// jamais décrémenté par les achats) est ce qui fait avancer les paliers
// visuels et les déblocages — `vitality` (le stock dépensable) sert
// uniquement aux achats.

export const SAVE_VERSION = 1;

export const TICK_MS = 250;

// Une transformation visuelle majeure par palier (6 transitions, dans la
// fourchette 5-7 demandée). Chaque déblocage de production correspond à
// l'entrée dans un palier pour que systeme et decor avancent ensemble.
export const STAGES = [
  { id: 0, threshold: 0, name: "Terre stérile", description: "Une terre craquelée, sans vie visible." },
  { id: 1, threshold: 12, name: "Premier filet d'eau", description: "La source recommence à couler." },
  { id: 2, threshold: 150, name: "Mousse et humus", description: "Le sol se couvre d'une fine mousse." },
  { id: 3, threshold: 1_200, name: "Premières pousses", description: "De jeunes pousses percent la terre." },
  { id: 4, threshold: 15_000, name: "Broussailles", description: "Buissons et jeunes arbres s'installent." },
  { id: 5, threshold: 150_000, name: "Retour de la faune", description: "Des animaux discrets reviennent." },
  { id: 6, threshold: 1_500_000, name: "Havre vivant", description: "Un petit monde pleinement restauré." },
];

export function stageForGrowth(totalGrowth) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (totalGrowth >= stage.threshold) current = stage;
    else break;
  }
  return current;
}

export function nextStage(totalGrowth) {
  return STAGES.find((stage) => stage.threshold > totalGrowth) || null;
}

// Les 4 systèmes de production maximum autorisés par le cahier des charges.
// `unlockAt` se compare à totalGrowth. `levels[0]` est le niveau de départ
// une fois débloqué (gratuit) ; `levels[1..]` sont les achats nommés.
export const PRODUCTIONS = {
  source: {
    id: "source",
    name: "Source",
    unlockAt: 0, // disponible dès le début : c'est l'automatisation précoce.
    levels: [
      { level: 1, cost: 0, rate: 0.15, tapBase: 1, label: "Un filet irrégulier" },
      { level: 2, cost: 20, rate: 0.3, tapBase: 1.8, label: "Puits dégagé" },
      { level: 3, cost: 150, rate: 0.55, tapBase: 2.6, label: "Canal de pierre" },
      { level: 4, cost: 900, rate: 1, tapBase: 4, label: "Source vive" },
    ],
  },
  soil: {
    id: "soil",
    name: "Sol",
    unlockAt: 12,
    levels: [
      { level: 1, cost: 60, rate: 0.4, label: "Ameublir le sol" },
      { level: 2, cost: 500, rate: 1.1, label: "Compost naturel" },
      { level: 3, cost: 4_000, rate: 2.6, label: "Vers de terre" },
    ],
  },
  flora: {
    id: "flora",
    name: "Flore",
    unlockAt: 1_200,
    levels: [
      { level: 1, cost: 3_000, rate: 3, label: "Graines résistantes" },
      { level: 2, cost: 20_000, rate: 7, label: "Racines profondes" },
      { level: 3, cost: 120_000, rate: 16, label: "Pollinisation" },
      { level: 4, cost: 700_000, rate: 34, label: "Haie fleurie" },
    ],
  },
  fauna: {
    id: "fauna",
    name: "Faune",
    unlockAt: 150_000,
    levels: [
      { level: 1, cost: 400_000, rate: 50, label: "Nichoirs" },
      { level: 2, cost: 2_000_000, rate: 110, label: "Mare pour la faune" },
      { level: 3, cost: 9_000_000, rate: 240, label: "Sentiers discrets" },
    ],
  },
};

export const PRODUCTION_ORDER = ["source", "soil", "flora", "fauna"];

// Améliorations globales : deux choix, pas de remplissage en +10 %.
// Chacune change réellement un paramètre du jeu (durée hors-ligne,
// valeur du tap), pas juste un multiplicateur cosmétique.
export const GLOBAL_UPGRADES = {
  meditationPath: {
    id: "meditationPath",
    name: "Sentier de méditation",
    unlockAt: 60,
    cost: 150,
    tapMultiplier: 2.5,
    description: "Chaque geste sur la source rapporte 2,5x plus longtemps.",
  },
  nightDew: {
    id: "nightDew",
    name: "Rosée nocturne",
    unlockAt: 15_000,
    cost: 40_000,
    offlineCapHoursBonus: 4,
    description: "Prolonge le crédit hors-ligne de 4 à 8 heures.",
  },
};

export const BASE_OFFLINE_CAP_HOURS = 4;
export const OFFLINE_EFFICIENCY = 0.7; // 70% du taux actif pendant l'absence.

export function offlineCapHours(state) {
  const bonus = state.globalUpgrades.nightDew ? GLOBAL_UPGRADES.nightDew.offlineCapHoursBonus : 0;
  return BASE_OFFLINE_CAP_HOURS + bonus;
}

export function productionLevelData(productionId, level) {
  const def = PRODUCTIONS[productionId];
  if (!def) return null;
  return def.levels.find((entry) => entry.level === level) || null;
}

export function nextProductionUpgrade(productionId, currentLevel) {
  const def = PRODUCTIONS[productionId];
  if (!def) return null;
  return def.levels.find((entry) => entry.level === currentLevel + 1) || null;
}

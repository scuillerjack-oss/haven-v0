// Définitions data-driven des maps (section 21 du cahier des charges V1) :
// une nouvelle map s'ajoute ici, jamais en dupliquant le moteur. Une seule
// map est réellement autorée dans cette V1 ("water") ; l'architecture
// accepte d'autres entrées mais aucune n'est encore construite (voir le
// rapport V1 — honnêteté sur fait vs prévu).

// Durées de base (ms) de chaque phase du cycle du travailleur. Les phases
// "prepare" et "pour" sont fixes (flaveur, non améliorables) ; les autres
// sont réduites par leur famille d'amélioration respective.
export const WATER_MAP = {
  id: "water",
  name: "La chaîne de l'eau",
  pricePerLiter: 2,
  phases: {
    prepare: 500,
    walkToWell: 1800,
    lowerBucket: 1200,
    wellFill: 2400,
    raiseBucket: 1200,
    walkToStorage: 1800,
    pour: 500,
    walkBack: 1200,
  },
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
      levels: [
        { level: 1, cost: 0, liters: 1, label: "Seau en bois" },
        { level: 2, cost: 20, liters: 2, label: "Seau renforcé" },
        { level: 3, cost: 120, liters: 3.5, label: "Seau large" },
        { level: 4, cost: 700, liters: 6, label: "Seau XXL" },
      ],
    },
    movement: {
      name: "Déplacement",
      levels: [
        { level: 1, cost: 0, multiplier: 1, label: "Pas tranquille" },
        { level: 2, cost: 15, multiplier: 0.8, label: "Bonnes chaussures" },
        { level: 3, cost: 90, multiplier: 0.6, label: "Foulée rapide" },
        { level: 4, cost: 500, multiplier: 0.42, label: "Sprint" },
      ],
    },
    winch: {
      name: "Corde / treuil",
      levels: [
        { level: 1, cost: 0, multiplier: 1, label: "Corde simple" },
        { level: 2, cost: 25, multiplier: 0.75, label: "Poulie" },
        { level: 3, cost: 160, multiplier: 0.5, label: "Treuil à manivelle" },
        { level: 4, cost: 900, multiplier: 0.3, label: "Treuil motorisé" },
      ],
    },
    well: {
      name: "Puits",
      levels: [
        { level: 1, cost: 0, multiplier: 1, label: "Puits étroit" },
        { level: 2, cost: 30, multiplier: 0.7, label: "Puits élargi" },
        { level: 3, cost: 200, multiplier: 0.45, label: "Puits profond" },
        { level: 4, cost: 1100, multiplier: 0.25, label: "Source captée" },
      ],
    },
  },
  bufferUpgrades: {
    name: "Stockage",
    levels: [
      { level: 1, cost: 0, capacity: 50, label: "Bassin" },
      { level: 2, cost: 60, capacity: 150, label: "Citerne enterrée" },
      { level: 3, cost: 400, capacity: 500, label: "Réservoir" },
      { level: 4, cost: 2500, capacity: 1600, label: "Château d'eau" },
    ],
  },
  transportCapacityUpgrades: {
    name: "Citerne",
    levels: [
      { level: 1, cost: 0, capacity: 50, label: "Petite citerne" },
      { level: 2, cost: 80, capacity: 120, label: "Citerne moyenne" },
      { level: 3, cost: 600, capacity: 300, label: "Grande citerne" },
      { level: 4, cost: 3500, capacity: 800, label: "Semi-remorque" },
    ],
  },
  transportFrequencyUpgrades: {
    name: "Fréquence transport",
    levels: [
      { level: 1, cost: 0, intervalMs: 60_000, label: "Tournée régulière" },
      { level: 2, cost: 100, intervalMs: 40_000, label: "Chauffeur motivé" },
      { level: 3, cost: 700, intervalMs: 22_000, label: "Deuxième chauffeur" },
      { level: 4, cost: 4_000, intervalMs: 12_000, label: "Flotte dédiée" },
    ],
  },
  globalProductivityUpgrades: {
    name: "Productivité",
    levels: [
      { level: 1, cost: 0, multiplier: 1, label: "Rythme normal" },
      { level: 2, cost: 500, multiplier: 1.25, label: "Organisation" },
      { level: 3, cost: 3_000, multiplier: 1.6, label: "Méthode Kaizen" },
    ],
  },
  // Repères de progression (litres cumulés livrés par cette map) — à
  // calibrer par simulation, voir scripts/simulate-map1.mjs et le rapport.
  // Première valeur testée (3 000 / 6 000) : la production hors-ligne
  // capped suffisait à elle seule à finir la map en quelques minutes de
  // jeu actif réel — élargi d'un facteur ~20 pour que la boucle d'achats
  // actifs reste le moteur principal de la progression.
  nextMapUnlockLitersShipped: 60_000,
  mapCompleteLitersShipped: 120_000,
};

export const MAP_DEFINITIONS = { water: WATER_MAP };
export const MAP_ORDER = ["water"];

export function getMapDefinition(mapId) {
  return MAP_DEFINITIONS[mapId] ?? null;
}

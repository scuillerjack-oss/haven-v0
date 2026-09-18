import { SAVE_VERSION } from "./balance.js";
import { createInitialState, createMapState } from "./state.js";
import { PERKS } from "./meta.js";

// V0/V1-bêta (version 1) utilisait un modèle économique complètement
// différent (jardin abstrait à 4 productions). La V1 majeure le remplace
// par une vraie chaîne production→stockage→transport (section 0 : "ne
// pas reconstruire inutilement" s'applique à l'infrastructure — sauvegarde,
// PWA, audio — pas à un modèle de jeu que le cahier des charges redéfinit
// explicitement). Migrer une sauvegarde V0 ne peut donc pas transposer sa
// progression numérique (elle n'a plus de sens dans la nouvelle économie),
// mais NE DOIT PAS la supprimer silencieusement : on démarre une run V1
// neuve tout en conservant ce qui reste porteur de sens (préférences audio,
// et le fait que le joueur avait déjà commencé à jouer, journalisé en
// télémétrie).
function migrateV1ToV2(oldState) {
  const fresh = createInitialState(Date.now());
  if (oldState.audio) {
    fresh.audio.muted = Boolean(oldState.audio.muted);
    fresh.audio.volume = typeof oldState.audio.volume === "number" ? oldState.audio.volume : 0.5;
  }
  fresh.telemetry.migratedFromV0 = {
    at: Date.now(),
    previousVitality: oldState.vitality ?? null,
    previousTotalGrowth: oldState.totalGrowth ?? null,
  };
  fresh.version = 2;
  return fresh;
}

// V2 sépare le cycle du travailleur en deux étapes (outbound/return, voir
// mapEconomy.js) pour que la pause en cas de stockage plein tombe pile au
// bon endroit visuel — l'ancien modèle (un seul compteur cycleProgressMs +
// un booléen paused) est remplacé. La progression économique (argent,
// stockage, niveaux, Perles, atouts...) ne change pas ; seul l'état
// transitoire d'animation du travailleur est réinitialisé proprement.
function migrateV2ToV3(oldState) {
  const next = { ...oldState, version: 3 };
  if (next.maps && typeof next.maps === "object") {
    const maps = {};
    for (const [mapId, mapState] of Object.entries(next.maps)) {
      if (mapState && typeof mapState === "object" && mapState.producer) {
        const { cycleProgressMs, paused, ...restProducer } = mapState.producer;
        maps[mapId] = { ...mapState, producer: { ...restProducer, stage: "outbound", stageProgressMs: 0, awaitingRoom: false } };
      } else {
        maps[mapId] = mapState;
      }
    }
    next.maps = maps;
  }
  return next;
}

export const migrations = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
};

// Filet de sécurité contre les champs absents (section 22 : une
// sauvegarde de la version courante peut malgré tout avoir été altérée
// à la main, tronquée par un stockage plein, ou provenir d'un ancien
// build de cette même V1 avec un champ en moins). Ne remplace jamais un
// champ présent, ne fabrique que ce qui manque.
function fillMissingDefaults(state) {
  const fresh = createInitialState(typeof state.createdAt === "number" ? state.createdAt : Date.now());
  const perks = { ...fresh.perks, ...(state.perks && typeof state.perks === "object" ? state.perks : {}) };
  for (const id of Object.keys(PERKS)) {
    if (typeof perks[id] !== "number") perks[id] = 0;
  }

  const maps = state.maps && typeof state.maps === "object" ? { ...state.maps } : fresh.maps;
  for (const mapId of Object.keys(fresh.maps)) {
    if (!maps[mapId] || typeof maps[mapId] !== "object") {
      maps[mapId] = createMapState();
      continue;
    }
    const producer = maps[mapId].producer;
    if (!producer || typeof producer.stage !== "string" || typeof producer.stageProgressMs !== "number") {
      maps[mapId] = { ...maps[mapId], producer: { ...createMapState().producer, ...(producer ?? {}) } };
    }
  }

  return {
    ...fresh,
    ...state,
    audio: { ...fresh.audio, ...(state.audio && typeof state.audio === "object" ? state.audio : {}) },
    tutorial: { seen: { ...(state.tutorial?.seen && typeof state.tutorial.seen === "object" ? state.tutorial.seen : {}) } },
    telemetry: { ...fresh.telemetry, ...(state.telemetry && typeof state.telemetry === "object" ? state.telemetry : {}) },
    perks,
    maps,
  };
}

// Rejette proprement une sauvegarde illisible ou d'une version future
// inconnue, plutôt que de planter ou de silencieusement corrompre l'état.
export function migrateSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.version !== "number" || raw.version < 1) return null;
  if (raw.version > SAVE_VERSION) return null;

  let state = raw;
  let version = state.version;
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return null;
    state = step(state);
    version = state.version;
  }
  return fillMissingDefaults(state);
}

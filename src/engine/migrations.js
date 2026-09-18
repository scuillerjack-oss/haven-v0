import { SAVE_VERSION } from "./balance.js";
import { createInitialState } from "./state.js";

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

export const migrations = {
  1: migrateV1ToV2,
};

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
  return state;
}

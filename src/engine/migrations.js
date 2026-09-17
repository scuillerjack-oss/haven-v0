import { SAVE_VERSION } from "./balance.js";

// Registre de migrations entre versions de sauvegarde : migrations[N] prend
// un état sauvegardé en version N et retourne un état valide en version N+1.
// Vide pour l'instant (V0 = version 1) — prêt à recevoir des étapes futures
// sans jamais casser une sauvegarde existante.
export const migrations = {};

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
    version += 1;
    state.version = version;
  }
  return state;
}

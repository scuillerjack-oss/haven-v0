// Instrumentation locale simple, jamais envoyée nulle part (section 19) :
// durée de session et retours, ordre/fréquence des achats, moments de
// saturation, gain hors-ligne, disponibilité et exécution du prestige.

const MAX_ENTRIES = 80;

function pushCapped(list, entry) {
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
}

export function recordSessionStart(state, now = Date.now()) {
  pushCapped(state.telemetry.sessions, { start: now });
}

export function recordSessionEnd(state, now = Date.now()) {
  const sessions = state.telemetry.sessions;
  const last = sessions[sessions.length - 1];
  if (last && !last.end) {
    last.end = now;
    last.durationMs = now - last.start;
  }
}

export function recordReturn(state, { elapsedMs, moneyEarned, cappedAway }, now = Date.now()) {
  pushCapped(state.telemetry.returns, { at: now, elapsedMs, moneyEarned, cappedAway });
}

export function recordUpgradePurchase(state, { mapId, pathId, level }, now = Date.now()) {
  if (!state.telemetry.upgrades) state.telemetry.upgrades = [];
  pushCapped(state.telemetry.upgrades, { at: now, mapId, pathId, level });
}

// Ne journalise que le front montant (début d'une saturation), pour ne
// pas noyer le journal d'une entrée par tick tant que ça reste bloqué.
export function recordSaturationEdge(state, { mapId }, now = Date.now()) {
  if (!state.telemetry.saturations) state.telemetry.saturations = [];
  pushCapped(state.telemetry.saturations, { at: now, mapId });
}

export function recordPrestigeAvailableOnce(state, now = Date.now()) {
  if (state.telemetry.prestigeAvailableAt) return;
  state.telemetry.prestigeAvailableAt = now;
}

export function totalPlaytimeMs(state) {
  return state.telemetry.sessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
}

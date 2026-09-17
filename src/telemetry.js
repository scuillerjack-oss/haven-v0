// Instrumentation locale simple, jamais envoyée nulle part : durée de
// session, paliers atteints, retours (avec l'écart réel constaté), et
// progression. Sert à observer le vrai test — l'envie de revenir — sans
// jamais faire passer une simulation accélérée pour une preuve réelle.

const MAX_ENTRIES = 50;

function pushCapped(list, entry) {
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
}

export function recordSessionStart(state, now = Date.now()) {
  state.stats.sessionsCount += 1;
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

export function recordReturn(state, { elapsedMs, gained, cappedAway }, now = Date.now()) {
  pushCapped(state.telemetry.returns, {
    at: now,
    elapsedMs,
    gained,
    cappedAway,
  });
}

export function recordMilestone(state, stage, now = Date.now()) {
  pushCapped(state.telemetry.milestones, { stageId: stage.id, name: stage.name, at: now });
}

export function totalPlaytimeMs(state) {
  return state.telemetry.sessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
}

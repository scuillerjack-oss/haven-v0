import { SAVE_VERSION } from "./balance.js";
import { PERKS } from "./meta.js";

export function createMapState() {
  return {
    producer: {
      bucketLevel: 1,
      movementLevel: 1,
      winchLevel: 1,
      wellLevel: 1,
      cycleProgressMs: 0,
      paused: false,
    },
    buffer: { level: 1, currentLiters: 0 },
    transport: { capacityLevel: 1, frequencyLevel: 1, timerMs: 0 },
    globalProductivityLevel: 1,
    totalLitersShipped: 0,
  };
}

function initialPerks() {
  return Object.fromEntries(Object.keys(PERKS).map((id) => [id, 0]));
}

export function createInitialState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    lastTick: now,

    money: 0,
    totalMoneyEarnedThisRun: 0,
    perles: 0,
    prestigeCount: 0,

    currentMapId: "water",
    maps: { water: createMapState() },

    perks: initialPerks(),

    audio: { muted: false, volume: 0.5 },

    tutorial: { seen: {} }, // jamais réinitialisé par une Renaissance.

    telemetry: {
      sessions: [],
      returns: [],
      unlocks: [],
      prestiges: [],
    },

    ui: { helpOpen: false, prestigeOpen: false },

    pendingWelcomeBack: null,
  };
}

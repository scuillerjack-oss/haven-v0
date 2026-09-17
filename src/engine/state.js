import { SAVE_VERSION } from "./balance.js";

export function createInitialState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    vitality: 0,
    totalGrowth: 0,
    createdAt: now,
    lastTick: now,
    lastSeen: now,
    productions: {
      source: { level: 1 },
      soil: { level: 0 },
      flora: { level: 0 },
      fauna: { level: 0 },
    },
    globalUpgrades: {
      meditationPath: false,
      nightDew: false,
    },
    stats: {
      totalTaps: 0,
      lifetimeVitality: 0,
      sessionsCount: 0,
    },
    audio: {
      muted: false,
      volume: 0.5,
    },
    ui: {
      onboardingStep: 0,
      onboardingDone: false,
    },
    telemetry: {
      sessions: [],
      milestones: [],
      returns: [],
    },
    pendingWelcomeBack: null,
  };
}

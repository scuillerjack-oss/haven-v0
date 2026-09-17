import "./style.css";
import { loadState, saveState } from "./save.js";
import {
  applyTick,
  applyTap,
  applyOfflineProgress,
  purchaseProductionUpgrade,
  purchaseGlobalUpgrade,
  crossedStages,
} from "./engine/simulation.js";
import { TICK_MS, STAGES, stageForGrowth } from "./engine/balance.js";
import { shellMarkup, buildDrawerContent, countAffordableUpgrades, currentRateLabel } from "./ui/hud.js";
import { applyStageVisuals } from "./ui/scene.js";
import { renderOnboarding } from "./ui/onboarding.js";
import { renderWelcomeBackBody } from "./ui/welcomeBack.js";
import { formatNumber } from "./ui/format.js";
import { recordSessionStart, recordSessionEnd, recordReturn, recordMilestone } from "./telemetry.js";
import { AmbientAudio } from "./audio/audio.js";

const LIVE_TICK_THRESHOLD_MS = 4000; // au-delà : la boucle a été suspendue (onglet en arrière-plan), pas un tick régulier.
const WELCOME_MODAL_THRESHOLD_MS = 30_000; // en dessous : reprise silencieuse, pas de popup pour un simple rechargement.
const SAVE_INTERVAL_MS = 5000;

const STAGES_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

const root = document.getElementById("app");
root.innerHTML = shellMarkup();

const els = {
  vitalityValue: document.getElementById("vitality-value"),
  vitalityRate: document.getElementById("vitality-rate"),
  sceneRoot: document.querySelector(".haven-scene"),
  stageName: document.getElementById("stage-name"),
  stageDesc: document.getElementById("stage-desc"),
  tapZone: document.getElementById("tap-zone"),
  floaters: document.getElementById("floaters"),
  drawer: document.getElementById("drawer"),
  drawerHandle: document.getElementById("drawer-handle"),
  drawerContent: document.getElementById("drawer-content"),
  drawerBadge: document.getElementById("drawer-badge"),
  onboarding: document.getElementById("onboarding"),
  welcomeModal: document.getElementById("welcome-modal"),
  welcomeBody: document.getElementById("welcome-body"),
  welcomeContinue: document.getElementById("welcome-continue"),
  audioToggle: document.getElementById("audio-toggle"),
  audioIcon: document.getElementById("audio-icon"),
  volumeRange: document.getElementById("volume-range"),
};

const { state, rejected } = loadState(Date.now());
if (rejected) {
  console.warn("Sauvegarde précédente illisible ou incompatible : nouvelle partie démarrée proprement.");
}

const audio = new AmbientAudio();
audio.setMuted(state.audio.muted);
audio.setVolume(state.audio.volume);
els.volumeRange.value = String(Math.round(state.audio.volume * 100));
updateAudioIcon();

let audioStarted = false;
function ensureAudioStarted() {
  if (audioStarted) return;
  audioStarted = true;
  audio.start();
  audio.resume();
}

function updateAudioIcon() {
  els.audioIcon.textContent = state.audio.muted ? "🔇" : "🔈";
  els.audioToggle.setAttribute("aria-pressed", String(state.audio.muted));
}

// --- Réconciliation du temps écoulé (reprise après rechargement ou absence) ---
// Applique uniquement le gain de vitalité. La détection de palier (rendu +
// télémétrie) est centralisée dans syncStage(), appelée juste après par
// chaque appelant — sinon un tap qui franchit un seuil entre deux ticks de
// boucle ne serait jamais détecté (le delta du tick ne voit que sa propre
// petite avance, pas le saut fait entre-temps par le tap).

function reconcileElapsed(elapsedMs, { isColdStart }) {
  if (elapsedMs <= 0) return;

  if (elapsedMs < LIVE_TICK_THRESHOLD_MS) {
    applyTick(state, elapsedMs, Date.now());
    return;
  }

  const prevGrowth = state.totalGrowth;
  const result = applyOfflineProgress(state, elapsedMs);
  const crossedIds = crossedStages(prevGrowth, state.totalGrowth);
  recordReturn(state, { elapsedMs: result.elapsedMs, gained: result.gained, cappedAway: result.cappedAway });

  if (isColdStart && elapsedMs >= WELCOME_MODAL_THRESHOLD_MS && result.gained > 0) {
    showWelcomeBack(result, crossedIds);
  }
}

function showWelcomeBack(offlineResult, crossedIds) {
  const crossedStageNames = crossedIds.map((id) => STAGES_BY_ID[id]?.name).filter(Boolean);
  els.welcomeBody.innerHTML = renderWelcomeBackBody({
    elapsedMs: offlineResult.elapsedMs,
    gained: offlineResult.gained,
    cappedAway: offlineResult.cappedAway,
    capMs: offlineResult.capMs,
    crossedStageNames,
  });
  els.welcomeModal.hidden = false;
}

els.welcomeContinue.addEventListener("click", () => {
  els.welcomeModal.hidden = true;
  persist();
});

let lastTickTime = Date.now();
let lastSaveTime = Date.now();
let affordabilityDirty = false;

// Palier actuellement affiché : la seule source de vérité pour savoir si le
// monde vient de changer (déclenche rendu + télémétrie), qu'il ait été
// franchi par un tap instantané, par la croissance passive, ou pendant une
// absence. Initialisé sur l'état TEL QUE CHARGÉ, avant tout rattrapage —
// pour que le rattrapage du démarrage compte bien comme une progression.
let displayedStageId = stageForGrowth(state.totalGrowth).id;

function syncStage() {
  const stage = stageForGrowth(state.totalGrowth);
  if (stage.id === displayedStageId) return false;
  for (let id = displayedStageId + 1; id <= stage.id; id += 1) {
    recordMilestone(state, STAGES_BY_ID[id]);
  }
  displayedStageId = stage.id;
  renderStage();
  renderDrawer();
  advanceOnboardingOnStage();
  return true;
}

// --- Boot : réconcilie le temps passé hors de l'app, puis démarre la boucle ---

const bootNow = Date.now();
reconcileElapsed(bootNow - (state.lastSeen ?? bootNow), { isColdStart: true });
recordSessionStart(state, bootNow);
state.lastSeen = bootNow;
state.lastTick = bootNow;

syncStage();
renderStage();
renderDrawer();
renderOnboardingStep();
updateNumbers();

// --- Boucle principale (ticks réguliers pendant que l'app est ouverte) ---

function loop() {
  const now = Date.now();
  const delta = now - lastTickTime;
  lastTickTime = now;

  reconcileElapsed(delta, { isColdStart: false });
  if (!syncStage()) {
    maybeRefreshDrawerAffordability();
  }

  updateNumbers();
  state.lastSeen = now;

  if (now - lastSaveTime >= SAVE_INTERVAL_MS) {
    persist();
    lastSaveTime = now;
  }
}

setInterval(loop, TICK_MS);

// --- Rendu ---

function updateNumbers() {
  els.vitalityValue.textContent = formatNumber(state.vitality);
  els.vitalityRate.textContent = currentRateLabel(state);
}

function renderStage() {
  const stage = stageForGrowth(state.totalGrowth);
  applyStageVisuals(els.sceneRoot, stage.id);
  els.stageName.textContent = stage.name;
  els.stageDesc.textContent = stage.description;
}

function renderDrawer() {
  els.drawerContent.innerHTML = buildDrawerContent(state);
  const count = countAffordableUpgrades(state);
  els.drawerBadge.hidden = count === 0;
  if (count > 0) els.drawerBadge.textContent = String(count);
  affordabilityDirty = false;
}

function maybeRefreshDrawerAffordability() {
  // Rafraîchit le tiroir seulement s'il est ouvert ou si un achat/tap a pu
  // changer ce qui est achetable : pas de re-rendu inutile à chaque frame.
  if (els.drawer.dataset.open === "true" || affordabilityDirty) {
    renderDrawer();
  }
}

function persist() {
  saveState(state);
}

// --- Interactions ---

els.tapZone.addEventListener("pointerdown", (event) => {
  ensureAudioStarted();
  const { gained } = applyTap(state, Date.now());
  spawnFloater(event, gained);
  affordabilityDirty = true;
  syncStage();
  updateNumbers();
  advanceOnboardingOnTap();
});

function spawnFloater(event, amount) {
  const rect = els.floaters.getBoundingClientRect();
  const x = (event.clientX ?? rect.width / 2) - rect.left;
  const y = (event.clientY ?? rect.height / 2) - rect.top;
  const el = document.createElement("div");
  el.className = "floater";
  el.textContent = `+${formatNumber(amount)}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  els.floaters.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

els.drawerHandle.addEventListener("click", () => {
  const isOpen = els.drawer.dataset.open === "true";
  els.drawer.dataset.open = String(!isOpen);
  els.drawerHandle.setAttribute("aria-expanded", String(!isOpen));
  if (!isOpen) {
    renderDrawer();
    advanceOnboardingOnDrawerOpen();
  }
});

els.drawerContent.addEventListener("click", (event) => {
  const buyProduction = event.target.closest("[data-buy-production]");
  const buyGlobal = event.target.closest("[data-buy-global]");
  if (buyProduction) {
    const result = purchaseProductionUpgrade(state, buyProduction.dataset.buyProduction);
    if (result.ok) {
      renderDrawer();
      updateNumbers();
      persist();
    }
  } else if (buyGlobal) {
    const result = purchaseGlobalUpgrade(state, buyGlobal.dataset.buyGlobal);
    if (result.ok) {
      renderDrawer();
      updateNumbers();
      persist();
    }
  }
});

els.audioToggle.addEventListener("click", () => {
  ensureAudioStarted();
  state.audio.muted = !state.audio.muted;
  audio.setMuted(state.audio.muted);
  updateAudioIcon();
  persist();
});

els.volumeRange.addEventListener("input", () => {
  ensureAudioStarted();
  const value = Number(els.volumeRange.value) / 100;
  state.audio.volume = value;
  audio.setVolume(value);
});
els.volumeRange.addEventListener("change", persist);

// --- Onboarding (3 indices maximum, chacun disparaît dès l'action faite) ---

function renderOnboardingStep() {
  renderOnboarding(els.onboarding, state.ui.onboardingStep);
}

function advanceOnboardingOnTap() {
  if (state.ui.onboardingStep === 0) {
    state.ui.onboardingStep = 1;
    renderOnboardingStep();
  }
}

function advanceOnboardingOnStage() {
  if (state.ui.onboardingStep === 1 && state.totalGrowth >= 10) {
    state.ui.onboardingStep = 2;
    renderOnboardingStep();
  }
}

function advanceOnboardingOnDrawerOpen() {
  if (state.ui.onboardingStep >= 2 && !state.ui.onboardingDone) {
    state.ui.onboardingStep = 3;
    state.ui.onboardingDone = true;
    renderOnboardingStep();
  }
}

// --- Cycle de vie / sauvegarde ---

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    state.lastSeen = Date.now();
    recordSessionEnd(state, Date.now());
    persist();
    return;
  }

  const now = Date.now();
  const gap = now - (state.lastSeen ?? now);
  reconcileElapsed(gap, { isColdStart: true });
  syncStage();
  recordSessionStart(state, now);
  lastTickTime = now;
  state.lastSeen = now;
  updateNumbers();
});

window.addEventListener("beforeunload", () => {
  state.lastSeen = Date.now();
  recordSessionEnd(state, Date.now());
  persist();
});

import "./style.css";
import { loadState, saveState } from "./save.js";
import {
  applyTick,
  applyOfflineProgress,
  purchaseMapUpgrade,
  purchasePerk,
  performRenaissance,
  canRenaissance,
  perlesEarnable,
  getModifiers,
} from "./engine/simulation.js";
import { getMapDefinition } from "./engine/mapDefinitions.js";
import { currentProducerPhase, bufferCapacity, transportIntervalMs, bottleneckKind } from "./engine/mapEconomy.js";
import { TICK_MS } from "./engine/balance.js";
import {
  shellMarkup,
  buildUpgradesTab,
  buildPerksTab,
  countAffordableUpgrades,
  moneyLabel,
  prestigeButtonLabel,
} from "./ui/hud.js";
import { updateSceneAnimation } from "./ui/scene.js";
import { showTutorialOnce, hideTutorial, helpBodyMarkup } from "./ui/onboarding.js";
import { renderWelcomeBackBody } from "./ui/welcomeBack.js";
import { renderPrestigeBody } from "./ui/prestige.js";
import { formatNumber } from "./ui/format.js";
import {
  recordSessionStart,
  recordSessionEnd,
  recordReturn,
  recordUpgradePurchase,
  recordSaturationEdge,
  recordPrestigeAvailableOnce,
} from "./telemetry.js";
import { AmbientAudio } from "./audio/audio.js";

const LIVE_TICK_THRESHOLD_MS = 4000; // au-delà : la boucle a été suspendue, pas un tick régulier.
const WELCOME_MODAL_THRESHOLD_MS = 30_000; // en dessous : reprise silencieuse.
const SAVE_INTERVAL_MS = 5000;

const WORKER_FAMILY_PATHS = new Set(["bucket", "movement", "winch"]);
const TRANSPORT_PATHS = new Set(["transportCapacity", "transportFrequency"]);

const BOTTLENECK_TEXT = {
  storageFull: { title: "Stockage plein", desc: "Le travailleur attend qu'une place se libère." },
  transport: { title: "Le transport limite le débit", desc: "La citerne est le maillon le plus juste." },
  production: { title: "La production limite le débit", desc: "Le camion attend souvent avec de la place libre." },
};

const root = document.getElementById("app");
root.innerHTML = shellMarkup();

const els = {
  moneyValue: document.getElementById("money-value"),
  sceneRoot: document.querySelector(".haven-scene"),
  floaters: document.getElementById("floaters"),
  bottleneckTitle: document.getElementById("bottleneck-title"),
  bottleneckDesc: document.getElementById("bottleneck-desc"),
  drawer: document.getElementById("drawer"),
  drawerHandle: document.getElementById("drawer-handle"),
  drawerTabs: document.getElementById("drawer-tabs"),
  drawerContent: document.getElementById("drawer-content"),
  drawerBadge: document.getElementById("drawer-badge"),
  prestigeOpenBtn: document.getElementById("prestige-open-btn"),
  onboarding: document.getElementById("onboarding"),
  helpToggle: document.getElementById("help-toggle"),
  helpModal: document.getElementById("help-modal"),
  helpBody: document.getElementById("help-body"),
  helpClose: document.getElementById("help-close"),
  welcomeModal: document.getElementById("welcome-modal"),
  welcomeBody: document.getElementById("welcome-body"),
  welcomeContinue: document.getElementById("welcome-continue"),
  prestigeModal: document.getElementById("prestige-modal"),
  prestigeBody: document.getElementById("prestige-body"),
  prestigeConfirm: document.getElementById("prestige-confirm"),
  prestigeCancel: document.getElementById("prestige-cancel"),
  audioToggle: document.getElementById("audio-toggle"),
  audioIcon: document.getElementById("audio-icon"),
  volumeRange: document.getElementById("volume-range"),
};

const { state, rejected } = loadState(Date.now());
if (rejected) {
  console.warn("Sauvegarde précédente illisible ou incompatible : nouvelle partie démarrée proprement.");
}

let activeTab = "upgrades";

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

// --- Réconciliation du temps écoulé ---

function reconcileElapsed(elapsedMs, { isColdStart }) {
  if (elapsedMs <= 0) return;

  if (elapsedMs < LIVE_TICK_THRESHOLD_MS) {
    lastTickResult = applyTick(state, elapsedMs);
    return;
  }

  const result = applyOfflineProgress(state, elapsedMs);
  recordReturn(state, { elapsedMs: result.elapsedMs, moneyEarned: result.moneyEarned, cappedAway: result.cappedAway });

  if (isColdStart && elapsedMs >= WELCOME_MODAL_THRESHOLD_MS && result.moneyEarned > 0) {
    showTutorialOnce(state, els.onboarding, "firstOfflineCollect");
    els.welcomeBody.innerHTML = renderWelcomeBackBody({
      elapsedMs: result.elapsedMs,
      moneyEarned: result.moneyEarned,
      cappedAway: result.cappedAway,
      capMs: result.capMs,
    });
    els.welcomeModal.hidden = false;
  }
}

els.welcomeContinue.addEventListener("click", () => {
  els.welcomeModal.hidden = true;
  persist();
});

let lastTickTime = Date.now();
let lastSaveTime = Date.now();
let lastTickResult = null;
let wasPausedBefore = false;

// --- Boot ---

const bootNow = Date.now();
reconcileElapsed(bootNow - (state.lastSeen ?? bootNow), { isColdStart: true });
recordSessionStart(state, bootNow);
state.lastSeen = bootNow;
state.lastTick = bootNow;

renderMoney();
renderDrawer();
renderPrestigeButton();
renderScene();

// --- Boucle principale ---

function loop() {
  const now = Date.now();
  const delta = now - lastTickTime;
  lastTickTime = now;

  reconcileElapsed(delta, { isColdStart: false });
  renderMoney();
  renderScene();
  refreshDrawerIfNeeded();
  renderPrestigeButton();

  if (canRenaissance(state)) recordPrestigeAvailableOnce(state, now);

  state.lastSeen = now;
  if (now - lastSaveTime >= SAVE_INTERVAL_MS) {
    persist();
    lastSaveTime = now;
  }
}

let loopIntervalId = null;
function startLoop() {
  if (loopIntervalId !== null) return;
  loopIntervalId = setInterval(loop, TICK_MS);
}
function restartLoop() {
  if (loopIntervalId !== null) {
    clearInterval(loopIntervalId);
    loopIntervalId = null;
  }
  startLoop();
}
startLoop();

// --- Rendu ---

function renderMoney() {
  els.moneyValue.textContent = moneyLabel(state);
}

function renderScene() {
  const mapDef = getMapDefinition(state.currentMapId);
  const mapState = state.maps[state.currentMapId];
  const modifiers = getModifiers(state);
  const phase = currentProducerPhase(mapState, mapDef, modifiers);
  const capacity = bufferCapacity(mapState, mapDef, modifiers);
  const bufferRatio = capacity > 0 ? mapState.buffer.currentLiters / capacity : 0;
  const intervalMs = transportIntervalMs(mapState, mapDef, modifiers);
  const truckRatio = intervalMs > 0 ? mapState.transport.timerMs / intervalMs : 0;
  const shipped = lastTickResult?.perMap?.[state.currentMapId]?.litersShipped ?? 0;
  const moneyFromShip = lastTickResult?.perMap?.[state.currentMapId]?.moneyEarned ?? 0;

  updateSceneAnimation(els.sceneRoot, {
    phase,
    bufferRatio,
    truckRatio,
    isShipping: shipped > 0,
    walking: !phase.paused && (phase.key === "walkToWell" || phase.key === "walkToStorage" || phase.key === "walkBack"),
  });

  if (shipped > 0) spawnFloater(`+${formatNumber(moneyFromShip)}`);

  const kind = bottleneckKind(mapState, mapDef, modifiers);
  els.bottleneckTitle.textContent = BOTTLENECK_TEXT[kind].title;
  els.bottleneckDesc.textContent = BOTTLENECK_TEXT[kind].desc;

  if (phase.paused && !wasPausedBefore) {
    showTutorialOnce(state, els.onboarding, "firstSaturation");
    recordSaturationEdge(state, { mapId: state.currentMapId });
  }
  wasPausedBefore = phase.paused;
}

function spawnFloater(text) {
  const rect = els.floaters.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "floater";
  el.textContent = text;
  el.style.left = `${rect.width * 0.62}px`;
  el.style.top = `${rect.height * 0.68}px`;
  els.floaters.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function renderDrawer() {
  els.drawerContent.innerHTML = activeTab === "upgrades" ? buildUpgradesTab(state) : buildPerksTab(state);
  const count = countAffordableUpgrades(state);
  els.drawerBadge.hidden = count === 0;
  if (count > 0) els.drawerBadge.textContent = String(count);
}

function refreshDrawerIfNeeded() {
  if (els.drawer.dataset.open === "true") {
    renderDrawer(); // ouvert : garde les boutons "achetable" à jour pendant que l'argent rentre.
  } else {
    const count = countAffordableUpgrades(state);
    els.drawerBadge.hidden = count === 0;
    if (count > 0) els.drawerBadge.textContent = String(count);
  }
}

function renderPrestigeButton() {
  const label = prestigeButtonLabel(state);
  els.prestigeOpenBtn.hidden = !label;
  if (label) els.prestigeOpenBtn.textContent = label;
}

function persist() {
  saveState(state);
}

// --- Interactions : tiroir ---

els.drawerHandle.addEventListener("click", () => {
  const isOpen = els.drawer.dataset.open === "true";
  els.drawer.dataset.open = String(!isOpen);
  els.drawerHandle.setAttribute("aria-expanded", String(!isOpen));
  if (!isOpen) renderDrawer();
});

els.drawerTabs.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-tab]");
  if (!btn) return;
  activeTab = btn.dataset.tab;
  els.drawerTabs.querySelectorAll(".drawer-tab").forEach((t) => t.classList.toggle("is-active", t === btn));
  renderDrawer();
});

els.drawerContent.addEventListener("click", (event) => {
  const buyPath = event.target.closest("[data-buy-path]");
  const buyPerk = event.target.closest("[data-buy-perk]");
  if (buyPath) {
    const pathId = buyPath.dataset.buyPath;
    const mapDef = getMapDefinition(state.currentMapId);
    const mapState = state.maps[state.currentMapId];
    const result = purchaseMapUpgrade(state, mapState, mapDef, pathId);
    if (result.ok) {
      recordUpgradePurchase(state, { mapId: state.currentMapId, pathId, level: result.level });
      showTutorialOnce(state, els.onboarding, "firstUpgrade");
      if (pathId === "well") showTutorialOnce(state, els.onboarding, "firstWellUpgrade");
      if (WORKER_FAMILY_PATHS.has(pathId)) showTutorialOnce(state, els.onboarding, "firstWorkerUpgrade");
      if (TRANSPORT_PATHS.has(pathId)) showTutorialOnce(state, els.onboarding, "firstTransportUpgrade");
      renderDrawer();
      renderMoney();
      persist();
    }
  } else if (buyPerk) {
    const result = purchasePerk(state, buyPerk.dataset.buyPerk);
    if (result.ok) {
      renderDrawer();
      persist();
    }
  }
});

// --- Aide ---

els.helpToggle.addEventListener("click", () => {
  els.helpBody.innerHTML = helpBodyMarkup();
  els.helpModal.hidden = false;
});
els.helpClose.addEventListener("click", () => {
  els.helpModal.hidden = true;
});

// --- Prestige ---

els.prestigeOpenBtn.addEventListener("click", () => {
  els.prestigeBody.innerHTML = renderPrestigeBody(state);
  els.prestigeModal.hidden = false;
});
els.prestigeCancel.addEventListener("click", () => {
  els.prestigeModal.hidden = true;
});
els.prestigeConfirm.addEventListener("click", () => {
  const result = performRenaissance(state);
  els.prestigeModal.hidden = true;
  if (result.ok) {
    hideTutorial(els.onboarding);
    renderDrawer();
    renderMoney();
    renderScene();
    renderPrestigeButton();
    persist();
  }
});

// --- Audio ---

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

document.body.addEventListener(
  "pointerdown",
  () => {
    ensureAudioStarted();
  },
  { once: true }
);

// --- Cycle de vie / sauvegarde (voir diagnostic détaillé du bug mobile
// dans l'historique Git du jalon 1 : redondance de signaux + try/finally) ---

function handleSuspend() {
  try {
    recordSessionEnd(state, Date.now());
    persist();
  } catch (err) {
    console.error("HAVEN: erreur pendant la mise en veille", err);
  } finally {
    state.lastSeen = Date.now();
  }
}

let lastResumeAt = 0;
function handleResume() {
  const now = Date.now();
  if (now - lastResumeAt < 250) return;
  lastResumeAt = now;
  try {
    const gap = now - (state.lastSeen ?? now);
    reconcileElapsed(gap, { isColdStart: true });
    recordSessionStart(state, now);
  } catch (err) {
    console.error("HAVEN: erreur pendant la reprise, l'état reste jouable", err);
  } finally {
    restartLoop();
    if (audioStarted) audio.resume();
    lastTickTime = now;
    state.lastSeen = now;
    renderMoney();
    renderScene();
    renderDrawer();
    renderPrestigeButton();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") handleSuspend();
  else handleResume();
});
window.addEventListener("pagehide", handleSuspend);
window.addEventListener("pageshow", handleResume);
window.addEventListener("blur", handleSuspend);
window.addEventListener("focus", handleResume);
window.addEventListener("beforeunload", handleSuspend);

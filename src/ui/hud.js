import { sceneMarkup } from "./scene.js";
import { formatNumber } from "./format.js";
import {
  PRODUCTIONS,
  PRODUCTION_ORDER,
  GLOBAL_UPGRADES,
  productionLevelData,
  nextProductionUpgrade,
} from "../engine/balance.js";
import { isProductionUnlocked, isGlobalUpgradeUnlocked, productionPerSecond } from "../engine/simulation.js";

export function shellMarkup() {
  return `
    <div class="app">
      <header class="topbar">
        <div class="resource">
          <span class="resource-value" id="vitality-value">0</span>
          <span class="resource-label">Vitalité</span>
          <span class="resource-rate" id="vitality-rate">+0,0/s</span>
        </div>
        <div class="audio-controls">
          <input type="range" id="volume-range" class="volume-range" min="0" max="100" value="50" aria-label="Volume" />
          <button class="icon-btn" id="audio-toggle" aria-label="Couper/activer le son" aria-pressed="false">
            <span id="audio-icon">🔈</span>
          </button>
        </div>
      </header>

      <main class="scene-wrap" id="scene-wrap">
        ${sceneMarkup()}
        <button class="tap-zone" id="tap-zone" aria-label="Puiser de l'eau"></button>
        <div class="floaters" id="floaters"></div>
        <div class="stage-caption">
          <strong id="stage-name">Terre stérile</strong>
          <span id="stage-desc"></span>
        </div>
      </main>

      <section class="drawer" id="drawer" data-open="false">
        <button class="drawer-handle" id="drawer-handle" aria-expanded="false">
          <span>Améliorations</span>
          <span class="drawer-badge" id="drawer-badge" hidden></span>
          <span class="drawer-chevron" aria-hidden="true">▲</span>
        </button>
        <div class="drawer-content" id="drawer-content"></div>
      </section>

      <div class="onboarding" id="onboarding" hidden></div>

      <div class="modal-backdrop" id="welcome-modal" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Bon retour</h2>
          <div id="welcome-body"></div>
          <button class="primary-btn" id="welcome-continue">Continuer</button>
        </div>
      </div>
    </div>
  `;
}

function productionCardMarkup(state, productionId) {
  const def = PRODUCTIONS[productionId];
  const level = state.productions[productionId]?.level ?? 0;
  const unlocked = isProductionUnlocked(state, productionId);

  if (!unlocked) {
    return `
      <article class="card card-locked" data-production="${productionId}">
        <h3>${def.name}</h3>
        <p class="card-locked-hint">Se débloque à ${formatNumber(def.unlockAt)} de vitalité cumulée.</p>
      </article>
    `;
  }

  const current = productionLevelData(productionId, level);
  const next = nextProductionUpgrade(productionId, level);
  const canAfford = next ? state.vitality >= next.cost : false;

  return `
    <article class="card" data-production="${productionId}">
      <h3>${def.name}</h3>
      <p class="card-current">${current ? current.label : "—"} · +${formatNumber(current?.rate ?? 0)}/s</p>
      ${
        next
          ? `<button class="buy-btn" data-buy-production="${productionId}" ${canAfford ? "" : "disabled"}>
               Acheter : ${next.label} — ${formatNumber(next.cost)}
             </button>`
          : `<p class="card-maxed">Niveau maximum atteint</p>`
      }
    </article>
  `;
}

function globalUpgradeCardMarkup(state, upgradeId) {
  const def = GLOBAL_UPGRADES[upgradeId];
  const owned = state.globalUpgrades[upgradeId];
  const unlocked = isGlobalUpgradeUnlocked(state, upgradeId);

  if (owned) {
    return `
      <article class="card card-owned" data-upgrade="${upgradeId}">
        <h3>${def.name}</h3>
        <p class="card-current">Acquis · ${def.description}</p>
      </article>
    `;
  }
  if (!unlocked) {
    return `
      <article class="card card-locked" data-upgrade="${upgradeId}">
        <h3>${def.name}</h3>
        <p class="card-locked-hint">Se débloque à ${formatNumber(def.unlockAt)} de vitalité cumulée.</p>
      </article>
    `;
  }
  const canAfford = state.vitality >= def.cost;
  return `
    <article class="card" data-upgrade="${upgradeId}">
      <h3>${def.name}</h3>
      <p class="card-current">${def.description}</p>
      <button class="buy-btn" data-buy-global="${upgradeId}" ${canAfford ? "" : "disabled"}>
        Acheter — ${formatNumber(def.cost)}
      </button>
    </article>
  `;
}

export function buildDrawerContent(state) {
  const productionCards = PRODUCTION_ORDER.map((id) => productionCardMarkup(state, id)).join("");
  const globalCards = Object.keys(GLOBAL_UPGRADES)
    .map((id) => globalUpgradeCardMarkup(state, id))
    .join("");
  return `<div class="card-grid">${productionCards}${globalCards}</div>`;
}

export function countAffordableUpgrades(state) {
  let count = 0;
  for (const id of PRODUCTION_ORDER) {
    if (!isProductionUnlocked(state, id)) continue;
    const level = state.productions[id]?.level ?? 0;
    const next = nextProductionUpgrade(id, level);
    if (next && state.vitality >= next.cost) count += 1;
  }
  for (const id of Object.keys(GLOBAL_UPGRADES)) {
    const def = GLOBAL_UPGRADES[id];
    if (state.globalUpgrades[id]) continue;
    if (!isGlobalUpgradeUnlocked(state, id)) continue;
    if (state.vitality >= def.cost) count += 1;
  }
  return count;
}

export function currentRateLabel(state) {
  return `+${formatNumber(productionPerSecond(state))}/s`;
}

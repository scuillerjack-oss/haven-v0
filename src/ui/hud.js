import { sceneMarkup } from "./scene.js";
import { formatNumber, formatUpgradeEffect } from "./format.js";
import { coinIcon, familyIconMarkup } from "./icons.js";
import { UPGRADE_PATH_IDS, nextUpgradeInfo, upgradeEffect } from "../engine/mapUpgrades.js";
import {
  PERKS,
  nextPerkInfo,
  perlesEarnable,
  canRenaissance,
  perkValue,
  RENAISSANCE_MIN_PERLES,
} from "../engine/meta.js";
import { getMapDefinition } from "../engine/mapDefinitions.js";

export function shellMarkup() {
  return `
    <div class="app">
      <header class="topbar">
        <div class="resource">
          ${coinIcon()}
          <span class="resource-value" id="money-value">0</span>
          <span class="resource-label">Argent</span>
        </div>
        <div class="topbar-actions">
          <button class="icon-btn" id="help-toggle" aria-label="Aide">?</button>
          <input type="range" id="volume-range" class="volume-range" min="0" max="100" value="50" aria-label="Volume" />
          <button class="icon-btn" id="audio-toggle" aria-label="Couper/activer le son" aria-pressed="false">
            <span id="audio-icon">🔈</span>
          </button>
        </div>
      </header>

      <main class="scene-wrap" id="scene-wrap">
        ${sceneMarkup()}
        <div class="floaters" id="floaters"></div>
        <div class="bottleneck-caption">
          <strong id="bottleneck-title"></strong>
          <span id="bottleneck-desc"></span>
        </div>
      </main>

      <section class="drawer" id="drawer" data-open="false">
        <button class="drawer-handle" id="drawer-handle" aria-expanded="false">
          <span>Améliorations</span>
          <span class="drawer-badge" id="drawer-badge" hidden></span>
          <span class="drawer-chevron" aria-hidden="true">▲</span>
        </button>
        <div class="drawer-tabs" id="drawer-tabs">
          <button class="drawer-tab is-active" data-tab="upgrades">Chaîne</button>
          <button class="drawer-tab" data-tab="perks">Atouts (Perles)</button>
        </div>
        <div class="drawer-content" id="drawer-content"></div>
        <button class="prestige-btn" id="prestige-open-btn" hidden>Renaissance disponible</button>
      </section>

      <div class="onboarding" id="onboarding"></div>

      <div class="modal-backdrop" id="help-modal" hidden>
        <div class="modal" role="dialog" aria-modal="true">
          <h2>Comment jouer</h2>
          <div id="help-body"></div>
          <button class="primary-btn" id="help-close">Fermer</button>
        </div>
      </div>

      <div class="modal-backdrop" id="welcome-modal" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Bon retour</h2>
          <div id="welcome-body"></div>
          <button class="primary-btn" id="welcome-continue">Continuer</button>
        </div>
      </div>

      <div class="modal-backdrop" id="prestige-modal" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="prestige-title">
          <h2 id="prestige-title">Renaissance</h2>
          <div id="prestige-body"></div>
          <button class="primary-btn" id="prestige-confirm">Renaître maintenant</button>
          <button class="secondary-btn" id="prestige-cancel">Continuer cette run</button>
        </div>
      </div>
    </div>
  `;
}

function upgradeCardMarkup(gameState, mapState, mapDef, pathId) {
  const info = nextUpgradeInfo(mapState, mapDef, pathId);
  const costMultiplier = 1 - perkValue(gameState, "upgradeCostReduction");
  const icon = familyIconMarkup(pathId);
  if (!info.next) {
    return `
      <article class="card card-maxed" data-path="${pathId}">
        <h3>${icon}${info.familyDef.name}</h3>
        <p class="card-maxed-text">Niveau maximum atteint</p>
      </article>
    `;
  }
  const cost = info.next.cost * costMultiplier;
  const canAfford = gameState.money >= cost;
  const effect = upgradeEffect(mapDef, pathId, info.current, info.next);
  return `
    <article class="card" data-path="${pathId}">
      <h3>${icon}${info.familyDef.name}</h3>
      <p class="card-levels">Niveau ${info.currentLevel} → ${info.next.level}</p>
      <p class="card-effect">${formatUpgradeEffect(effect)}</p>
      <button class="buy-btn" data-buy-path="${pathId}" ${canAfford ? "" : "disabled"}>
        ${info.next.label} — ${formatNumber(cost)}
      </button>
    </article>
  `;
}

export function buildUpgradesTab(gameState) {
  const mapDef = getMapDefinition(gameState.currentMapId);
  const mapState = gameState.maps[gameState.currentMapId];
  const cards = UPGRADE_PATH_IDS.map((id) => upgradeCardMarkup(gameState, mapState, mapDef, id)).join("");
  return `<div class="card-grid">${cards}</div>`;
}

function perkCardMarkup(gameState, perkId) {
  const info = nextPerkInfo(gameState, perkId);
  if (!info.next) {
    return `
      <article class="card card-maxed" data-perk="${perkId}">
        <h3>${info.def.name}</h3>
        <p class="card-maxed-text">Niveau maximum atteint</p>
      </article>
    `;
  }
  const canAfford = gameState.perles >= info.next.cost;
  return `
    <article class="card" data-perk="${perkId}">
      <h3>${info.def.name}</h3>
      <p class="card-current">${info.def.description}</p>
      <button class="buy-btn" data-buy-perk="${perkId}" ${canAfford ? "" : "disabled"}>
        Acheter — ${info.next.cost} Perles
      </button>
    </article>
  `;
}

export function buildPerksTab(gameState) {
  const cards = Object.keys(PERKS)
    .map((id) => perkCardMarkup(gameState, id))
    .join("");
  return `
    <div class="perles-header">Perles : <strong>${gameState.perles}</strong></div>
    <div class="card-grid">${cards}</div>
  `;
}

export function countAffordableUpgrades(gameState) {
  const mapDef = getMapDefinition(gameState.currentMapId);
  const mapState = gameState.maps[gameState.currentMapId];
  let count = 0;
  for (const id of UPGRADE_PATH_IDS) {
    const info = nextUpgradeInfo(mapState, mapDef, id);
    if (info.next && gameState.money >= info.next.cost) count += 1;
  }
  return count;
}

export function moneyLabel(gameState) {
  return formatNumber(gameState.money);
}

export function prestigeButtonLabel(gameState) {
  if (!canRenaissance(gameState)) return null;
  return `Renaissance disponible (+${perlesEarnable(gameState)} Perles)`;
}

export { RENAISSANCE_MIN_PERLES };

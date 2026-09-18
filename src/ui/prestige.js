import { perlesEarnable, PRESTIGE_PRODUCTION_BONUS_PER_RUN } from "../engine/meta.js";
import { formatNumber } from "./format.js";

// Écran de Renaissance (section 16) : jamais de reset accidentel — tout ce
// qui sera perdu, conservé et gagné est écrit noir sur blanc avant le
// bouton de confirmation.
export function renderPrestigeBody(gameState) {
  const earned = perlesEarnable(gameState);
  const nextBonusPercent = Math.round((gameState.prestigeCount + 1) * PRESTIGE_PRODUCTION_BONUS_PER_RUN * 100);
  return `
    <p>Vous gagnerez <strong>+${earned} Perles</strong> (vous en avez déjà ${gameState.perles}).</p>
    <p>Bonus permanent après cette Renaissance : <strong>+${nextBonusPercent}%</strong> de production sur toute chaîne, pour toujours.</p>
    <p class="prestige-list-title">Sera réinitialisé :</p>
    <ul class="prestige-list">
      <li>La progression de la map actuelle (niveaux de la chaîne)</li>
      <li>L'argent en cours</li>
    </ul>
    <p class="prestige-list-title">Sera conservé :</p>
    <ul class="prestige-list">
      <li>Les Perles et les atouts permanents déjà achetés</li>
      <li>Les explications déjà vues, les réglages audio</li>
    </ul>
  `;
}

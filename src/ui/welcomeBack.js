import { formatDuration, formatNumber } from "./format.js";

// Le retour doit montrer honnêtement ce qui s'est passé (section 10) :
// durée réelle, revenu réel (plafonné), et pourquoi si le plafond a joué.
export function renderWelcomeBackBody({ elapsedMs, moneyEarned, cappedAway, capMs }) {
  const parts = [];
  parts.push(`<p>Vous étiez absent <strong>${formatDuration(elapsedMs)}</strong>.</p>`);
  parts.push(`<p>La chaîne a continué de produire : <strong>+${formatNumber(moneyEarned)}</strong> d'argent.</p>`);
  if (cappedAway) {
    parts.push(
      `<p class="welcome-note">Le crédit hors-ligne est plafonné à ${formatDuration(capMs)} : le temps au-delà n'a rien rapporté de plus.</p>`
    );
  }
  return parts.join("");
}

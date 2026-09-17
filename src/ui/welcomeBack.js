import { formatDuration, formatNumber } from "./format.js";

// Le retour doit montrer honnêtement ce qui s'est passé : durée réelle de
// l'absence, gain réel (plafonné), et les transformations traversées.
// Jamais de formulation qui suggère que ce calcul hors-ligne "prouve" quoi
// que ce soit sur l'envie réelle de revenir.
export function renderWelcomeBackBody({ elapsedMs, gained, cappedAway, capMs, crossedStageNames }) {
  const parts = [];
  parts.push(`<p>Vous étiez absent <strong>${formatDuration(elapsedMs)}</strong>.</p>`);
  parts.push(`<p>Le Havre a continué de croître : <strong>+${formatNumber(gained)}</strong> de vitalité.</p>`);
  if (cappedAway) {
    parts.push(
      `<p class="welcome-note">Le crédit hors-ligne est plafonné à ${formatDuration(capMs)} : le temps au-delà n'a rien rapporté de plus.</p>`
    );
  }
  if (crossedStageNames.length > 0) {
    parts.push(
      `<p class="welcome-stages">Pendant votre absence : ${crossedStageNames.map((n) => `<strong>${n}</strong>`).join(" → ")}</p>`
    );
  }
  return parts.join("");
}

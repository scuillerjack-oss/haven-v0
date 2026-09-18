export function formatNumber(value) {
  const n = Math.max(0, value);
  if (n < 10) return n.toFixed(1);
  if (n < 1000) return Math.floor(n).toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

// Pour les durées de phase courtes (secondes, avec une décimale) — jamais
// pour les durées longues (hors-ligne, calendaires), où formatDuration
// reste la bonne unité.
export function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

// Affiche une grandeur concrète d'effet d'amélioration ("1 L", "1.8s",
// "+15%") sans bruit décimal inutile sur les valeurs entières.
function formatPlainNumber(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// "20 L" (avec espace) pour les litres, "1.8s"/"+15%" (sans espace) pour
// les durées et pourcentages — convention française usuelle des exemples
// du cahier des charges V2.
const EFFECT_UNIT = { liters: " L", seconds: "s", percent: "%" };

// Construit la ligne "valeur actuelle -> valeur suivante" à partir de
// upgradeEffect() (mapUpgrades.js) : jamais un pourcentage abstrait seul
// quand une grandeur concrète est disponible.
export function formatUpgradeEffect(effect) {
  if (!effect) return "";
  const unit = EFFECT_UNIT[effect.kind];
  const sign = effect.kind === "percent" ? "+" : "";
  const currentText = `${sign}${formatPlainNumber(effect.current)}${unit}`;
  const nextText = `${sign}${formatPlainNumber(effect.next)}${unit}`;
  return `${currentText} → ${nextText}${effect.suffix ? ` ${effect.suffix}` : ""}`;
}

export function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "moins d'une minute";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} j ${remHours} h` : `${days} j`;
}

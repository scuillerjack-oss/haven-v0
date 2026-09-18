// Onboarding contextuel (section 8) : la première partie de la Map 1 EST
// le tutoriel. Chaque mécanique importante déclenche une micro-explication
// UNE SEULE FOIS sur toute la partie de vie du joueur — jamais réinitialisé
// par un prestige (voir engine/state.js : `tutorial.seen` en dehors de la
// run réinitialisable).
//
// Simplification assumée par rapport au cahier des charges : l'explication
// apparaît au bon moment et reste jusqu'à la prochaine action pertinente,
// mais ne bloque pas physiquement le reste de l'interface (pas de overlay
// modal forcé) — cela reste un « agir pour comprendre », sans verrou dur.

export const TUTORIAL_MESSAGES = {
  firstUpgrade: "Chaque amélioration change quelque chose de visible : essayez-en une.",
  firstWellUpgrade: "Le puits produit plus vite : le seau se remplit plus tôt à chaque cycle.",
  firstWorkerUpgrade: "Le travailleur transporte plus, ou marche plus vite : le cycle entier raccourcit.",
  firstSaturation: "Le stockage est plein : le travailleur attend qu'une place se libère. Améliorez le stockage ou le transport.",
  firstTransportUpgrade: "Le camion peut charger plus, ou repasser plus souvent : deux façons d'évacuer plus vite.",
  firstOfflineCollect: "Voici ce que la chaîne a produit pendant votre absence.",
  firstMapUnlock: "Une nouvelle map devient accessible : la progression continue là-bas.",
};

export function showTutorialOnce(state, root, id) {
  if (state.tutorial.seen[id]) return false;
  state.tutorial.seen[id] = true;
  root.textContent = TUTORIAL_MESSAGES[id] ?? "";
  root.hidden = false;
  return true;
}

export function hideTutorial(root) {
  root.hidden = true;
}

export function helpBodyMarkup() {
  const items = Object.values(TUTORIAL_MESSAGES)
    .map((msg) => `<li>${msg}</li>`)
    .join("");
  return `<ul class="help-list">${items}</ul>`;
}

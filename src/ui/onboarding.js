// Onboarding contextuel (section 8) : la première partie de la Map 1 EST
// le tutoriel. Chaque mécanique importante déclenche une micro-explication
// UNE SEULE FOIS sur toute la partie de vie du joueur — jamais réinitialisé
// par un prestige (voir engine/state.js : `tutorial.seen` en dehors de la
// run réinitialisable).
//
// Simplification assumée par rapport au cahier des charges : l'explication
// apparaît au bon moment mais ne bloque pas physiquement le reste de
// l'interface (pas d'overlay modal forcé) — cela reste un « agir pour
// comprendre », sans verrou dur.
//
// V3 (section 5 du cahier des charges post-bêta) : ce message doit rester
// un feedback TEMPORAIRE, jamais affiché en continu ("toute la session"
// était le défaut signalé par la bêta humaine). Apparition immédiate,
// disparition douce après DISPLAY_MS, un nouveau message remplace
// proprement celui en cours (jamais de chevauchement, jamais deux
// disparitions programmées en même temps).

export const TUTORIAL_MESSAGES = {
  firstUpgrade: "Chaque amélioration change quelque chose de visible : essayez-en une.",
  firstWellUpgrade: "Le puits produit plus vite : le seau se remplit plus tôt à chaque cycle.",
  firstWorkerUpgrade: "Le travailleur transporte plus, ou marche plus vite : le cycle entier raccourcit.",
  firstSaturation: "Le stockage est plein : le travailleur attend qu'une place se libère. Améliorez le stockage ou le transport.",
  firstTransportUpgrade: "Le camion peut charger plus, ou repasser plus souvent : deux façons d'évacuer plus vite.",
  firstOfflineCollect: "Voici ce que la chaîne a produit pendant votre absence.",
  firstMapUnlock: "Une nouvelle map devient accessible : la progression continue là-bas.",
};

// "environ 2,5 à 3,5 secondes" (cahier des charges V3, section 5) — 3s au
// centre de cette fenêtre, une lecture confortable sans traîner.
const DISPLAY_MS = 3000;

let hideTimeoutId = null;

function showMessage(root, text) {
  if (hideTimeoutId !== null) {
    clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }
  root.textContent = text;
  root.classList.add("is-visible");
  hideTimeoutId = setTimeout(() => {
    root.classList.remove("is-visible");
    hideTimeoutId = null;
  }, DISPLAY_MS);
}

export function showTutorialOnce(state, root, id) {
  if (state.tutorial.seen[id]) return false;
  state.tutorial.seen[id] = true;
  showMessage(root, TUTORIAL_MESSAGES[id] ?? "");
  return true;
}

export function hideTutorial(root) {
  if (hideTimeoutId !== null) {
    clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }
  root.classList.remove("is-visible");
}

export function helpBodyMarkup() {
  const items = Object.values(TUTORIAL_MESSAGES)
    .map((msg) => `<li>${msg}</li>`)
    .join("");
  return `<ul class="help-list">${items}</ul>`;
}

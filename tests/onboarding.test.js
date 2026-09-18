// V3 (section 5 du cahier des charges post-bêta) : les messages
// contextuels après achat sont appréciés mais restaient affichés une
// durée excessive, voire toute la session. Ce fichier fige le
// comportement temporaire attendu : apparition immédiate, disparition
// après ~3s (fenêtre demandée : 2,5-3,5s), remplacement propre sans
// chevauchement quand un nouveau message arrive avant la fin du précédent.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/engine/state.js";
import { showTutorialOnce, hideTutorial } from "../src/ui/onboarding.js";

function createFakeRoot() {
  const classes = new Set();
  return {
    textContent: "",
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
  };
}

test("un message apparaît immédiatement puis disparaît tout seul entre 2,5 et 3,5s", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const state = createInitialState(0);
    const root = createFakeRoot();

    const shown = showTutorialOnce(state, root, "firstUpgrade");
    assert.equal(shown, true);
    assert.equal(root.classList.contains("is-visible"), true);
    assert.ok(root.textContent.length > 0);

    mock.timers.tick(2400);
    assert.equal(root.classList.contains("is-visible"), true, "ne doit pas disparaître avant 2,5s");

    mock.timers.tick(1200); // total 3600ms, au-delà de la fenêtre haute (3,5s)
    assert.equal(root.classList.contains("is-visible"), false, "doit avoir disparu avant 3,5s");
  } finally {
    mock.timers.reset();
  }
});

test("un nouveau message remplace proprement le précédent, sans chevauchement ni double minuteur", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const state = createInitialState(0);
    const root = createFakeRoot();

    showTutorialOnce(state, root, "firstUpgrade");
    mock.timers.tick(1000);
    assert.equal(root.classList.contains("is-visible"), true);

    // Un deuxième message arrive avant la fin du premier : remplace le
    // texte, reste visible, et repart pour un cycle complet de 3s (pas la
    // fin anticipée du minuteur du premier message).
    showTutorialOnce(state, root, "firstWorkerUpgrade");
    const textAfterReplace = root.textContent;
    assert.notEqual(textAfterReplace, "");

    mock.timers.tick(2000); // 1000 (premier minuteur, annulé) + 2000 < 3000 du nouveau
    assert.equal(root.classList.contains("is-visible"), true, "le nouveau message ne doit pas disparaître avant son propre délai");
    assert.equal(root.textContent, textAfterReplace, "le texte ne doit jamais revenir à l'ancien message");

    mock.timers.tick(1500); // dépasse maintenant les 3s du nouveau minuteur
    assert.equal(root.classList.contains("is-visible"), false);
  } finally {
    mock.timers.reset();
  }
});

test("hideTutorial annule le minuteur en cours (jamais un message qui redisparaît tout seul plus tard)", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const state = createInitialState(0);
    const root = createFakeRoot();

    showTutorialOnce(state, root, "firstUpgrade");
    hideTutorial(root);
    assert.equal(root.classList.contains("is-visible"), false);

    mock.timers.tick(5000);
    assert.equal(root.classList.contains("is-visible"), false, "aucun minuteur résiduel ne doit plus agir");
  } finally {
    mock.timers.reset();
  }
});

test("chaque message ne s'affiche qu'une seule fois par partie (comportement inchangé)", () => {
  const state = createInitialState(0);
  const root = createFakeRoot();
  assert.equal(showTutorialOnce(state, root, "firstUpgrade"), true);
  assert.equal(showTutorialOnce(state, root, "firstUpgrade"), false);
});

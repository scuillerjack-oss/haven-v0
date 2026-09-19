// V4 (section AUDIO du cahier des charges post-bêta V3) : la nappe rejetée
// ("vouuuummm" continu) est remplacée par une vraie mélodie instrumentale.
// melody.js est pur (aucune dépendance WebAudio) précisément pour rester
// testable ici — la lecture réelle (audio.js) reste vérifiée à l'oreille
// et par revue manuelle, comme le reste du rendu audiovisuel.
import test from "node:test";
import assert from "node:assert/strict";
import { composePastoralMelody, degreeToHz, BEAT_SECONDS } from "../src/audio/melody.js";

test("degreeToHz est strictement croissant avec le degré, jamais de saut vers le grave", () => {
  let previous = -Infinity;
  for (let degree = -10; degree <= 20; degree += 1) {
    const hz = degreeToHz(degree);
    assert.ok(hz > previous, `degré ${degree} (${hz}Hz) devrait être plus aigu que le degré précédent (${previous}Hz)`);
    previous = hz;
  }
});

test("degreeToHz(0) est la tonique, et une octave pentatonique plus haut vaut exactement le double (une octave réelle)", () => {
  const tonic = degreeToHz(0);
  const octaveUp = degreeToHz(5); // la gamme pentatonique a 5 degrés par octave
  assert.ok(Math.abs(octaveUp / tonic - 2) < 1e-9);
});

test("la mélodie complète dure environ une minute (cahier des charges : « environ 60 secondes de matière musicale »)", () => {
  const { loopSeconds } = composePastoralMelody();
  assert.ok(loopSeconds > 50 && loopSeconds < 70, `durée de boucle inattendue : ${loopSeconds}s`);
});

test("plusieurs phrases distinctes existent (jamais une boucle de quelques secondes déguisée en musique)", () => {
  const { notes } = composePastoralMelody();
  const melodyNotes = notes.filter((n) => n.kind === "melody");
  // Au moins 8 phrases de 7 notes : bien plus qu'une poignée de notes qui boucle vite.
  assert.ok(melodyNotes.length >= 8 * 7, `seulement ${melodyNotes.length} notes de mélodie`);
  // Les fréquences ne sont pas toutes identiques (un vrai contour mélodique, pas une note tenue) :
  const distinctFreqs = new Set(melodyNotes.map((n) => Math.round(n.freq)));
  assert.ok(distinctFreqs.size >= 5, "trop peu de hauteurs distinctes pour ressembler à une mélodie");
});

test("aucune note tenue en continu : chaque note a une durée bornée, jamais infinie ni nulle", () => {
  const { notes } = composePastoralMelody();
  for (const note of notes) {
    assert.ok(note.durationSeconds > 0, "une note de durée nulle ou négative");
    assert.ok(note.durationSeconds < 10, `une note de ${note.durationSeconds}s ressemblerait à une note tenue/un drone`);
  }
});

test("les notes sont ordonnées dans le temps (jamais une note programmée avant la précédente)", () => {
  const { notes } = composePastoralMelody();
  let lastMelodyTime = -Infinity;
  for (const note of notes) {
    if (note.kind !== "melody") continue;
    assert.ok(note.time >= lastMelodyTime, "les notes de mélodie ne sont pas en ordre chronologique");
    lastMelodyTime = note.time;
  }
});

test("la boucle se referme sur la même tonique qu'au début (reprise propre, jamais un saut audible)", () => {
  const { notes } = composePastoralMelody();
  const melodyNotes = notes.filter((n) => n.kind === "melody");
  const first = melodyNotes[0];
  const last = melodyNotes[melodyNotes.length - 1];
  assert.equal(first.freq, last.freq, "la première et la dernière note devraient être la même hauteur pour boucler proprement");
});

test("le tempo reste dans une allure calme et chaleureuse (ni précipité, ni figé)", () => {
  assert.ok(BEAT_SECONDS > 0.4 && BEAT_SECONDS < 1.2, `un temps de ${BEAT_SECONDS}s semble trop rapide ou trop lent pour une ambiance calme`);
});

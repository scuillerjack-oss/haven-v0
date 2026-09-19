// Mélodie pastorale procédurale (V4, section AUDIO du cahier des charges
// post-bêta V3) : l'ancienne nappe (4 sinusoïdes tenues en permanence +
// LFO de volume, voir l'historique Git de audio.js avant ce jalon) était
// perçue comme un "vouuuummm" continu — un drone, jamais une musique.
//
// Ce module compose une VRAIE petite mélodie instrumentale, séparée de
// tout code WebAudio (pur, déterministe, donc testable directement avec
// node:test — voir tests/melody.test.js) : un motif pastoral de 8 temps,
// décliné en 8 phrases apparentées mais reconnaissables (transposition,
// inversion, rétrograde — les mêmes procédés qu'un vrai thème et
// variations), sur une gamme pentatonique majeure (toujours consonante,
// aucune fausse note possible par construction). Chaque note a sa propre
// attaque/chute (voir audio.js) : jamais une note tenue en continu.
// Boucle complète : environ une minute avant de reprendre au début.

const TEMPO_BPM = 72; // allure de marche tranquille, jamais pressée.
export const BEAT_SECONDS = 60 / TEMPO_BPM;

// Gamme pentatonique majeure (degrés 1 2 3 5 6), en demi-tons depuis la
// tonique : choisie précisément parce qu'elle ne contient aucun intervalle
// dissonant entre ses degrés, quel que soit l'ordre dans lequel on les
// joue — toute mélodie construite dessus reste consonante.
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9];
const TONIC_HZ = 196.0; // Sol2 (G3) — grave et chaleureux, jamais strident.

// `degree` peut être négatif ou dépasser la gamme : l'octave se déduit par
// division entière, jamais une table statique limitée à une seule octave.
// (degree+3 tombe toujours sur la quinte de degree, PENTATONIC_SEMITONES[3]
// valant 7 demi-tons — utile pour l'accompagnement, voir plus bas.)
export function degreeToHz(degree) {
  const stepCount = PENTATONIC_SEMITONES.length;
  const octave = Math.floor(degree / stepCount);
  const idx = ((degree % stepCount) + stepCount) % stepCount;
  const semitones = PENTATONIC_SEMITONES[idx] + octave * 12;
  return TONIC_HZ * Math.pow(2, semitones / 12);
}

// Le motif pastoral de base (8 temps) : monte par degrés conjoints puis
// redescend sur une tenue. Seule vraie "phrase" composée à la main — tout
// le reste de la pièce en dérive par transformation, comme un vrai thème
// et variations.
const MOTIF = [
  { degree: 5, beats: 1 },
  { degree: 6, beats: 1 },
  { degree: 7, beats: 1 },
  { degree: 5, beats: 1 },
  { degree: 4, beats: 1 },
  { degree: 5, beats: 1 },
  { degree: 6, beats: 2 },
];

function transpose(motif, shift) {
  return motif.map((n) => ({ ...n, degree: n.degree + shift }));
}

function invert(motif) {
  const pivot = motif[0].degree;
  return motif.map((n) => ({ ...n, degree: 2 * pivot - n.degree }));
}

function retrograde(motif) {
  return [...motif].reverse();
}

// Cadence finale : reprend le motif de base mais remplace sa dernière note
// (degré 6, la seconde de la gamme) par la tonique (degré 5) — une vraie
// phrase ne se referme jamais sur autre chose que la tonique si la boucle
// doit s'entendre comme propre, jamais comme un saut au moment de reprendre.
const CLOSING_PHRASE = [...MOTIF.slice(0, -1), { degree: 5, beats: 2 }];

// 8 phrases apparentées mais reconnaissables (A, A transposée, B haute,
// A' inversée, A plus grave, B' inversée-transposée, B'' rétrograde, et
// une cadence finale qui referme la boucle sur la tonique de départ).
const PHRASES = [
  MOTIF,
  transpose(MOTIF, 2),
  transpose(MOTIF, 5),
  invert(MOTIF),
  transpose(MOTIF, -3),
  invert(transpose(MOTIF, 2)),
  retrograde(transpose(MOTIF, 5)),
  CLOSING_PHRASE,
];

// Silence bref entre deux phrases : sans lui, la pièce s'entendrait comme
// un unique flux continu au lieu de phrases distinctes et identifiables.
const PHRASE_GAP_BEATS = 1;

// Accompagnement harmonique très bref (tonique + quinte, jamais tenu plus
// de quelques secondes) joué sous la première note de chaque phrase —
// donne une couleur "instrumentale" sans jamais devenir un drone : voir
// audio.js pour l'enveloppe (attaque lente, longue chute, mais qui finit
// toujours par revenir à zéro avant la phrase suivante).
const CHORD_ROOT_DEGREE = 0;
const CHORD_DURATION_SECONDS = 2.2;

// Construit la partition complète en secondes absolues depuis le début de
// la boucle. Pur et déterministe : aucune dépendance à AudioContext, donc
// testable directement (voir tests/melody.test.js).
export function composePastoralMelody() {
  const notes = [];
  let t = 0;
  for (const phrase of PHRASES) {
    notes.push({ time: t, freq: degreeToHz(CHORD_ROOT_DEGREE), durationSeconds: CHORD_DURATION_SECONDS, kind: "chord" });
    notes.push({ time: t, freq: degreeToHz(CHORD_ROOT_DEGREE + 3), durationSeconds: CHORD_DURATION_SECONDS, kind: "chord" });
    for (const note of phrase) {
      notes.push({ time: t, freq: degreeToHz(note.degree), durationSeconds: note.beats * BEAT_SECONDS, kind: "melody" });
      t += note.beats * BEAT_SECONDS;
    }
    t += PHRASE_GAP_BEATS * BEAT_SECONDS;
  }
  return { loopSeconds: t, notes };
}

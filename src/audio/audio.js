// Musique d'ambiance pastorale, générée en pur WebAudio (pas de fichier
// audio à charger : rien à télécharger, rien qui ne ralentisse la PWA).
//
// V4 (section AUDIO du cahier des charges post-bêta V3) : remplace
// l'ancienne nappe (4 sinusoïdes tenues en permanence + LFO de volume),
// perçue comme un "vouuuummm" continu — jamais une musique, jamais une
// note tenue, jamais une boucle de quelques secondes déguisée en musique.
// La partition elle-même (quelles notes, quand) vit dans melody.js, pure
// et testable ; ce fichier ne fait que la JOUER — programmation "look-
// ahead" classique en WebAudio (on programme les prochaines notes un peu
// à l'avance à intervalles réguliers, jamais note par note en direct, ce
// qui dériverait avec la latence de setInterval).
import { composePastoralMelody } from "./melody.js";

const SCHEDULER_INTERVAL_MS = 50;
const LOOKAHEAD_SECONDS = 0.15;

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.melodyFilter = null;
    this.chordFilter = null;
    this.started = false;
    this.muted = false;
    this.volume = 0.5;

    this.melody = null;
    this.loopStartTime = 0;
    this.loopIteration = 0;
    this.nextNoteIndex = 0;
    this.schedulerHandle = null;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Filtre doux par voix : la mélodie reste chaleureuse (triangle un peu
    // adouci), l'accompagnement encore plus feutré (sinusoïde très filtrée,
    // jamais au premier plan).
    this.melodyFilter = this.ctx.createBiquadFilter();
    this.melodyFilter.type = "lowpass";
    this.melodyFilter.frequency.value = 2600;
    this.melodyFilter.connect(this.masterGain);

    this.chordFilter = this.ctx.createBiquadFilter();
    this.chordFilter.type = "lowpass";
    this.chordFilter.frequency.value = 900;
    this.chordFilter.connect(this.masterGain);
  }

  start() {
    this.ensureContext();
    if (!this.ctx || this.started) return;
    this.started = true;

    this.melody = composePastoralMelody();
    this.loopIteration = 0;
    this.nextNoteIndex = 0;
    this.loopStartTime = this.ctx.currentTime + 0.1; // petite marge avant la première note

    this.scheduleUpcomingNotes();
    this.schedulerHandle = setInterval(() => this.scheduleUpcomingNotes(), SCHEDULER_INTERVAL_MS);
  }

  // Programme, à chaque tick, toutes les notes qui tombent dans la fenêtre
  // [maintenant, maintenant + LOOKAHEAD]. S'appuie uniquement sur l'horloge
  // propre à AudioContext (ctx.currentTime) : elle se fige pendant une mise
  // en arrière-plan et reprend exactement où elle en était, donc aucune
  // dérive ni rattrapage brutal n'est nécessaire au retour au premier plan.
  scheduleUpcomingNotes() {
    if (!this.ctx || !this.melody) return;
    const horizon = this.ctx.currentTime + LOOKAHEAD_SECONDS;
    while (true) {
      const note = this.melody.notes[this.nextNoteIndex];
      const absoluteTime = this.loopStartTime + this.loopIteration * this.melody.loopSeconds + note.time;
      if (absoluteTime >= horizon) break;
      this.playNote(note, absoluteTime);
      this.nextNoteIndex += 1;
      if (this.nextNoteIndex >= this.melody.notes.length) {
        this.nextNoteIndex = 0;
        this.loopIteration += 1;
      }
    }
  }

  // Chaque note a sa propre enveloppe (attaque puis chute complète à
  // zéro) : jamais un gain qui reste ouvert en continu, jamais un drone.
  playNote(note, when) {
    const isChord = note.kind === "chord";
    const osc = this.ctx.createOscillator();
    osc.type = isChord ? "sine" : "triangle";
    osc.frequency.value = note.freq;

    const gain = this.ctx.createGain();
    const peak = isChord ? 0.05 : 0.22;
    const attack = isChord ? 0.4 : 0.02;
    const release = isChord ? 1.4 : Math.min(0.35, note.durationSeconds * 0.4);
    const sustainEnd = when + Math.max(note.durationSeconds - release, attack);

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + attack);
    gain.gain.setValueAtTime(peak, sustainEnd);
    gain.gain.linearRampToValueAtTime(0, sustainEnd + release);

    osc.connect(gain);
    gain.connect(isChord ? this.chordFilter : this.melodyFilter);
    osc.start(when);
    osc.stop(sustainEnd + release + 0.05);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this.volume;
  }

  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.masterGain && !this.muted) this.masterGain.gain.value = this.volume;
  }
}

// Nappe instrumentale calme, générée en pur WebAudio (pas de fichier audio
// à charger : rien à télécharger, rien qui ne ralentisse la V0). Quelques
// oscillateurs accordés sur un accord ouvert, une LFO lente sur le volume
// pour respirer, et un filtre passe-bas pour rester doux.

const CHORD_HZ = [98, 147, 196, 246.94]; // Sol2, Ré3, Sol3, Si3 — accord ouvert calme.

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.started = false;
    this.muted = false;
    this.volume = 0.5;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  start() {
    this.ensureContext();
    if (!this.ctx || this.started) return;
    this.started = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(this.masterGain);

    CHORD_HZ.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const voiceGain = this.ctx.createGain();
      voiceGain.gain.value = 0.18 / (i + 1);

      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.05 + i * 0.01;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.06 / (i + 1);
      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);

      osc.connect(voiceGain);
      voiceGain.connect(filter);
      osc.start();
      lfo.start();
    });
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

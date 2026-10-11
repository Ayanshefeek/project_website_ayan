/*
 * sound.js — every sound on the site, synthesized live with the Web Audio API.
 *
 * Why synthesis instead of audio files: there's nothing to download, the
 * sounds can follow live values (the hum tracks the bulb's brightness, the
 * door creak tracks how fast the door is swinging), and no two flickers or
 * slams sound exactly alike.
 *
 * Browsers only allow audio after the visitor clicks or presses a key, so
 * the AudioContext is created lazily and `unlock()` must be called from
 * inside a user gesture. Until then every sound call is a silent no-op.
 *
 * Signal chain:  voices → master (mute + volume) → speakers
 */
(() => {
  "use strict";

  const VOLUME = 0.8;            // overall loudness
  const HUM_LEVEL = 0.014;       // bulb hum at full brightness (it should be felt, not heard)
  const CREAK_LEVEL = 0.05;      // door creak at full swing speed
  const CREAK_MIN_SPEED = 25;    // deg/s — slower movement makes no creak

  const Sound = {
    enabled: true,               // the visitor's preference (nav toggle)
    unlocked: false,             // has a user gesture started audio yet?
    ctx: null,
    master: null,
    _hum: null,
    _creak: null,
    _bulb: 0,

    /* ---------- setup ---------- */

    _ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? VOLUME : 0;
      this.master.connect(this.ctx.destination);
      // Silence the room when the tab is in the background.
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else if (this.unlocked) this.ctx.resume();
      });
      return this.ctx;
    },

    // Call from a click/keydown/touch handler. Safe to call repeatedly.
    unlock() {
      const ctx = this._ensure();
      if (!ctx) return false;
      if (ctx.state === "suspended") ctx.resume();
      if (!this.unlocked) {
        this.unlocked = true;
        this._startHum();
      }
      return true;
    },

    setEnabled(on) {
      this.enabled = on;
      if (!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? VOLUME : 0, t, 0.08);
    },

    get _live() {
      return this.enabled && this.unlocked && this.ctx && this.ctx.state === "running";
    },

    /* ---------- building blocks ---------- */

    _noise(seconds) {
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * seconds)), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      return src;
    },
    _burst({ freq, q = 1, dur, gain, type = "bandpass", at = 0 }) {
      const ctx = this.ctx;
      const t = ctx.currentTime + at;
      const src = this._noise(dur);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
    },
    _tone(freq, dur, gain, { type = "sine", drop = 0.6, at = 0 } = {}) {
      const ctx = this.ctx;
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    /* ---------- the bulb ---------- */

    // Mains hum: a 120 Hz fundamental with buzzy harmonics, its level
    // following the bulb's brightness (see bulb()).
    _startHum() {
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      lp.connect(out).connect(this.master);
      [
        [120, "sine", 1],
        [240, "sine", 0.45],
        [120, "sawtooth", 0.18],
        [360, "triangle", 0.12],
      ].forEach(([f, type, level]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = f + (Math.random() - 0.5) * 0.6; // a slight beat between partials
        g.gain.value = level;
        o.connect(g).connect(lp);
        o.start();
      });
      this._hum = out;
      this._setHum(this._bulb);
    },
    _setHum(level) {
      if (!this._hum) return;
      const t = this.ctx.currentTime;
      this._hum.gain.cancelScheduledValues(t);
      this._hum.gain.setTargetAtTime(HUM_LEVEL * level, t, 0.012);
    },

    // The wall switch.
    switchClick() {
      if (!this._live) return;
      this._burst({ freq: 2600, q: 3, dur: 0.03, gain: 0.5, type: "highpass" });
      this._tone(160, 0.06, 0.25, { drop: 0.5 });
      this._burst({ freq: 1800, q: 4, dur: 0.025, gain: 0.25, at: 0.07 });
    },

    // Called on every brightness change of the bulb (0..1).
    bulb(level) {
      const prev = this._bulb;
      this._bulb = level;
      this._setHum(level);
      if (!this._live) return;
      const jump = Math.abs(level - prev);
      if (jump < 0.12) return;
      // Electrical crackle on each flicker; a bright "tink" when power surges in.
      this._burst({ freq: 2400 + Math.random() * 2400, q: 2.5, dur: 0.025 + jump * 0.05, gain: 0.05 + jump * 0.22 });
      if (level > prev && level > 0.6) this._tone(1700 + Math.random() * 500, 0.09, 0.03 * jump, { drop: 0.9 });
      if (jump > 0.5) this._burst({ freq: 140, q: 1, dur: 0.07, gain: 0.08 * jump, type: "lowpass" });
    },

    /* ---------- doors ---------- */

    // Continuous creak while a door swings: pitch and loudness follow speed.
    creak(speed) {
      if (!this._live) return;
      const ctx = this.ctx;
      if (!this._creak) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 23;   // the stick-slip "grain" of a dry hinge
        lfoGain.gain.value = 9;
        lfo.connect(lfoGain).connect(o.frequency);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 9;
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(bp).connect(g).connect(this.master);
        o.start();
        lfo.start();
        this._creak = { o, bp, g };
      }
      const s = Math.abs(speed);
      const amount = Math.min(Math.max((s - CREAK_MIN_SPEED) / 450, 0), 1);
      const t = ctx.currentTime;
      this._creak.o.frequency.setTargetAtTime(62 + amount * 70, t, 0.05);
      this._creak.bp.frequency.setTargetAtTime(700 + amount * 900, t, 0.05);
      this._creak.g.gain.setTargetAtTime(CREAK_LEVEL * amount, t, amount ? 0.04 : 0.08);
    },

    latch() {
      if (!this._live) return;
      this._burst({ freq: 3200, q: 4, dur: 0.035, gain: 0.25, type: "highpass" });
      this._tone(1400, 0.04, 0.05);
    },
    tick() {
      if (!this._live) return;
      this._burst({ freq: 4200, q: 8, dur: 0.018, gain: 0.12 });
    },
    slam(speed) {
      if (!this._live) return;
      const s = Math.min(speed / 500, 1);
      this._burst({ freq: 420, q: 1.2, dur: 0.22, gain: 0.35 * s + 0.05 });
      this._tone(95, 0.18, 0.25 * s + 0.04);
      this._burst({ freq: 2600, q: 6, dur: 0.05, gain: 0.08 * s });
    },
    // Small hallway doors swinging shut on hover-out: a light metal clack.
    clack(speed) {
      if (!this._live) return;
      const s = Math.min(speed / 400, 1);
      this._burst({ freq: 900, q: 2, dur: 0.07, gain: 0.05 * s + 0.01 });
      this._tone(220, 0.05, 0.03 * s, { drop: 0.7 });
    },
  };

  window.SoundKit = Sound;
})();

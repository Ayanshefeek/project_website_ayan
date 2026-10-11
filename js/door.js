/*
 * door.js — physics for locker doors: a damped spring with a door frame to
 * hit, plus a tiny synthesized sound kit.
 *
 * Why a spring simulation instead of CSS transitions:
 * a CSS transition can only play a fixed curve from A to B. A door the user
 * can grab, drag half-open, flick, and let go of needs to *continue from
 * wherever it is, at whatever speed it was moving*. A spring integrated every
 * frame does exactly that, and colliding it with the frame (angle 0) gives the
 * slam-and-bounce of a real metal door for free.
 *
 * Angles are in degrees (0 = closed), velocities in degrees/second.
 * The integrator uses small fixed sub-steps so stiff springs stay stable even
 * when a frame is dropped.
 */
(() => {
  "use strict";

  const SUBSTEP = 1 / 240;     // seconds per physics step
  const MAX_FRAME = 1 / 30;    // clamp long frames (tab switches, jank)
  const REST_ANGLE = 0.05;     // deg — close enough to the target to stop
  const REST_SPEED = 2;        // deg/s — slow enough to stop
  const FLICK_SPEED = 45;      // deg/s — a release faster than this is a throw

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Shared animation loop ---------- */
  const active = new Set();
  let last = 0;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    active.forEach((s) => s._advance(dt));
    if (active.size) requestAnimationFrame(tick);
  }
  function wake(spring) {
    if (!active.size) {
      last = performance.now();
      requestAnimationFrame(tick);
    }
    active.add(spring);
  }

  /*
   * A hinged door. Options:
   *   max          fully-open angle
   *   open/close   { k: stiffness, z: damping ratio } used toward each target
   *   bounce       restitution when the door hits the frame (0..1)
   *   onUpdate(a, v)     every frame the angle changes
   *   onImpact(speed)    door hit the frame at `speed` deg/s
   */
  class DoorSpring {
    constructor(opts) {
      this.o = Object.assign(
        {
          max: 100,
          open: { k: 70, z: 0.62 },
          close: { k: 180, z: 0.6 },
          bounce: 0.3,
          overswing: 6,
          closePull: 22,
          onUpdate() {},
          onImpact() {},
        },
        opts
      );
      this.a = 0;
      this.v = 0;
      this.target = 0;
      this.dragging = false;
      this._waiters = [];
    }

    get isOpen() {
      return this.target > 0;
    }

    setTarget(target, kick = 0) {
      this.target = target;
      this.v += kick;
      if (reduceMotion) {
        this.a = target;
        this.v = 0;
        this.o.onUpdate(this.a, 0);
        this._settle();
        return;
      }
      wake(this);
    }

    toggle(kick) {
      const opening = !this.isOpen;
      this.setTarget(opening ? this.o.max : 0, kick ?? (opening ? 80 : -120));
      return opening;
    }

    // Instantly place the door (no animation), e.g. when re-using an element.
    reset(a = 0) {
      this.a = this.target = a;
      this.v = 0;
      this.dragging = false;
      this.o.onUpdate(a, 0);
      this._settle();
    }

    /* Direct manipulation: the caller feeds angles while the pointer drags. */
    grab() {
      this.dragging = true;
      // The grab itself is the first sample: browsers merge fast pointer
      // moves, and a quick flick may only deliver one or two events.
      this._samples = [{ t: performance.now(), a: this.a }];
      active.delete(this);
    }
    drag(a) {
      const { max, overswing } = this.o;
      // Rubber-band past the stops instead of a hard wall.
      if (a > max) a = max + (a - max) * 0.35;
      if (a < 0) a = a * 0.2;
      a = Math.min(Math.max(a, -2), max + overswing * 2);
      const now = performance.now();
      this._samples.push({ t: now, a });
      while (this._samples.length > 2 && now - this._samples[0].t > 140) this._samples.shift();
      this.a = a;
      this.o.onUpdate(a, 0);
    }
    release() {
      this.dragging = false;
      const s = this._samples || [];
      const lastAt = s.length ? s[s.length - 1].t : 0;
      const span = s.length > 1 ? (lastAt - s[0].t) / 1000 : 0;
      // Holding still before letting go means no throw.
      const stale = performance.now() - lastAt > 80;
      this.v = span > 0 && !stale ? (s[s.length - 1].a - s[0].a) / span : 0;
      // A real throw goes where it was thrown; a gentle release falls to
      // whichever side of halfway the door is on.
      if (Math.abs(this.v) > FLICK_SPEED) this.target = this.v > 0 ? this.o.max : 0;
      else this.target = this.a > this.o.max * 0.5 ? this.o.max : 0;
      wake(this);
    }

    // Resolves once the door has come to rest.
    settled() {
      if (!active.has(this) && !this.dragging) return Promise.resolve();
      return new Promise((r) => this._waiters.push(r));
    }

    _settle() {
      active.delete(this);
      this._waiters.splice(0).forEach((r) => r());
    }

    _advance(dt) {
      const { max, overswing, bounce, closePull } = this.o;
      const closing = this.target <= 0;
      const { k, z } = closing ? this.o.close : this.o.open;
      const c = 2 * z * Math.sqrt(k);
      // A closing door is pulled to a point *past* the frame, so it arrives
      // with speed and slams instead of easing politely to a stop at 0.
      const aim = closing ? -closePull : this.target;
      for (let t = 0; t < dt; t += SUBSTEP) {
        const h = Math.min(SUBSTEP, dt - t);
        this.v += (-k * (this.a - aim) - c * this.v) * h;
        this.a += this.v * h;
        // The frame: a closing door stops dead and rebounds a little.
        if (this.a < 0) {
          const speed = -this.v;
          this.a = 0;
          this.v = speed > 40 ? speed * bounce : 0;
          if (speed > 40) this.o.onImpact(speed);
        }
        // The hinge stop on the open side.
        if (this.a > max + overswing) {
          this.a = max + overswing;
          this.v = -Math.abs(this.v) * 0.2;
        }
      }
      this.o.onUpdate(this.a, this.v);
      const resting = closing
        ? this.a <= 0 && this.v === 0
        : Math.abs(this.a - this.target) < REST_ANGLE && Math.abs(this.v) < REST_SPEED;
      if (resting) {
        this.a = this.target;
        this.v = 0;
        this.o.onUpdate(this.a, 0);
        this._settle();
      }
    }
  }

  /*
   * Sound: synthesized with Web Audio (no audio files to download).
   * Off by default — sound on a portfolio should be opt-in.
   */
  const Sound = {
    enabled: false,
    ctx: null,
    _ctx() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    _noise(ctx, seconds) {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      return src;
    },
    _burst({ freq, q, dur, gain, type = "bandpass" }) {
      const ctx = this._ctx();
      const t = ctx.currentTime;
      const src = this._noise(ctx, dur);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
    },
    _tone(freq, dur, gain) {
      const ctx = this._ctx();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
    },
    latch() {
      if (!this.enabled) return;
      this._burst({ freq: 3200, q: 4, dur: 0.035, gain: 0.25, type: "highpass" });
      this._tone(1400, 0.04, 0.05);
    },
    slam(speed) {
      if (!this.enabled) return;
      const s = Math.min(speed / 500, 1);
      this._burst({ freq: 420, q: 1.2, dur: 0.22, gain: 0.35 * s + 0.05 });
      this._tone(95, 0.18, 0.25 * s + 0.04);
      this._burst({ freq: 2600, q: 6, dur: 0.05, gain: 0.08 * s, type: "bandpass" });
    },
  };

  window.DoorKit = { DoorSpring, Sound, reduceMotion };
})();

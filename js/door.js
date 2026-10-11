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
      const prev = this._samples[this._samples.length - 1];
      // Instantaneous speed, so things that follow the door (its creak) react while dragging.
      const v = prev && now > prev.t ? ((a - prev.a) / (now - prev.t)) * 1000 : 0;
      this._samples.push({ t: now, a });
      while (this._samples.length > 2 && now - this._samples[0].t > 140) this._samples.shift();
      this.a = a;
      this.o.onUpdate(a, v);
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
      // Speed a door picks up in one step just from resting against the frame
      // under that pull. Hits slower than this are contact, not impacts —
      // otherwise a strong pull makes the door micro-bounce forever.
      const contact = 40 + k * closePull * SUBSTEP * 2;
      for (let t = 0; t < dt; t += SUBSTEP) {
        const h = Math.min(SUBSTEP, dt - t);
        this.v += (-k * (this.a - aim) - c * this.v) * h;
        this.a += this.v * h;
        // The frame: a closing door stops dead and rebounds a little.
        if (this.a < 0) {
          const speed = -this.v;
          this.a = 0;
          this.v = speed > contact ? speed * bounce : 0;
          if (speed > contact) this.o.onImpact(speed);
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

  // Sounds live in sound.js; re-exported here so callers have one import.
  const Sound = window.SoundKit;

  window.DoorKit = { DoorSpring, Sound, reduceMotion };
})();

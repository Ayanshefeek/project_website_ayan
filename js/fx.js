/*
 * fx.js — self-contained visual polish that main.js plugs in:
 *   - intro():          loading curtain that waits for web fonts, then lights the room
 *   - wearHTML(seed):   procedural scratches, dents, grime and faded stickers per door
 *   - dialHTML():       combination dial markup; spinDial() plays a combination
 *   - initCursor():     custom gold cursor ring with context states (open / grab)
 *   - initSpotlight():  soft light that follows the pointer across the hallway
 *   - initSmoothScroll(): Lenis inertia scrolling (vendored, MIT)
 *
 * Kept apart from main.js because none of these change *what* the site does —
 * each one can be removed without breaking navigation or the lockers.
 * Wear is generated from a seeded random generator so every locker has its
 * own scratches, but the same ones on every visit (and on both the hallway
 * door and the big cabinet door).
 */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const FONT_TIMEOUT_MS = 2500;   // never hold the page longer than this for fonts
  const PROMPT_MS = 2400;         // how long "click to switch on the light" waits before going ahead silently
  const INTRO_MIN_MS = 650;       // let the curtain register even on a warm cache

  // Small seeded PRNG (mulberry32): same seed -> same "random" wear.
  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Intro + font loading ---------- */

  /*
   * Browsers only start audio from a user gesture, so when sound is on the
   * curtain asks for one: "click to switch on the light". The click is the
   * light switch (it unlocks audio and the bulb comes on with a sound). If
   * nobody clicks within PROMPT_MS the light comes on silently instead —
   * the prompt invites, it never blocks.
   */
  async function intro({ onLift, prompt = false, onSwitch } = {}) {
    const root = document.documentElement;
    const curtain = document.getElementById("intro");
    const started = performance.now();
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    await Promise.race([fonts, new Promise((r) => setTimeout(r, FONT_TIMEOUT_MS))]);
    const left = INTRO_MIN_MS - (performance.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));

    let switched = false;
    if (prompt) {
      curtain.classList.add("is-prompt");
      switched = await new Promise((resolve) => {
        const events = ["click", "keydown", "touchend"];
        const done = (clicked) => {
          events.forEach((ev) => window.removeEventListener(ev, onGesture, true));
          clearTimeout(timer);
          resolve(clicked);
        };
        const onGesture = (e) => {
          if (e.type === "keydown" && ["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
          if (onSwitch) onSwitch(); // runs inside the gesture, so audio may start
          done(true);
        };
        const timer = setTimeout(() => done(false), PROMPT_MS);
        events.forEach((ev) => window.addEventListener(ev, onGesture, true));
      });
      if (switched) curtain.classList.add("is-fast");
    }

    root.classList.add("is-ready");          // fonts in: hero may animate
    curtain.classList.add("is-done");        // bar completes, curtain lifts
    root.classList.remove("is-intro");
    if (onLift) onLift(switched);
    await new Promise((r) => setTimeout(r, 900));
    curtain.remove();
  }

  /* ---------- Locker wear ---------- */

  const STICKERS = [
    // faded smiley
    '<circle cx="12" cy="12" r="10" fill="#e9c46a"/><circle cx="8.5" cy="10" r="1.3" fill="#3a2f1a"/><circle cx="15.5" cy="10" r="1.3" fill="#3a2f1a"/><path d="M7.5 14c1.5 2.4 7.5 2.4 9 0" stroke="#3a2f1a" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
    // star
    '<path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="#e76f51"/>',
    // "A+" grade sticker
    '<circle cx="12" cy="12" r="10.5" fill="#f1ede4"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#2a9d8f" stroke-width="1.2"/><text x="12" y="15.5" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="11" fill="#2a9d8f">A+</text>',
    // lightning bolt
    '<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z" fill="#8ecae6"/>',
    // little heart
    '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="#f4a3b4"/>',
  ];

  function wearHTML(seed) {
    const r = rng(seed * 9973 + 17);
    let marks = "";
    // Scratches: short, mostly horizontal, a light edge with a dark shadow.
    const n = 7 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const x = 8 + r() * 84, y = 8 + r() * 84, len = 3 + r() * 13;
      const ang = (r() - 0.5) * 0.9 + (r() < 0.25 ? 1.2 : 0);
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const o = (0.08 + r() * 0.12).toFixed(2);
      marks += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-opacity="${o}" stroke-width=".35"/>`;
      marks += `<line x1="${x.toFixed(1)}" y1="${(y + 0.5).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y2 + 0.5).toFixed(1)}" stroke="#000" stroke-opacity="${(o * 1.2).toFixed(2)}" stroke-width=".35"/>`;
    }
    // Scuffs around the handle, where hands actually touch the door.
    for (let i = 0; i < 9; i++) {
      const x = 4 + r() * 16, y = 40 + r() * 22;
      marks += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 1 + r() * 3).toFixed(1)}" y2="${(y + (r() - 0.5) * 1.5).toFixed(1)}" stroke="#fff" stroke-opacity=".1" stroke-width=".3"/>`;
    }
    // One or two dents: a highlight above, a shadow below.
    const dents = 1 + (r() < 0.4 ? 1 : 0);
    let dentHTML = "";
    for (let i = 0; i < dents; i++) {
      const x = 15 + r() * 70, y = 55 + r() * 25, s = 5 + r() * 6;
      dentHTML += `<i class="dent" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${s.toFixed(1)}%"></i>`;
    }
    // About half the lockers carry an old, sun-faded sticker with a lifted corner.
    let sticker = "";
    if (r() < 0.6) {
      const art = STICKERS[Math.floor(r() * STICKERS.length)];
      const spot = r() < 0.5 ? { x: 66 + r() * 12, y: 6 + r() * 4 } : { x: 62 + r() * 14, y: 56 + r() * 8 };
      const rot = Math.round((r() - 0.5) * 40);
      sticker = `<span class="old-sticker" style="left:${spot.x.toFixed(1)}%;top:${spot.y.toFixed(1)}%;--rot:${rot}deg"><svg viewBox="0 0 24 24">${art}</svg></span>`;
    }
    return `<div class="wear" aria-hidden="true"><svg class="wear__marks" viewBox="0 0 100 100" preserveAspectRatio="none">${marks}</svg>${dentHTML}${sticker}</div>`;
  }

  /* ---------- Combination dial ---------- */

  function dialHTML() {
    let ticks = "";
    for (let i = 0; i < 40; i++) {
      const long = i % 5 === 0;
      ticks += `<line x1="50" y1="${long ? 9 : 11}" x2="50" y2="16" transform="rotate(${i * 9} 50 50)" stroke-width="${long ? 1.6 : 0.8}"/>`;
    }
    const nums = [0, 10, 20, 30]
      .map((n) => {
        const a = (n * 9 - 90) * (Math.PI / 180);
        return `<text x="${(50 + Math.cos(a) * 27).toFixed(1)}" y="${(50 + Math.sin(a) * 27 + 3.5).toFixed(1)}" text-anchor="middle">${n}</text>`;
      })
      .join("");
    return `
      <div class="dial" aria-hidden="true">
        <svg class="dial__face" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" class="dial__rim"/>
          <circle cx="50" cy="50" r="40" class="dial__plate"/>
          <g class="dial__ticks">${ticks}</g>
          <g class="dial__nums">${nums}</g>
          <circle cx="50" cy="50" r="13" class="dial__knob"/>
        </svg>
        <i class="dial__mark"></i>
      </div>`;
  }

  // Spin the dial through a 3-number combination (right, left, right).
  // Resolves when done; `tick` is called at each number for a click sound.
  function spinDial(face, combo, tick, quick) {
    if (!face || reduceMotion) return Promise.resolve();
    if (quick) {
      // Re-opening a locker you've already unlocked: just a short twist.
      const cur = face._angle || 0;
      tick && setTimeout(tick, 120);
      return face.animate(
        [{ transform: `rotate(${cur}deg)` }, { transform: `rotate(${cur - 50}deg)` }, { transform: `rotate(${cur}deg)` }],
        { duration: 260, easing: "cubic-bezier(.3, 0, .2, 1)", fill: "forwards" }
      ).finished;
    }
    const [c1, c2, c3] = combo;
    const cur = face._angle || 0;
    const a1 = cur + 540 + c1 * 9;
    const a2 = a1 - 360 - (((c1 - c2 + 40) % 40) * 9);
    const a3 = a2 + (((c3 - c2 + 40) % 40) * 9 || 360);
    face._angle = a3 % 360;
    const anim = face.animate(
      [
        { transform: `rotate(${cur}deg)` },
        { transform: `rotate(${a1}deg)`, offset: 0.45 },
        { transform: `rotate(${a2}deg)`, offset: 0.8 },
        { transform: `rotate(${a3}deg)` },
      ],
      { duration: 560, easing: "cubic-bezier(.45, 0, .2, 1)", fill: "forwards" }
    );
    [0.45, 0.8, 1].forEach((t) => setTimeout(() => tick && tick(), 560 * t));
    return anim.finished;
  }

  /* ---------- Custom cursor ---------- */

  function initCursor() {
    if (!finePointer) return null;
    const root = document.documentElement;
    const el = document.createElement("div");
    el.className = "cursor";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="cursor__ring">
        <svg class="cursor__hand" viewBox="0 0 24 24"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-1.5V6a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0v4.5c0 4-2.8 7.5-7 7.5h-1c-2.5 0-4-1-5.3-2.8L3.6 15a1.6 1.6 0 0 1 2.6-1.8L8 15"/></svg>
        <span class="cursor__label">Open</span>
      </div>
      <div class="cursor__dot"></div>`;
    document.body.appendChild(el);
    root.classList.add("has-cursor");

    const ring = el.querySelector(".cursor__ring");
    const dot = el.querySelector(".cursor__dot");
    let tx = innerWidth / 2, ty = innerHeight / 2, rx = tx, ry = ty;
    let state = "";
    const ease = reduceMotion ? 1 : 0.2;

    const stateFor = (t) => {
      if (!t || !t.closest) return "";
      if (t.closest(".cabinet__door")) return document.querySelector(".cabinet.is-grabbing") ? "grabbing" : "grab";
      if (t.closest(".locker, .entry__btn")) return "open";
      if (t.closest("a, button, [role='button'], .chip")) return "link";
      return "";
    };
    const setState = (s) => {
      if (s !== state) el.dataset.state = state = s;
    };

    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      setState(stateFor(e.target));
      el.classList.remove("is-hidden");
    }, { passive: true });
    window.addEventListener("pointerdown", (e) => setTimeout(() => setState(stateFor(e.target)), 0));
    window.addEventListener("pointerup", (e) => setTimeout(() => setState(stateFor(e.target)), 0));
    document.addEventListener("pointerleave", () => el.classList.add("is-hidden"));
    window.addEventListener("blur", () => el.classList.add("is-hidden"));

    (function loop() {
      rx += (tx - rx) * ease;
      ry += (ty - ry) * ease;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    })();
    return el;
  }

  /* ---------- Pointer spotlight ---------- */

  function initSpotlight(area) {
    if (!area || !finePointer || reduceMotion) return;
    let tx = 50, ty = 40, x = 50, y = 40, on = 0, ton = 0, running = false;
    const frame = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      on += (ton - on) * 0.06;
      area.style.setProperty("--lx", `${x.toFixed(2)}%`);
      area.style.setProperty("--ly", `${y.toFixed(2)}%`);
      area.style.setProperty("--lon", on.toFixed(3));
      running = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(ton - on) > 0.02;
      if (running) requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    };
    area.addEventListener("pointermove", (e) => {
      const r = area.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      ton = 1;
      kick();
    }, { passive: true });
    area.addEventListener("pointerleave", () => {
      ton = 0;
      kick();
    });
  }

  /* ---------- Smooth scrolling ---------- */

  function initSmoothScroll() {
    if (reduceMotion || typeof window.Lenis !== "function") return null;
    const lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    (function raf(t) {
      lenis.raf(t);
      requestAnimationFrame(raf);
    })(performance.now());

    // In-page links glide instead of jumping.
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: id === "#top" ? 0 : -20, duration: 1.4 });
    });
    return lenis;
  }

  /* ---------- Flickering bulb ---------- */

  /*
   * The bulb's brightness is one number, --bulb (0..1), set on <html> so the
   * bulb, its glow and the room's ambient light all dim together. Patterns
   * are lists of [brightness, hold ms]. Flicker is deliberately irregular:
   * a fixed-interval blink reads as a UI animation, a random one as a bulb.
   */
  const BULB = {
    // Switching on: a few false starts before it catches (~1.6s).
    on: [
      [0.25, 70], [0, 260], [0.6, 60], [0, 120], [0.15, 50], [0, 380],
      [0.85, 90], [0.2, 70], [0.95, 50], [0.4, 110], [1, 140], [0.6, 60], [1, 0],
    ],
    patterns: [
      { w: 5, seq: [[0.35, 45], [1, 70], [0.55, 40], [1, 0]] },                       // quick double dip
      { w: 3, seq: [[0.7, 30], [0.45, 30], [0.8, 30], [0.4, 30], [0.85, 40], [1, 0]] }, // buzzing
      { w: 2, seq: [[0.6, 500], [0.35, 60], [0.65, 120], [1, 0]] },                    // brown-out
      { w: 1, seq: [[0, 90], [1, 40], [0, 70], [0.6, 50], [1, 0]] },                   // nearly dies
    ],
    gap: [2200, 6500],   // ms between flicker bursts
    failSafeMs: 6000,    // light the room even if start() is never called
  };

  /*
   * Two variables: --bulb is the bulb's brightness right now (flickers keep
   * changing it); --room is how lit the room is. During switch-on --room
   * follows the bulb, so the page itself comes out of the dark; afterwards it
   * stays at 1 and idle flickers only dim the room slightly (see .darkness).
   *
   * Reduced-motion users still get the light and the flicker: they're changes
   * of brightness, not movement. Only the swinging is skipped for them.
   */
  function initBulb() {
    const el = document.getElementById("bulb");
    if (!el) return { start() {} };
    const root = document.documentElement;
    const swing = el.querySelector(".bulb__swing");
    let switchingOn = true;
    const sound = window.SoundKit;
    const set = (v) => {
      root.style.setProperty("--bulb", v.toFixed(3));
      if (sound) sound.bulb(v); // hum follows brightness; crackle on each flicker
      if (switchingOn) root.style.setProperty("--room", v.toFixed(3));
    };
    root.classList.add("has-bulb");
    let busy = false;
    let started = false;
    setTimeout(() => {
      if (!started) {
        switchingOn = false;
        set(1);
        root.style.setProperty("--room", "1");
      }
    }, BULB.failSafeMs);

    const play = (seq) =>
      new Promise((done) => {
        busy = true;
        let i = 0;
        const next = () => {
          if (i >= seq.length) {
            busy = false;
            return done();
          }
          const [v, hold] = seq[i++];
          set(v);
          setTimeout(next, hold);
        };
        next();
      });

    const pick = () => {
      const total = BULB.patterns.reduce((a, p) => a + p.w, 0);
      let r = Math.random() * total;
      return BULB.patterns.find((p) => (r -= p.w) < 0).seq;
    };

    async function idle() {
      const [lo, hi] = BULB.gap;
      setTimeout(async () => {
        if (!document.hidden && !busy) await play(pick());
        idle();
      }, lo + Math.random() * (hi - lo));
    }

    // Brushing past the bulb sets it swinging, and the loose connection flickers.
    el.querySelector(".bulb__glass").addEventListener("pointerenter", () => {
      if (reduceMotion) return;
      swing.animate(
        [
          { transform: "rotate(0deg)" }, { transform: "rotate(9deg)" }, { transform: "rotate(-6deg)" },
          { transform: "rotate(3.5deg)" }, { transform: "rotate(-1.5deg)" }, { transform: "rotate(0deg)" },
        ],
        { duration: 2200, easing: "ease-out" }
      );
      if (!busy) play(BULB.patterns[0].seq);
    });

    return {
      async start() {
        if (started) return;
        started = true;
        await play(BULB.on);
        switchingOn = false;
        root.style.setProperty("--room", "1");
        idle();
      },
    };
  }

  window.FX = { initBulb, intro, wearHTML, dialHTML, spinDial, initCursor, initSpotlight, initSmoothScroll, rng };
})();

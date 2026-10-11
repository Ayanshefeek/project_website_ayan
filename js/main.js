/*
 * main.js — renders the locker bank + project index and drives the 3D stage.
 *
 * Design notes:
 * - Everything 3D is CSS transforms (perspective + rotateY on a right-hinged
 *   door). A WebGL scene (three.js) was considered, but CSS 3D keeps the text
 *   real, selectable and accessible, needs no build step, and runs smoothly
 *   on phones — which matters more for a project showcase than raw spectacle.
 * - Doors are driven by the spring physics in door.js, not CSS transitions,
 *   so they can be grabbed, dragged, flicked and let go of mid-swing. The
 *   door angle is written to a CSS variable (--a) and everything that should
 *   respond to it — the inner light, the door's shadow, the content reveal,
 *   the cabinet sliding aside — reads from that one number.
 * - Dragging maps the pointer to a door angle by projecting the door through
 *   the same perspective CSS uses, so the edge you grab stays under your
 *   finger even as it swings toward you and grows.
 * - Opening uses a FLIP "shared element" morph: the stage starts exactly over
 *   the clicked locker and grows to the centre, so the eye never loses track
 *   of which locker was opened.
 * - On wide screens the hallway is a "track": a tall section with a sticky
 *   stage, where scroll progress slides a wall of lockers past the camera.
 *   Scroll position stays the single source of truth (no scroll-jacking), so
 *   the browser's own scrollbar, keyboard and anchor links keep working.
 * - Projects are stored oldest -> newest in projects.js and reversed here, so
 *   appending a project automatically puts it in the first locker.
 */
(() => {
  "use strict";

  const { DoorSpring, Sound } = window.DoorKit;
  const FX = window.FX;

  const CONFIG = {
    MORPH_MS: 620,             // locker -> stage grow / shrink
    SLIDE_MS: 360,             // prev/next slide between lockers
    UNLATCH_MS: 140,           // handle lift before the door starts to swing
    STAGE_PERSPECTIVE: 3400,   // px — must match .stage__scene perspective
    STAGE_MAX_DEG: 98,         // fully open stage door (desktop)
    STAGE_MAX_DEG_SMALL: 110,  // phones: swing further so it clears the view
    CABINET_SHIFT: -0.17,      // desktop: cabinet slides left by this × width when open
    PEEK_DEG: 24,              // hallway door angle on hover
    TILT_MAX_DEG: 6,           // per-locker pointer tilt strength
    TILT_EASE: 0.12,           // 0..1, lower = smoother/laggier tilt
    SWIPE_MIN_PX: 60,          // horizontal travel that counts as a swipe
    TAP_SLOP_PX: 5,            // pointer travel below this is a click, not a drag
    HINT_MS: 5200,             // how long the "drag the door" hint stays up
    TRACK_MIN_WIDTH: 900,      // px — below this the hallway is a plain grid
    TRACK_SCROLL_RATIO: 1.15,  // px of scroll per px the wall travels
    TRACK_END_SPACE: 0.78,     // last locker stops this far across the viewport
    SHUFFLE_STEPS: 16,         // names flashed by the shuffle reel
    SHUFFLE_MS: 1500,          // total length of the shuffle spin
    NEW_BADGE_COUNT: 1,        // how many of the newest lockers get a "NEW" tag
  };

  const reduceMotion = window.DoorKit.reduceMotion;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const wide = window.matchMedia("(min-width: 900px)");
  const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";
  const EASE_IN_OUT = "cubic-bezier(.65, 0, .35, 1)";

  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel) => document.querySelector(sel);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // Newest first. `no` keeps the chronological locker number (oldest = 01).
  const lockers = window.PROJECTS.map((p, i) => ({ ...p, no: String(i + 1).padStart(2, "0") })).reverse();

  const row = $("#lockers");
  const stage = $("#stage");
  const scene = $("#scene");
  const cabinet = $("#cabinet");

  const themeStyle = (t) =>
    `--accent:${t.accent};--accent2:${t.accent2};--wall:${t.wall};--light:${t.light};--display:${t.font};`;
  const vents = (n) => `<div class="vents">${"<i></i>".repeat(n)}</div>`;
  const lockerEl = (i) => row.querySelector(`.locker[data-index="${i}"]`);
  // Each locker's combination, derived from its number so it never changes.
  const comboFor = (no) => [(no * 7 + 3) % 40, (no * 13 + 11) % 40, (no * 29 + 5) % 40];

  /* ---------- Locker bank ---------- */

  function doorFront(p, i) {
    return `
      <div class="door__front">
        ${FX.wearHTML(Number(p.no))}
        <div class="plate"><span>No.</span>${p.no}</div>
        ${FX.dialHTML()}
        <div class="label"><span class="label__title">${esc(p.title)}</span><span class="label__period">${esc(p.period)}</span></div>
        <div class="handle"><i></i></div>
        ${vents(5)}
        ${i < CONFIG.NEW_BADGE_COUNT ? '<span class="badge">New</span>' : ""}
        <div class="sheen"></div>
      </div>`;
  }

  // One spring per hallway door: hover swings it ajar, leaving lets it clack shut.
  const hallDoors = [];

  function renderBank() {
    row.innerHTML = lockers
      .map(
        (p, i) => `
        <div class="slot" role="listitem" style="--i:${i}">
          <button class="locker" data-index="${i}" style="${themeStyle(p.theme)}"
                  aria-label="Open locker ${p.no}: ${esc(p.title)}">
            <div class="locker__inside">
              <div class="locker__light"></div>
              <div class="locker__peek">${window.POSTER_ART[p.art]}</div>
            </div>
            <div class="locker__door">${doorFront(p, i)}</div>
          </button>
        </div>`
      )
      .join("");

    row.querySelectorAll(".locker").forEach((el, i) => {
      const door = el.querySelector(".locker__door");
      hallDoors[i] = new DoorSpring({
        max: CONFIG.PEEK_DEG,
        open: { k: 140, z: 0.55 },
        close: { k: 190, z: 0.7 },
        bounce: 0.35,
        overswing: 4,
        onUpdate: (a) => {
          door.style.setProperty("--a", a.toFixed(2));
          el.style.setProperty("--glow", clamp(a / CONFIG.PEEK_DEG, 0, 1).toFixed(3));
        },
      });
      const peek = (on) => hallDoors[i].setTarget(on ? CONFIG.PEEK_DEG : 0, on ? 60 : -40);
      el.addEventListener("pointerenter", () => peek(true));
      el.addEventListener("pointerleave", () => peek(false));
      el.addEventListener("focus", () => peek(true));
      el.addEventListener("blur", () => peek(false));
    });

    row.addEventListener("click", (e) => {
      // A tilted locker can hand the hit-test to its slot wrapper rather than
      // the button inside it, so resolve the locker via the slot.
      const slot = e.target.closest(".slot");
      const btn = slot && slot.querySelector(".locker");
      if (btn) request(() => openLocker(Number(btn.dataset.index)));
    });

    // Lockers rise in, one after another, the first time the bank is seen.
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.12 }
    );
    row.querySelectorAll(".slot").forEach((s) => io.observe(s));
  }

  /*
   * Pointer tilt: each locker leans toward the cursor and a soft highlight
   * follows it across the metal. Values are eased toward their target every
   * frame (lerp) instead of jumping on each pointermove, which is what makes
   * it feel fluid. The rAF loop stops itself once everything has settled.
   */
  function enableTilt() {
    if (reduceMotion || !finePointer) return;
    const states = new Map();
    let running = false;

    const stateFor = (el) => {
      if (!states.has(el)) states.set(el, { rx: 0, ry: 0, tx: 0, ty: 0, mx: 50, my: 50, tmx: 50, tmy: 50 });
      return states.get(el);
    };

    function frame() {
      let activeTilt = false;
      states.forEach((s, el) => {
        s.rx += (s.tx - s.rx) * CONFIG.TILT_EASE;
        s.ry += (s.ty - s.ry) * CONFIG.TILT_EASE;
        s.mx += (s.tmx - s.mx) * CONFIG.TILT_EASE;
        s.my += (s.tmy - s.my) * CONFIG.TILT_EASE;
        el.style.setProperty("--rx", `${s.rx.toFixed(3)}deg`);
        el.style.setProperty("--ry", `${s.ry.toFixed(3)}deg`);
        el.style.setProperty("--mx", `${s.mx.toFixed(1)}%`);
        el.style.setProperty("--my", `${s.my.toFixed(1)}%`);
        if (Math.abs(s.tx - s.rx) > 0.01 || Math.abs(s.ty - s.ry) > 0.01) activeTilt = true;
      });
      running = activeTilt;
      if (activeTilt) requestAnimationFrame(frame);
    }
    const kick = () => {
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    };

    row.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".locker");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const s = stateFor(el);
      s.tx = (0.5 - y) * CONFIG.TILT_MAX_DEG;
      s.ty = (x - 0.5) * CONFIG.TILT_MAX_DEG;
      s.tmx = x * 100;
      s.tmy = y * 100;
      kick();
    });
    row.addEventListener("pointerout", (e) => {
      const el = e.target.closest(".locker");
      if (el && !el.contains(e.relatedTarget)) {
        Object.assign(stateFor(el), { tx: 0, ty: 0, tmx: 50, tmy: 50 });
        kick();
      }
    });
  }

  /* ---------- Index + filters ---------- */

  function renderIndex() {
    const list = $("#index-list");
    list.innerHTML = lockers
      .map(
        (p, i) => `
        <li class="entry" data-index="${i}" style="${themeStyle(p.theme)}">
          <button class="entry__btn" aria-label="Open ${esc(p.title)}">
            <span class="entry__no">${p.no}</span>
            <span class="entry__main">
              <span class="entry__title">${esc(p.title)}</span>
              <span class="entry__tag">${esc(p.tagline)}</span>
            </span>
            <span class="entry__tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</span>
            <span class="entry__period">${esc(p.period)}</span>
            <span class="entry__arrow" aria-hidden="true">→</span>
          </button>
        </li>`
      )
      .join("");

    list.addEventListener("click", (e) => {
      const li = e.target.closest(".entry");
      if (li) request(() => openLocker(Number(li.dataset.index)));
    });
    // Hovering an index row peeks the matching locker's door open.
    const peek = (e, on) => {
      const li = e.target.closest(".entry");
      if (li && !li.contains(e.relatedTarget)) hallDoors[li.dataset.index].setTarget(on ? CONFIG.PEEK_DEG : 0);
    };
    list.addEventListener("pointerover", (e) => peek(e, true));
    list.addEventListener("pointerout", (e) => peek(e, false));

    // Topic filters, in order of how many projects use them.
    const counts = {};
    lockers.forEach((p) => p.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const topics = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const filters = $("#filters");
    filters.innerHTML = ["All", ...topics]
      .map((t, k) => `<button class="chip${k ? "" : " is-active"}" data-topic="${esc(t)}" aria-pressed="${!k}">${esc(t)}</button>`)
      .join("");
    filters.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      filters.querySelectorAll(".chip").forEach((c) => {
        c.classList.toggle("is-active", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      });
      applyFilter(chip.dataset.topic);
    });
  }

  function applyFilter(topic) {
    lockers.forEach((p, i) => {
      const match = topic === "All" || p.tags.includes(topic);
      lockerEl(i).closest(".slot").classList.toggle("is-dim", !match);
      document.querySelector(`.entry[data-index="${i}"]`).classList.toggle("is-hidden", !match);
    });
  }

  /* ---------- Stage: the big locker ---------- */

  function cabinetHTML(p, i) {
    const stickers = p.stack
      .map((s, k) => `<span class="sticker" style="--r:${((k * 37) % 17) - 8}deg">${esc(s)}</span>`)
      .join("");
    const repo = p.repo
      ? `<a class="repo-btn" href="${p.repo}" target="_blank" rel="noopener">View on GitHub <span aria-hidden="true">↗</span></a>`
      : `<span class="repo-btn repo-btn--muted">Repository private</span>`;
    let d = 0;
    const r = () => `style="--d:${d++}"`; // stagger index for the reveal

    return `
      <div class="cabinet__frame">
        <div class="cabinet__interior" inert>
          <div class="tube"></div>
          <div class="interior__scroll">
            <figure class="poster reveal" ${r()}>
              <i class="tape tape--tl"></i><i class="tape tape--tr"></i><i class="tape tape--bl"></i><i class="tape tape--br"></i>
              <svg class="halo" viewBox="0 0 120 30" aria-hidden="true"><ellipse cx="60" cy="15" rx="56" ry="10"/><path d="M92 4 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1z"/></svg>
              <figcaption class="poster__kicker">Locker ${p.no} · ${esc(p.period)}</figcaption>
              <h2 class="poster__title" id="cabinet-title">${esc(p.title)}</h2>
              <div class="poster__art">${window.POSTER_ART[p.art]}</div>
              <p class="poster__tag">${esc(p.tagline)}</p>
            </figure>

            <div class="details">
              <div class="notes">
                <section class="reveal" ${r()}>
                  <h3 class="scrawl">About this..</h3>
                  <p>${esc(p.about)}</p>
                </section>
                <section class="reveal" ${r()}>
                  <h3 class="scrawl">Built to —</h3>
                  <p>${esc(p.mission)}</p>
                </section>
              </div>
              <section class="inside reveal" ${r()}>
                <h3 class="scrawl">What's inside</h3>
                <ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
              </section>
            </div>

            <div class="interior__foot reveal" ${r()}>
              <div class="chips">${p.stack.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
              ${repo}
            </div>
          </div>
          <div class="shelf" aria-hidden="true">
            <div class="books"><i></i><i></i><i></i></div>
            <div class="tablet"></div>
            <div class="buds"></div>
          </div>
        </div>

        <div class="cabinet__door" role="button" tabindex="0" aria-label="Locker door — drag to swing it, or press Enter to open or close">
          <i class="door__edge"></i>
          <div class="door__face">${doorFront(p, i)}</div>
          <div class="door__face door__back">
            <div class="brand-sticker">${esc(p.title)}<small>locker ${p.no}</small></div>
            <div class="stickers">${stickers}</div>
            ${p.repo ? `<a class="sticker sticker--gh" href="${p.repo}" target="_blank" rel="noopener" tabindex="-1">GitHub ↗</a>` : ""}
            ${vents(5)}
            <div class="latch"></div>
          </div>
        </div>
      </div>`;
  }

  const stageMax = () => (wide.matches ? CONFIG.STAGE_MAX_DEG : CONFIG.STAGE_MAX_DEG_SMALL);
  let revealed = false;
  let lit = false;

  // Everything inside the cabinet follows the door's live angle.
  const stageDoor = new DoorSpring({
    max: CONFIG.STAGE_MAX_DEG,
    open: { k: 62, z: 0.58 },
    close: { k: 170, z: 0.62 },
    bounce: 0.28,
    overswing: 7,
    closePull: 70, // heavy door: it accelerates into the frame
    onUpdate(a) {
      const p = clamp(a / stageDoor.o.max, 0, 1);
      const rad = (a * Math.PI) / 180;
      cabinet.style.setProperty("--a", a.toFixed(2));
      cabinet.style.setProperty("--p", p.toFixed(4));
      // Faces darken as they turn away from the light.
      cabinet.style.setProperty("--shade", ((1 - Math.abs(Math.cos(rad))) * 0.5).toFixed(3));

      if (!lit && p > 0.12) {
        lit = true;
        cabinet.classList.add("is-lit");
      } else if (lit && p < 0.02) {
        lit = false;
        cabinet.classList.remove("is-lit");
      }
      if (!revealed && p > 0.5) setRevealed(true);
      else if (revealed && p < 0.18) setRevealed(false);
    },
    onImpact(speed) {
      Sound.slam(speed);
      cabinet.classList.remove("is-unlatched");
      // The whole cabinet shudders a little when the door slams.
      const s = clamp(speed / 450, 0.15, 1);
      const frame = cabinet.querySelector(".cabinet__frame");
      const dial = cabinet.querySelector(".cabinet__door .dial");
      if (dial && !reduceMotion) {
        dial.animate([{ rotate: "0deg" }, { rotate: `${-7 * s}deg` }, { rotate: `${4 * s}deg` }, { rotate: "0deg" }], { duration: 380, easing: "ease-out" });
      }
      if (frame && !reduceMotion) {
        frame.animate(
          [
            { transform: "none" },
            { transform: `translate3d(${-3 * s}px, ${1 * s}px, 0)` },
            { transform: `translate3d(${2 * s}px, 0, 0)` },
            { transform: `translate3d(${-1 * s}px, 0, 0)` },
            { transform: "none" },
          ],
          { duration: 260, easing: "ease-out" }
        );
      }
    },
  });

  function setRevealed(on) {
    revealed = on;
    cabinet.classList.toggle("is-revealed", on);
    const interior = cabinet.querySelector(".cabinet__interior");
    if (!interior) return;
    if (on) interior.removeAttribute("inert");
    else interior.setAttribute("inert", "");
  }

  // Dial the combination, lift the handle (with a click), then let the door swing.
  let unlocking = false;
  async function unlatchAndOpen(kick = 70, quick = false) {
    if (unlocking) return;
    unlocking = true;
    const face = cabinet.querySelector(".cabinet__door .dial__face");
    const spin = FX.spinDial(face, comboFor(Number(lockers[current].no)), () => Sound.tick(), quick);
    if (!quick) await spin; // the full combination plays out; a quick twist overlaps the unlatch
    unlocking = false;
    if (stageDoor.isOpen || stageDoor.dragging) return;
    cabinet.classList.add("is-unlatched");
    Sound.latch();
    await wait(CONFIG.UNLATCH_MS);
    stageDoor.setTarget(stageDoor.o.max, kick);
    setTimeout(() => cabinet.classList.remove("is-unlatched"), 380);
  }

  function shutDoor(kick = -140) {
    stageDoor.setTarget(0, kick);
    return stageDoor.settled();
  }

  function toggleDoor() {
    dismissHint();
    if (unlocking) return;
    if (stageDoor.isOpen) shutDoor();
    else unlatchAndOpen(70, true);
  }

  /*
   * Drag-to-swing. We need the door angle whose grabbed point lands under the
   * pointer. The door turns about its right edge, toward the viewer, inside a
   * CSS perspective — so the grabbed point at distance g from the hinge sits
   * at  X = hinge − g·cos(a),  Z = g·sin(a), and appears on screen at
   *     x = ox + (X − ox) · P / (P − Z)
   * (ox = perspective origin, P = perspective). That isn't invertible in
   * closed form once the cabinet's slide-aside is included, so we search the
   * angle numerically near the previous one — a few hundred cheap evaluations
   * per pointer move.
   */
  function measureGeometry() {
    const r = scene.getBoundingClientRect();
    return {
      left: r.left,
      width: r.width,
      ox: r.left + r.width / 2,
      P: CONFIG.STAGE_PERSPECTIVE,
      shift: wide.matches ? CONFIG.CABINET_SHIFT * r.width : 0,
      max: stageDoor.o.max,
    };
  }
  function projectX(a, g, geo) {
    const p = clamp(a / geo.max, 0, 1);
    const hinge = geo.left + geo.width + geo.shift * p;
    const rad = (a * Math.PI) / 180;
    const X = hinge - g * Math.cos(rad);
    const Z = Math.min(g * Math.sin(rad), geo.P * 0.9);
    return geo.ox + ((X - geo.ox) * geo.P) / (geo.P - Z);
  }
  function solveGrab(a, x, geo) {
    let best = geo.width * 0.6;
    let err = Infinity;
    for (let g = geo.width * 0.12; g <= geo.width; g += geo.width / 240) {
      const e = Math.abs(projectX(a, g, geo) - x);
      if (e < err) [err, best] = [e, g];
    }
    return best;
  }
  function solveAngle(x, g, prev, geo) {
    let best = prev;
    let err = Infinity;
    const lo = Math.max(-2, prev - 50);
    const hi = Math.min(geo.max + 14, prev + 50);
    for (let a = lo; a <= hi; a += 0.25) {
      const e = Math.abs(projectX(a, g, geo) - x);
      if (e < err) [err, best] = [e, a];
    }
    return best;
  }

  // When a drag ends over the backdrop, the browser fires a click there;
  // remember when drags end so that click doesn't close the locker.
  let lastDragEnd = 0;

  function bindDoorDrag() {
    let drag = null;

    cabinet.addEventListener("pointerdown", (e) => {
      const door = e.target.closest(".cabinet__door");
      if (!door || e.button !== 0 || morphing || e.target.closest("a")) return;
      e.preventDefault();
      door.setPointerCapture(e.pointerId);
      const geo = measureGeometry();
      drag = { id: e.pointerId, x0: e.clientX, geo, g: solveGrab(stageDoor.a, e.clientX, geo), moved: false, from: stageDoor.a };
      stageDoor.grab();
      cabinet.classList.add("is-grabbing");
      // Sweeping across the interior while dragging must not select its text.
      window.getSelection()?.removeAllRanges();
    });

    cabinet.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) < CONFIG.TAP_SLOP_PX) return;
      if (!drag.moved) {
        drag.moved = true;
        dismissHint(true);
        if (drag.from < 1) {
          cabinet.classList.add("is-unlatched");
          Sound.latch();
        }
      }
      stageDoor.drag(solveAngle(e.clientX, drag.g, stageDoor.a, drag.geo));
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const wasTap = !drag.moved;
      if (!wasTap) lastDragEnd = performance.now();
      drag = null;
      cabinet.classList.remove("is-grabbing");
      if (wasTap) {
        stageDoor.dragging = false;
        toggleDoor();
      } else {
        stageDoor.release();
        setTimeout(() => cabinet.classList.remove("is-unlatched"), 300);
      }
    };
    cabinet.addEventListener("pointerup", end);
    cabinet.addEventListener("pointercancel", end);

    cabinet.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("cabinet__door")) {
        e.preventDefault();
        toggleDoor();
      }
    });
  }

  /* ---------- Hint + sound toggle ---------- */

  let hintTimer = 0;
  function showHint() {
    if (store.get("lockers.dragged")) return;
    const hint = $("#hint");
    hint.classList.add("is-shown");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove("is-shown"), CONFIG.HINT_MS);
  }
  function dismissHint(learned) {
    $("#hint").classList.remove("is-shown");
    if (learned) store.set("lockers.dragged", "1");
  }

  function bindSound() {
    const btn = $("#sound");
    const render = () => {
      btn.setAttribute("aria-pressed", String(Sound.enabled));
      btn.querySelector(".sound__label").textContent = Sound.enabled ? "Sound on" : "Sound off";
    };
    Sound.enabled = store.get("lockers.sound") === "1";
    render();
    btn.addEventListener("click", () => {
      Sound.enabled = !Sound.enabled;
      store.set("lockers.sound", Sound.enabled ? "1" : "0");
      render();
      Sound.latch();
    });
  }

  /* ---------- Stage: open / close / browse ---------- */

  let current = -1;
  let busy = false;
  let morphing = false;
  let pending = null;

  // Run an action now, or once the running animation finishes (latest wins).
  function request(action) {
    if (busy) {
      pending = action;
      return;
    }
    busy = true;
    Promise.resolve(action()).finally(() => {
      busy = false;
      const next = pending;
      pending = null;
      if (next) request(next);
    });
  }

  // The transform that places the stage scene exactly over a hallway locker.
  function flipFrom(el) {
    const from = el.getBoundingClientRect();
    const to = scene.getBoundingClientRect();
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  }

  function fill(index) {
    const p = lockers[index];
    current = index;
    cabinet.setAttribute("style", themeStyle(p.theme));
    cabinet.className = "cabinet";
    revealed = lit = false;
    cabinet.innerHTML = cabinetHTML(p, index);
    stageDoor.o.max = stageMax();
    stageDoor.reset(0);
    $("#stage-no").textContent = p.no;
    $("#stage-title").textContent = p.title;
    const prev = lockers[(index - 1 + lockers.length) % lockers.length];
    const next = lockers[(index + 1) % lockers.length];
    $("#prev-label").textContent = prev.title;
    $("#next-label").textContent = next.title;
    $("#dots").querySelectorAll("i").forEach((d, k) => d.classList.toggle("is-on", k === index));
    history.replaceState(null, "", `#${p.id}`);
  }

  async function openLocker(index) {
    if (!stage.hidden) return browseTo(index);
    const origin = lockerEl(index);
    fill(index);
    stage.hidden = false;
    document.body.classList.add("no-scroll");
    if (lenis) lenis.stop();
    stage.classList.add("is-visible");
    origin.classList.add("is-away"); // the locker "leaves" the bank
    hallDoors[index].reset(0);
    cabinet.focus({ preventScroll: true });

    morphing = true;
    if (!reduceMotion) {
      await scene.animate(
        [
          { transform: flipFrom(origin), opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        { duration: CONFIG.MORPH_MS, easing: EASE_OUT }
      ).finished;
    }
    morphing = false;
    await wait(60);
    showHint();
    await unlatchAndOpen();
    await wait(300);
  }

  async function closeLocker() {
    if (stage.hidden) return;
    const origin = lockerEl(current);
    dismissHint();
    stageDoor.dragging = false;
    if (stageDoor.a > 0.5 || stageDoor.isOpen) {
      await shutDoor(-160);
      await wait(120);
    }
    stage.classList.remove("is-visible");
    morphing = true;
    if (!reduceMotion) {
      await scene.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: flipFrom(origin), opacity: 0.6 },
        ],
        { duration: CONFIG.MORPH_MS * 0.85, easing: EASE_IN_OUT }
      ).finished;
    }
    morphing = false;
    origin.classList.remove("is-away");
    stage.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lenis) lenis.start();
    history.replaceState(null, "", location.pathname + location.search);
    origin.focus({ preventScroll: true });
  }

  // Close the door, slide the cabinet out, slide the next one in, open it.
  async function browseTo(index, dir = Math.sign(index - current) || 1) {
    if (index === current) return;
    dismissHint();
    lockerEl(current).classList.remove("is-away");
    stageDoor.dragging = false;
    if (stageDoor.a > 0.5 || stageDoor.isOpen) await shutDoor(-200);
    const slide = (from, to, easing) =>
      reduceMotion
        ? Promise.resolve()
        : scene.animate(
            [
              { transform: `translateX(${from}%) rotateY(${-from / 4}deg)`, opacity: from ? 0 : 1 },
              { transform: `translateX(${to}%) rotateY(${-to / 4}deg)`, opacity: to ? 0 : 1 },
            ],
            { duration: CONFIG.SLIDE_MS, easing }
          ).finished;
    morphing = true;
    await slide(0, -12 * dir, EASE_IN_OUT);
    fill(index);
    lockerEl(index).classList.add("is-away");
    hallDoors[index].reset(0);
    await slide(12 * dir, 0, EASE_OUT);
    morphing = false;
    await unlatchAndOpen();
    await wait(250);
  }

  // Arrow presses made mid-animation add up, so five quick clicks move five
  // lockers (in one slide) instead of the extra clicks being lost.
  let queuedSteps = 0;
  const step = (dir) => {
    queuedSteps += dir;
    request(() => {
      const d = queuedSteps;
      queuedSteps = 0;
      if (d) return browseTo((((current + d) % lockers.length) + lockers.length) % lockers.length, Math.sign(d));
    });
  };

  function bindStage() {
    $("#stage-total").textContent = String(lockers.length).padStart(2, "0");
    $("#dots").innerHTML = "<i></i>".repeat(lockers.length);

    stage.addEventListener("click", (e) => {
      if (performance.now() - lastDragEnd < 300) return;
      if (e.target.closest("[data-close]")) request(closeLocker);
    });
    $("#prev").addEventListener("click", () => step(-1));
    $("#next").addEventListener("click", () => step(1));

    document.addEventListener("keydown", (e) => {
      if (stage.hidden) return;
      if (e.key === "Escape") request(closeLocker);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Tab") trapFocus(e);
    });

    // Swipe left/right on touch screens to browse — but not when the swipe
    // starts on the door, which is being dragged instead.
    let sx = 0, sy = 0, onDoor = false;
    stage.addEventListener(
      "touchstart",
      (e) => {
        [sx, sy] = [e.touches[0].clientX, e.touches[0].clientY];
        onDoor = !!e.target.closest(".cabinet__door");
      },
      { passive: true }
    );
    stage.addEventListener(
      "touchend",
      (e) => {
        if (onDoor) return;
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > CONFIG.SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );

    bindDoorDrag();
  }

  // Keep keyboard focus inside the open dialog.
  function trapFocus(e) {
    const items = [...stage.querySelectorAll("button, a[href], [tabindex='0']")].filter(
      (el) => !el.closest("[inert]") && el.offsetParent !== null
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- Scroll-driven hallway ---------- */

  const section = $("#lockers-section");
  const wall = $("#wall");
  const track = { on: false, travel: 0, wallLeft: 0 };

  function initTrack() {
    const mq = window.matchMedia(`(min-width: ${CONFIG.TRACK_MIN_WIDTH}px)`);
    const layout = () => {
      track.on = mq.matches && !reduceMotion;
      document.documentElement.classList.toggle("is-track", track.on);
      if (!track.on) {
        section.style.height = "";
        wall.style.removeProperty("--x");
        return;
      }
      const bankWidth = wall.querySelector(".bank").offsetWidth;
      track.wallLeft = wall.offsetLeft;
      track.travel = Math.max(0, bankWidth + track.wallLeft - innerWidth * CONFIG.TRACK_END_SPACE);
      section.style.height = `${Math.round(innerHeight + track.travel * CONFIG.TRACK_SCROLL_RATIO)}px`;
      update();
    };
    const update = () => {
      if (!track.on) return;
      const r = section.getBoundingClientRect();
      const span = r.height - innerHeight;
      const p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
      wall.style.setProperty("--x", `${(-p * track.travel).toFixed(1)}px`);
      section.style.setProperty("--prog", p.toFixed(4));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", layout);
    mq.addEventListener("change", layout);
    layout();
  }

  // The scroll position that brings locker i to the middle of the view.
  function scrollYFor(i) {
    const slot = lockerEl(i).closest(".slot");
    const top = section.getBoundingClientRect().top + window.scrollY;
    if (!track.on) {
      const r = slot.getBoundingClientRect();
      return r.top + window.scrollY - (innerHeight - r.height) / 2;
    }
    const centre = slot.offsetLeft + slot.offsetWidth / 2;
    const want = innerWidth * 0.42 - track.wallLeft;
    const p = track.travel ? clamp((centre - want) / track.travel, 0, 1) : 0;
    return top + p * (section.offsetHeight - innerHeight);
  }
  function glideTo(y, seconds) {
    if (lenis) lenis.scrollTo(y, { duration: seconds });
    else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  }

  // Ceiling lights flicker on the first time the hallway comes into view.
  function initLights() {
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting) {
          section.classList.add("lights-on");
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(section);
  }

  /* ---------- Shuffle ---------- */

  let lastShuffle = -1;
  function initShuffle() {
    if (!finePointer) $(".hallway__hint").textContent = "Tap a locker to open it";
    const btn = $("#shuffle");
    const text = $("#shuffle-text");
    const idle = text.textContent;
    let spinning = false;

    btn.addEventListener("click", async () => {
      if (spinning || !stage.hidden) return;
      spinning = true;
      btn.classList.add("is-spinning");
      let pick;
      do pick = Math.floor(Math.random() * lockers.length);
      while (lockers.length > 1 && pick === lastShuffle);
      lastShuffle = pick;

      // Glide the hallway to the winner while the reel spins.
      glideTo(scrollYFor(pick), CONFIG.SHUFFLE_MS / 1000);

      // Reel: flash names quickly, slowing down (ease-out on the delays),
      // flicking each named locker's door as it passes. Lands on `pick`.
      const steps = reduceMotion ? 1 : CONFIG.SHUFFLE_STEPS;
      const start = (pick - steps + 1 + lockers.length * 4) % lockers.length;
      let elapsed = 0;
      for (let k = 0; k < steps; k++) {
        const i = (start + k) % lockers.length;
        text.textContent = `No. ${lockers[i].no} · ${lockers[i].title}`;
        text.classList.remove("roll");
        void text.offsetWidth; // restart the roll animation
        text.classList.add("roll");
        hallDoors[i].setTarget(CONFIG.PEEK_DEG * 0.6, 50);
        setTimeout(() => hallDoors[i].setTarget(0), 110);
        Sound.tick();
        const t = (k + 1) / steps;
        const delay = 35 + 190 * t * t * t;
        elapsed += delay;
        await wait(delay);
      }
      btn.classList.add("is-landed");
      hallDoors[pick].setTarget(CONFIG.PEEK_DEG);
      await wait(Math.max(380, CONFIG.SHUFFLE_MS - elapsed));
      request(() => openLocker(pick));
      setTimeout(() => {
        text.textContent = idle;
        btn.classList.remove("is-spinning", "is-landed");
        spinning = false;
      }, 900);
    });
  }

  /* ---------- Page chrome ---------- */

  function renderChrome() {
    const years = window.PROJECTS.flatMap((p) => p.period.match(/\d{4}/g) || []).map(Number);
    $("#stat-count").textContent = String(lockers.length).padStart(2, "0");
    $("#stat-range").textContent = `${Math.min(...years)} — ${Math.max(...years)}`;
    $("#year").textContent = new Date().getFullYear();

    // Nav gains a frosted background once the page scrolls.
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Deep link: /#cinesearch opens that locker straight away.
  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = lockers.findIndex((p) => p.id === id);
    if (i >= 0) request(() => openLocker(i));
  }

  const lenis = FX.initSmoothScroll();
  renderChrome();
  renderBank();
  renderIndex();
  enableTilt();
  bindStage();
  bindSound();
  initTrack();
  initLights();
  initShuffle();
  FX.initCursor();
  FX.initSpotlight($("#hall-stage"));
  // Fonts can change locker widths, so measure the track again once they're in.
  const bulb = FX.initBulb();
  FX.intro().then(() => {
    bulb.start(); // the room's light stutters on once the curtain is gone
    window.dispatchEvent(new Event("resize"));
    openFromHash();
  });
})();

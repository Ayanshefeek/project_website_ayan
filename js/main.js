/*
 * main.js — renders the locker bank + project index and drives the 3D stage.
 *
 * Design notes:
 * - Everything 3D is CSS transforms (perspective + rotateY on a right-hinged
 *   door). A WebGL scene (three.js) was considered, but CSS 3D keeps the text
 *   real, selectable and accessible, needs no build step, and runs smoothly
 *   on phones — which matters more for a project showcase than raw spectacle.
 * - Projects are stored oldest -> newest in projects.js and reversed here, so
 *   appending a project automatically puts it in the first locker.
 * - Opening uses a FLIP "shared element" morph: the stage starts exactly over
 *   the clicked locker and grows to the centre, so the eye never loses track
 *   of which locker was opened. The morph runs on the stage scene with the
 *   Web Animations API, while door/open state stays in CSS classes on the
 *   cabinet — keeping the two on different elements stops them fighting over
 *   the same `transform`.
 * - Clicks that arrive mid-animation are queued (latest wins) rather than
 *   dropped, so rapid browsing never feels unresponsive.
 */
(() => {
  "use strict";

  const CONFIG = {
    DOOR_SWING_MS: 950,        // must match --swing in styles.css
    DOOR_CLOSE_MS: 620,        // must match --swing-close in styles.css
    MORPH_MS: 620,             // locker -> stage grow / shrink
    SLIDE_MS: 360,             // prev/next slide between lockers
    TILT_MAX_DEG: 7,           // per-locker pointer tilt strength
    TILT_EASE: 0.12,           // 0..1, lower = smoother/laggier tilt
    SWIPE_MIN_PX: 60,          // horizontal travel that counts as a swipe
    NEW_BADGE_COUNT: 1,        // how many of the newest lockers get a "NEW" tag
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";
  const EASE_IN_OUT = "cubic-bezier(.65, 0, .35, 1)";

  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel) => document.querySelector(sel);

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

  /* ---------- Locker bank ---------- */

  function doorFront(p, i) {
    return `
      <div class="door__front">
        <div class="plate"><span>No.</span>${p.no}</div>
        <div class="label"><span class="label__title">${esc(p.title)}</span><span class="label__period">${esc(p.period)}</span></div>
        <div class="handle"><i></i></div>
        ${vents(5)}
        ${i < CONFIG.NEW_BADGE_COUNT ? '<span class="badge">New</span>' : ""}
        <div class="sheen"></div>
      </div>`;
  }

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
      let active = false;
      states.forEach((s, el) => {
        s.rx += (s.tx - s.rx) * CONFIG.TILT_EASE;
        s.ry += (s.ty - s.ry) * CONFIG.TILT_EASE;
        s.mx += (s.tmx - s.mx) * CONFIG.TILT_EASE;
        s.my += (s.tmy - s.my) * CONFIG.TILT_EASE;
        el.style.setProperty("--rx", `${s.rx.toFixed(3)}deg`);
        el.style.setProperty("--ry", `${s.ry.toFixed(3)}deg`);
        el.style.setProperty("--mx", `${s.mx.toFixed(1)}%`);
        el.style.setProperty("--my", `${s.my.toFixed(1)}%`);
        if (Math.abs(s.tx - s.rx) > 0.01 || Math.abs(s.ty - s.ry) > 0.01) active = true;
      });
      running = active;
      if (active) requestAnimationFrame(frame);
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
    row.addEventListener(
      "pointerleave",
      () => {
        states.forEach((s) => Object.assign(s, { tx: 0, ty: 0, tmx: 50, tmy: 50 }));
        kick();
      }
    );
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
      if (li) lockerEl(li.dataset.index).classList.toggle("is-peek", on);
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

  /* ---------- Stage: open / close / browse ---------- */

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

        <div class="cabinet__door" role="button" tabindex="0" aria-label="Open or close the locker door">
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

  let current = -1;
  let busy = false;
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
    cabinet.classList.remove("is-open");
    cabinet.innerHTML = cabinetHTML(p, index);
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
    stage.classList.add("is-visible");
    origin.classList.add("is-away"); // the locker "leaves" the bank

    if (!reduceMotion) {
      await scene.animate(
        [
          { transform: flipFrom(origin), opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        { duration: CONFIG.MORPH_MS, easing: EASE_OUT }
      ).finished;
    }
    setDoor(true);
    await wait(CONFIG.DOOR_SWING_MS * 0.5);
  }

  async function closeLocker() {
    if (stage.hidden) return;
    const origin = lockerEl(current);
    setDoor(false);
    await wait(CONFIG.DOOR_CLOSE_MS);
    stage.classList.remove("is-visible");
    if (!reduceMotion) {
      await scene.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: flipFrom(origin), opacity: 0.6 },
        ],
        { duration: CONFIG.MORPH_MS * 0.85, easing: EASE_IN_OUT }
      ).finished;
    }
    origin.classList.remove("is-away");
    stage.hidden = true;
    document.body.classList.remove("no-scroll");
    history.replaceState(null, "", location.pathname + location.search);
    origin.focus({ preventScroll: true });
  }

  // Close the door, slide the cabinet out, slide the next one in, open it.
  async function browseTo(index, dir = Math.sign(index - current) || 1) {
    if (index === current) return;
    lockerEl(current).classList.remove("is-away");
    if (cabinet.classList.contains("is-open")) {
      setDoor(false);
      await wait(CONFIG.DOOR_CLOSE_MS * 0.8);
    }
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
    await slide(0, -12 * dir, EASE_IN_OUT);
    fill(index);
    lockerEl(index).classList.add("is-away");
    await slide(12 * dir, 0, EASE_OUT);
    setDoor(true);
    await wait(CONFIG.DOOR_SWING_MS * 0.5);
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

  function setDoor(open) {
    cabinet.classList.toggle("is-open", open);
    const interior = cabinet.querySelector(".cabinet__interior");
    if (open) {
      interior.removeAttribute("inert");
      const link = cabinet.querySelector("a.repo-btn");
      (link || cabinet.querySelector(".cabinet__door")).focus({ preventScroll: true });
    } else {
      interior.setAttribute("inert", "");
    }
  }

  function bindStage() {
    $("#stage-total").textContent = String(lockers.length).padStart(2, "0");
    $("#dots").innerHTML = "<i></i>".repeat(lockers.length);

    stage.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return request(closeLocker);
      // Clicking the door toggles it, like a real locker.
      if (e.target.closest(".cabinet__door") && !e.target.closest("a")) {
        setDoor(!cabinet.classList.contains("is-open"));
      }
    });
    cabinet.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("cabinet__door")) {
        e.preventDefault();
        setDoor(!cabinet.classList.contains("is-open"));
      }
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

    // Swipe left/right on touch screens to browse lockers.
    let sx = 0, sy = 0;
    stage.addEventListener("touchstart", (e) => ([sx, sy] = [e.touches[0].clientX, e.touches[0].clientY]), { passive: true });
    stage.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > CONFIG.SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );
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

  renderChrome();
  renderBank();
  renderIndex();
  enableTilt();
  bindStage();
  openFromHash();
})();

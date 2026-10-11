/*
 * main.js — renders the locker hallway and drives the 3D open/close stage.
 *
 * Design notes:
 * - Everything 3D is CSS transforms (perspective + rotateY on a right-hinged
 *   door). A WebGL scene (three.js) was considered, but CSS 3D keeps the text
 *   real, selectable and accessible, needs no build step, and runs smoothly
 *   on phones — which matters more for a project showcase than raw spectacle.
 * - Projects are stored oldest -> newest in projects.js and reversed here, so
 *   appending a project automatically puts it in the first locker.
 * - The detail view is a single reusable "cabinet" that is re-filled per
 *   project, rather than eight hidden dialogs in the DOM.
 */
(() => {
  "use strict";

  const CONFIG = {
    DOOR_SWING_MS: 900,      // must match --swing in styles.css
    STAGE_ENTER_MS: 420,     // delay before the door starts to swing
    TILT_MAX_DEG: 4,         // hallway parallax strength
    NEW_BADGE_COUNT: 1,      // how many of the newest lockers get a "NEW" tag
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Newest first. `no` keeps the chronological locker number (oldest = 01).
  const lockers = window.PROJECTS.map((p, i) => ({ ...p, no: String(i + 1).padStart(2, "0") })).reverse();

  const $ = (sel) => document.querySelector(sel);
  const row = $("#lockers");
  const stage = $("#stage");
  const cabinet = $("#cabinet");

  const themeStyle = (t) =>
    `--accent:${t.accent};--accent2:${t.accent2};--wall:${t.wall};--light:${t.light};--display:${t.font};`;

  const vents = (n) => `<div class="vents">${"<i></i>".repeat(n)}</div>`;

  /* ---------- Hallway ---------- */

  function doorFront(p, i) {
    return `
      <div class="door__front">
        <div class="plate"><span>No.</span>${p.no}</div>
        ${vents(5)}
        <div class="label"><span class="label__title">${esc(p.title)}</span><span class="label__period">${esc(p.period)}</span></div>
        <div class="handle"><i></i></div>
        ${i < CONFIG.NEW_BADGE_COUNT ? '<span class="badge">NEW</span>' : ""}
        <div class="sheen"></div>
      </div>`;
  }

  function renderHallway() {
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
          <p class="slot__tag">${esc(p.tagline)}</p>
        </div>`
      )
      .join("");

    $("#count").textContent = lockers.length;
    $("#year").textContent = new Date().getFullYear();

    row.addEventListener("click", (e) => {
      // With the 3D parallax tilt applied, hit-testing can land on the slot
      // wrapper rather than the button inside it, so resolve via the slot.
      const slot = e.target.closest(".slot");
      const btn = slot && slot.querySelector(".locker");
      if (btn) openLocker(Number(btn.dataset.index), btn);
    });

    // Lockers slide in from the depth of the hallway as they enter view.
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.15 }
    );
    row.querySelectorAll(".slot").forEach((s) => io.observe(s));
  }

  // Gentle parallax: the whole wall of lockers tilts toward the pointer.
  function enableParallax() {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    window.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - 0.5;
        const y = e.clientY / innerHeight - 0.5;
        document.documentElement.style.setProperty("--tilt-x", `${(-y * CONFIG.TILT_MAX_DEG).toFixed(2)}deg`);
        document.documentElement.style.setProperty("--tilt-y", `${(x * CONFIG.TILT_MAX_DEG).toFixed(2)}deg`);
      });
    });
  }

  /* ---------- Open locker stage ---------- */

  function cabinetHTML(p, i) {
    const stickers = p.stack
      .map((s, k) => `<span class="sticker" style="--r:${((k * 37) % 17) - 8}deg">${esc(s)}</span>`)
      .join("");
    const repo = p.repo
      ? `<a class="repo-btn" href="${p.repo}" target="_blank" rel="noopener">View on GitHub ↗</a>`
      : `<span class="repo-btn repo-btn--muted">Repository private</span>`;

    return `
      <div class="cabinet__frame">
        <div class="cabinet__interior" inert>
          <div class="tube"></div>
          <div class="interior__scroll">
            <figure class="poster">
              <i class="tape tape--tl"></i><i class="tape tape--tr"></i><i class="tape tape--bl"></i><i class="tape tape--br"></i>
              <svg class="halo" viewBox="0 0 120 30" aria-hidden="true"><ellipse cx="60" cy="15" rx="56" ry="10"/><path d="M92 4 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1z"/></svg>
              <figcaption class="poster__kicker">Locker ${p.no} · ${esc(p.period)}</figcaption>
              <h2 class="poster__title" id="cabinet-title">${esc(p.title)}</h2>
              <div class="poster__art">${window.POSTER_ART[p.art]}</div>
              <p class="poster__tag">${esc(p.tagline)}</p>
            </figure>

            <div class="notes">
              <section>
                <h3 class="scrawl">About this..</h3>
                <p>${esc(p.about)}</p>
              </section>
              <section>
                <h3 class="scrawl">Built to —</h3>
                <p>${esc(p.mission)}</p>
              </section>
            </div>

            <section class="inside">
              <h3 class="scrawl">What's inside</h3>
              <ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
            </section>

            <div class="interior__foot">
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

        <div class="cabinet__door" role="button" tabindex="0" aria-label="Toggle locker door">
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
  let opener = null;
  let busy = false;

  async function openLocker(index, fromEl) {
    if (busy) return;
    busy = true;
    opener = fromEl || opener;
    current = index;
    const p = lockers[index];

    cabinet.setAttribute("style", themeStyle(p.theme));
    cabinet.innerHTML = cabinetHTML(p, index);
    stage.hidden = false;
    document.body.classList.add("no-scroll");
    history.replaceState(null, "", `#${p.id}`);

    requestAnimationFrame(() => stage.classList.add("is-visible"));
    await wait(CONFIG.STAGE_ENTER_MS);
    setDoor(true);
    await wait(CONFIG.DOOR_SWING_MS * 0.6);
    busy = false;
  }

  function setDoor(open) {
    cabinet.classList.toggle("is-open", open);
    const interior = cabinet.querySelector(".cabinet__interior");
    if (open) {
      interior.removeAttribute("inert");
      const link = cabinet.querySelector(".repo-btn");
      (link || cabinet.querySelector(".cabinet__door")).focus({ preventScroll: true });
    } else {
      interior.setAttribute("inert", "");
    }
  }

  async function closeLocker() {
    if (busy || stage.hidden) return;
    busy = true;
    setDoor(false);
    await wait(CONFIG.DOOR_SWING_MS * 0.85);
    stage.classList.remove("is-visible");
    await wait(CONFIG.STAGE_ENTER_MS);
    stage.hidden = true;
    document.body.classList.remove("no-scroll");
    history.replaceState(null, "", location.pathname + location.search);
    if (opener) opener.focus({ preventScroll: true });
    busy = false;
  }

  async function step(dir) {
    if (busy || stage.hidden) return;
    busy = true;
    setDoor(false);
    await wait(CONFIG.DOOR_SWING_MS * 0.8);
    busy = false;
    const next = (current + dir + lockers.length) % lockers.length;
    opener = row.querySelector(`.locker[data-index="${next}"]`);
    openLocker(next, opener);
  }

  function bindStage() {
    stage.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return closeLocker();
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
      if (e.key === "Escape") closeLocker();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
  }

  // Deep link: /#cinesearch opens that locker straight away.
  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = lockers.findIndex((p) => p.id === id);
    if (i >= 0) openLocker(i, row.querySelector(`.locker[data-index="${i}"]`));
  }

  renderHallway();
  enableParallax();
  bindStage();
  openFromHash();
})();

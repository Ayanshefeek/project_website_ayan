# Ayan's AI Project Lockers

An interactive 3D "locker hallway" that showcases my AI projects. Each project lives in its own locker:
click one and it comes forward and its door swings open. Inside is a poster with art made for that
project, notes on what it does and why, and the tech stack stuck to the inside of the door.

The newest projects come first in the hallway.

## Run locally

It's a static site with no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

Repo **Settings → Pages → Deploy from a branch**, then pick the branch and `/ (root)`.

## Add a new project

Append an entry to the **end** of `js/projects.js`. The list is kept oldest → newest and the
site reverses it, so the new project automatically shows up in the first locker. Choose:

- `theme`: the accent colours, the inner wall and light tint, and the display font for the poster title
- `art`: the key of an SVG poster in `js/art.js` (add a new one there for a new look)
- `tags`: topics for the index filter, e.g. `["Agents", "RAG"]`

## Structure

| File | Job |
| --- | --- |
| `index.html` | Page frame: nav, hero, locker bank, project index, open-locker stage |
| `css/styles.css` | Lockers, 3D door, interior, per-project theming, animations |
| `js/projects.js` | Project data, the only file to edit when adding a project |
| `js/art.js` | Hand-drawn style SVG poster for each project |
| `js/door.js` | Door spring physics + synthesized sounds |
| `js/fx.js` | Intro, locker wear, combination dial, custom cursor, spotlight, smooth scroll |
| `js/vendor/lenis.min.js` | Smooth-scroll library (MIT, see `LENIS-LICENSE`) |
| `js/main.js` | Renders lockers + index, scroll-driven hallway, shuffle, door dragging, open/close morph, browsing, filters, deep links |

## Experience

- **Intro**: a short curtain holds the page until the web fonts are ready (no text jumping), then the
  room's lamp flickers on and the hero rises in.
- **Walk the hallway** (desktop): scrolling moves you along a wall of lockers set in 3D, with
  ceiling tubes that flicker on, a glossy floor reflection, a soft spotlight that follows your mouse,
  and a progress line. Phones get a tidy grid instead.
- **Lived-in lockers**: every door has its own scratches, scuffs near the handle, dents, grime and
  sometimes an old faded sticker. They're generated from the locker number, so they look the same on every visit.
- **Combination dials** turn as a door swings ajar. Opening a locker dials its own combination
  (right–left–right) before the handle unlatches.
- **Custom cursor**: a gold ring that becomes "Open" over lockers and a grab hand over the door.
- **Shuffle**: "Open a random locker" spins through names like a slot machine, glides the hallway to
  the winner and opens it.
- **Smooth scrolling** with inertia ([Lenis](https://github.com/darkroomengineering/lenis), bundled in `js/vendor/`, MIT).

## Interactions

- **Hover** a locker: it leans toward your cursor and its door springs ajar, then clacks shut when you leave.
- **Click** a locker (or a row in the project index): it grows out of its spot into the centre, the
  handle unlatches and the door swings open toward you.
- **Grab the door** and swing it with your mouse or finger. It follows the pointer in true 3D. Let go
  and it keeps your momentum: flick it shut or open, or let it settle to the nearer side. A closing
  door slams into the frame, bounces slightly and shakes the cabinet. Click the door to open or close it.
- **Browse** with the `←` / `→` buttons, the arrow keys, or a swipe on phones. Quick repeated presses add up.
- **Close** with `Esc`, the ✕ button, or by clicking the background.
- **Sound**: optional latch and slam sounds, synthesized in the browser (toggle in the nav, off by default).
- **Filter** the project index by topic. Lockers that don't match dim out.
- **Deep links**: `/#cinesearch`, `/#react-copilot`, … open that locker directly.
- Keyboard friendly (Enter/Space on the door). With `prefers-reduced-motion` the intro, hallway walk
  and smooth scrolling are skipped and doors move instantly.

## How the door works

`js/door.js` is a small spring-physics engine rather than CSS transitions. The door is a damped
spring with a frame to hit, which is why it can be grabbed mid-swing, thrown, and slammed. The door angle is
written to one CSS variable (`--a`). The inside light, the door's shadow, the shading on the door
faces, the content reveal and the cabinet sliding aside all follow that one value. Dragging projects
the door through the same perspective CSS uses, so the point you grab stays under your pointer.

The 3D is pure CSS transforms (no WebGL). Text stays real and accessible, nothing needs to be
built, and it runs smoothly on phones.

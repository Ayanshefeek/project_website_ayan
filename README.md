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
| `js/main.js` | Renders lockers + index, pointer tilt, open/close morph, browsing, filters, deep links |

## Interactions

- **Hover** a locker: it leans toward your cursor and the door opens a little.
- **Click** a locker (or a row in the project index): the locker grows out of its spot into the
  centre and the door swings open. Click the door to shut it or open it again.
- **Browse** with the `←` / `→` buttons, the arrow keys, or a swipe on phones. Quick repeated presses add up.
- **Close** with `Esc`, the ✕ button, or by clicking the background. The locker shrinks back into its place.
- **Filter** the project index by topic (RAG, Agents, LLMOps, …). Lockers that don't match dim out.
- **Deep links**: `/#cinesearch`, `/#react-copilot`, … open that locker directly.
- Respects `prefers-reduced-motion`, and the keyboard focus stays inside the open locker.

The 3D is pure CSS transforms (no WebGL). Text stays real and accessible, nothing needs to be
built, and it runs smoothly on phones.

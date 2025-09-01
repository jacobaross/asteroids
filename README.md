Cyberpunk Asteroids
===================

A fast, stylized Asteroids variant with glitching enemies, power‑ups, boss phases, and modernized architecture.

Run Locally
-----------

Serve over HTTP (ES modules don’t load via `file://`).

- Python
  - `python3 -m http.server 8000`
  - Open `http://localhost:8000/asteroids.html`

- Node (optional)
  - `npx http-server .` or `npx serve .`

Controls
--------

- Move: Arrows or WASD
- Strafe: Q/E
- Shoot: Space
- Restart: R

Project Layout
--------------

- `asteroids.html` — entry point (canvas + game code imports)
- `src/`
  - `input.js` — keyboard state
  - `state.js` — global game state + UI updates
  - `loop.js` — requestAnimationFrame wrapper
  - `collision/spatialHash.js` — broadphase grid for collisions
  - `utils/pool.js` — tiny object pool for particles/text
  - `bosses/registry.js` — data‑driven boss selection

Notes
-----

- Uses ES modules (no bundler needed for now).
- Spatial hash and object pools reduce CPU and GC pressure.
- Boss fights trigger after clearing each wave; health bar is centered.

Next Steps (optional)
---------------------

- Split entities/rendering into modules (`ship`, `asteroid`, `draw/*`).
- Add object pools for bullets/missiles if needed.
- Optional: migrate to Vite + TypeScript for richer tooling.


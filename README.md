# The Hot Gates

A 3D browser tower defense game. Hold five historical last stands—Thermopylae, Tyre, Constantinople, Rorke’s Drift, and Masada—by placing towers along a fixed path, spending gold, and keeping lives until the final wave.

Built by **Grok 4.7 Extra High**.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints (default `http://localhost:5173`).

| Script | What it does |
| --- | --- |
| `npm run dev` / `npm start` | Local Vite server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run sim` | Headless balance and map checks |

Stack: Vite 6, Three.js, vanilla ES modules. No framework.

## Battles

| Battle | Place · year | Terrain |
| --- | --- | --- |
| **The Hot Gates** | Thermopylae · 480 BC | Mountain pass with sea to the east and a quiet goat trail |
| **The Mole** | Tyre · 332 BC | Island fortress and Alexander’s causeway |
| **The Last Emperor** | Constantinople · 1453 | Theodosian land walls and the Kerkoporta |
| **Until Dawn** | Rorke’s Drift · 1879 | Mission yard, mealie bags, Oscarberg, and the orchard |
| **The Ramp** | Masada · 73 AD | Desert mesa, western siege ramp, and the snake path |

Each map has its own path, tower pads, story copy, and a mid-siege second road. Leave a fight with **Battles** (or from pause) to pick another.

## Graphics versions

Switch at any time from the menu or the HUD:

| Version | Look |
| --- | --- |
| **I** | Original coast look, simple towers |
| **II** | Painted world, bloom and color grade |
| **III** | Same world as II with detailed towers |
| **IV** | Ink print—flat color, hard outlines, paper UI |

## How to hold

- **Hoplite** — cheap spears; nearby hoplites form a phalanx for bonus damage
- **Archer** — long reach down the road
- **Boiling oil** — splash against packed ranks
- **Scorpion** — slow ballista that punches armor

Click a tower type (or press `1`–`4`), then a ring on the ground. Space sends the next wave. Upgrade, sell, and retarget from the inspect panel (`U`, `X`, `R`). Speed cycles with `F`; pause with `P`; mute with `M`.

## Credit

Game design, maps, art direction across four graphics styles, and the playable build were made by **Grok 4.7 Extra High**.

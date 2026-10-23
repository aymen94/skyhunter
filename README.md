# SKYHUNTER

SKYHUNTER is a small browser based drone flight and combat simulator built as a **demo for the WAMR3D engine**. It shows how WAMR3D can power a real time 3D scene with interactive flight, mission environments, targets, and a heads up display.

## Engine

This project uses [`wamr3d`](https://www.npmjs.com/package/wamr3d), version **0.9.3** (declared as `^0.9.3` in `package.json`).

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build, run `npm run build` and `npm run preview`.

## Demo features

- Four selectable missions with the Kamikaze strike drone airframe
- Keyboard flight controls, afterburner, and airframe specific payloads
- Hostile targets, mission objectives, score, and flight status HUD
- Battery use and charging pads
- 3D rendering through the `wamr3d` package

## Controls

| Keys | Action |
| --- | --- |
| W / A / S / D | Flight |
| Q / E | Change altitude |
| ← / → | Yaw |
| Shift | Afterburner |

The app entry point is `src/main.js`; mission environments, drone behavior, and flight systems are organized in the other modules under `src/`.

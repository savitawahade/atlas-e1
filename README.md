# ATLAS E-1

An interactive mechanical elephant from **The Kinetic Collection**: procedural Three.js geometry, vivid instrument panels, articulated mechanisms, and a detailed trunk study.

**[Launch the experience](https://savitawahade.github.io/atlas-e1/)**

## Explore

- Open the optics, ears, tusks, power cassette and trunk independently.
- Inspect armor, bearings, tendon guides and fingertips in the dedicated trunk study.
- Switch between shaded, wireframe and cutaway views.
- Scrub the teardown timeline, reassemble, and watch the elephant walk away.
- Orbit and zoom the model; pause or slow the animation to examine details.

The model and readings are designed kinematics, not a physical engineering simulation. A modern browser with WebGL support is required; a desktop with graphics acceleration gives the best experience.

## Run and build

Requires Node.js 22 or later and npm. Python 3 is used only for the optional preview command.

```sh
npm ci
npm test
npm run build
npm run preview
```

Open http://localhost:4174. The generated `docs/index.html` includes the model code, Three.js and fonts, and can also be opened directly offline.

## Source

- `src/model.js`: procedural geometry and articulated assemblies.
- `src/main.js`: scene, rendering, camera and interactions.
- `src/trunk-study.mjs`: staged mechanism opening and smooth reassembly.
- `src/motion.mjs`, `src/trunk-motion.mjs`, `src/mechanism-motion.mjs`: deterministic animation.
- `src/telemetry.mjs`: kinematic instrument readings.
- `src/interface.js`, `src/style.css`: responsive controls and visual design.
- `src/check*.mjs`: motion and mechanism regression checks.
- `docs/`: self-contained GitHub Pages site.

## Publishing updates

Run the tests and build, commit the source plus `docs/`, and push to `main`. GitHub Pages serves `/docs` from `main`.

## Credits

Built on the MIT-licensed [Teardown toolkit](https://github.com/elvarofficial/teardown) by elvarofficial and whaleyxbt; the retained shared stylesheet and license are in `vendor/`. Uses [Three.js](https://threejs.org/). Typography: Space Grotesk, Manrope, IBM Plex Mono, Inter and JetBrains Mono. Font provenance and licenses are retained in `src/fonts` and `docs/licenses`.

Inspired by the mechanical teardown studies shared by [Elvar](https://x.com/elvar_official/status/2116568882529903066).

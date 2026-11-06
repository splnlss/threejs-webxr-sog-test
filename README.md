# Ronda Lobato WebXR

Minimal Three.js WebXR viewer using [Gaussian Splat Lite](https://github.com/WilliamLiu-1997/Gaussian-Splat-Lite). The page automatically loads a Streamed SOG derived from [Ronda Lobato's `lod-meta.json`](https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20260820_RondaLobato/lod-meta.json) and shows only an **Enter VR** button in the upper-left corner. The button is always visible; the browser handles whether an immersive session is available.

## Run

```bash
npm install
npm run dev
```

Open the printed URL to view the scene. Drag to orbit and scroll to zoom on desktop. On Quest 2, the left thumbstick moves and the right thumbstick snap turns. Deploy over HTTPS to enter immersive VR in Meta Quest Browser. `npm run build` creates the static site in `dist/`.

The starting position is near the telephone pole at `(x = 2.5, z = 24)`. The locomotion floor is at world `y = 1.2 m`; its mesh is invisible because the SOG capture already contains visible ground.

## Streamed asset

`public/sog-optimized/lod-meta.json` is a smaller-chunk repack of source LODs 2, 3, and 4. It contains 886,084, 443,042, and 196,908 splats across 23 spatial chunks. The viewer targets 450,000 visible splats in VR and 850,000 on desktop. Repacking lets the Quest load nearby detail without retaining the source's very large LOD chunks. The two finest source levels are omitted to limit download and memory use; very close surfaces can still look soft.

In VR, Gaussian Splat Lite receives Three.js's XR camera so it selects detail for both eyes. `lodBehindPenalty: 1` keeps nearby SOG regions in the budget regardless of head direction, preventing head turns from unloading the scene around the viewer.

The bundle was made with SplatTransform 3.8.0 by extracting source LODs 2–4 to PLY, then writing Streamed SOG with `--lod-chunk-count 64 --lod-chunk-extent 8 --lod-chunk-min 2 --sh-iterations 1 --webp-effort 0`.

The original R2 asset remains available through `/sog-assets/*`. `vite.config.js` proxies it in development, and `public/_redirects` proxies it on Netlify. The R2 host does not send CORS headers.

## Deploy to Netlify

This repository includes `netlify.toml` with the build command and publish directory. Connect the repository as a new Netlify project, or use Netlify CLI to create a site and run `netlify deploy --prod`.

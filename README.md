# ESCO-UAV

Astro static site for https://esco-uav.space — Turkish, responsive, self-hosted fonts, on-demand Three.js CAD viewer.

## Local use

Use Node 24 LTS (Node 23 is unsupported by Astro).

```sh
npm ci
npm run dev
npm run build
npm test
npm run preview
```

## Deployment

Existing Coolify application: Dockerfile build pack, port 80. The multi-stage image builds Astro using Node 24 and serves only `dist/` through nginx. No runtime Node service, third-party font requests or analytics. `release.json` identifies the live release. HTML revalidates; content-hashed Astro assets cache for a year. Unknown routes return HTTP 404.

## Data and model

The public source of content is `src/data/project.json`; `public/data/project-r13.json` is the downloadable snapshot (tested for equality). Basis: 24 September 2026 R13 full aircraft CAD, mass ledger, analysis and verification records. Nominal mass is calculated, not measured. Fourteen digital checks are not flight or manufacturing acceptance. 2027 is the target year; the 2026 rules are a prior-year reference only.

`public/models/est34-r13.glb` is a tessellated web derivative of the R13 CAD assembly, not a manufacturing asset. Its source hash, axes and display-body selection are in `public/models/manifest.json`. Six reference volumes are excluded from the viewer. `public/images/est34-r13.webp` is a render of that geometry. Public technical notes disclose model and verification limits.

When updating: replace data and CAD derivatives together, update the technical notes, sitemap dates and `release.json`, then build and run tests. Verify desktop/mobile navigation, model activation and views, technical notes and 404 before publishing. Do not label unmeasured hardware or unexecuted physical tests as verified.

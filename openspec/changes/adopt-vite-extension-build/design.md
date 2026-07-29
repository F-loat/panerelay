## Context

PaneRelay's Extension has one MV3 module service worker and one side-panel HTML application today.
Its custom esbuild script bundles those TypeScript files and manually copies manifest, CSS, HTML,
and icon files. The source directory is already mixing runtime boundaries, and fixed output names
have leaked into release validation.

CRXJS discovers Extension entries from the manifest, emits an MV3-compatible module service worker,
and integrates Extension reload with Vite development. Vite treats the side-panel HTML and CSS as
part of the module graph and copies `public/` assets unchanged.

## Goals / Non-Goals

**Goals:**

- Make runtime ownership obvious from the directory tree.
- Remove manual entry/copy/watch lists.
- Keep one unpacked `dist` directory for development and candidate packaging.
- Let Vite hash implementation assets without weakening release-content checks.

**Non-Goals:**

- Do not introduce React, Preact, Tailwind, or a component-system rewrite.
- Do not move browser policy out of the background runtime or change protocol behavior.
- Do not require generated source files to be committed.

## Decisions

### Organize by Extension runtime

`src/background/` owns the service worker and its pure helpers. `src/pages/sidepanel/` owns the
side-panel document, styles, scripts, and structural tests. `src/shared/` contains runtime-neutral
Extension message types. Browser icons live in `public/icons/`; the editable brand SVG remains in
`assets/`.

This mirrors browser execution boundaries without introducing premature folders for surfaces that
do not exist.

### Use CRXJS as the manifest adapter

The root `manifest.json` points at TypeScript and HTML source entries. CRXJS resolves and rewrites
those entries for production, while Vite owns bundling, CSS extraction, static assets, sourcemaps,
and development serving.

The build remains targeted at Chrome 116. Vite 8 requires Node.js 20.19 or newer for workspace
development; publishable runtime packages retain their existing Node.js 20 support.

### Validate artifacts from their declared references

Release validation reads the built manifest, recursively inventories the Extension directory, and
requires every local background, page, and icon reference to exist. It also reads declared HTML
pages and verifies their local script, stylesheet, and icon references.

This keeps candidate checks strict while allowing CRXJS/Vite to use loader and hashed asset names.

### Keep tests on the current runner

The Extension's existing tests are fast Node tests bundled with esbuild. Their entry paths are
updated for the new layout, but a Vitest migration is deferred until DOM-heavy page components make
it valuable. Vite adoption does not require changing the test framework.

## Risks / Trade-offs

- **CRXJS output names differ from the old flat build** → release checks follow built references,
  and Chrome loads only the built manifest.
- **Development now runs a local Vite server** → server CORS is limited to Extension origins, and
  production `vite build` remains self-contained.
- **Vite 8 narrows workspace Node 20 support** → document Node 20.19+ for contributors while
  keeping distributed Node packages at `>=20`.
- **Large path-only diff obscures behavior changes** → keep the migration behavior-neutral and run
  full tests, release packaging, and real Extension reload.

## Migration Plan

1. Move files into background, side-panel, shared, and public boundaries.
2. Add root manifest and Vite configuration, then remove the custom build script.
3. Update imports, test entries, release metadata loading, and artifact validation.
4. Build and inspect `dist/manifest.json`, referenced entries, and candidate archive.
5. Reload `dist` in daily Chrome and rerun the pending controlled-favicon acceptance.
6. Roll back by restoring the old build script and flat manifest paths; no stored browser data
   migration is involved.

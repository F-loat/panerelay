## Why

The Extension currently keeps background logic, the side-panel page, shared types, tests, icons,
and static build inputs in one flat `src` directory. A custom esbuild script separately bundles two
entry points, copies a fixed file list, and implements its own watcher. Adding popup, options,
content-script, or additional side-panel modules would multiply manual entry and copy rules.

## What Changes

- Organize source by runtime boundary: background, pages, and shared Extension code.
- Move immutable browser assets to `public/` and keep the manifest at the Extension package root.
- Replace the custom esbuild/copy watcher with Vite and CRXJS using manifest-discovered MV3 entry
  points.
- Keep `apps/extension/dist` as the unpacked Chrome directory and local release input.
- Add a lightweight Extension-only zip command for review and manual installation.
- Make release validation follow built manifest and HTML references instead of fixed bundle names.
- Preserve the current Chrome 116 target, Extension identity, permissions, functionality, and
  package version.

Non-goals:

- No UI framework migration, visual redesign, or side-panel behavior change.
- No switch from the current Node test runner to Vitest in this change.
- No new Extension surface, permission, browser capability, or publication action.

## Capabilities

### New Capabilities

- `extension-build-pipeline`: Defines the manifest-driven Extension source layout, development
  build, production build, and distributable validation contract.

### Modified Capabilities

None.

## Impact

- Extension: source paths, static-asset paths, scripts, manifest location, and build dependencies.
- Release tooling: recursive manifest/HTML reference validation for hashed Vite output.
- Documentation: Extension development commands and unpacked `dist` workflow.
- Runtime architecture and RFC-defined browser boundaries remain unchanged.

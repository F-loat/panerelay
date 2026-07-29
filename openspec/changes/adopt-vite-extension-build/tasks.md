## 1. Source boundaries

- [x] 1.1 Move service-worker code and tests under `src/background`
- [x] 1.2 Move the side-panel document, script, styles, menu, and structural test under
      `src/pages/sidepanel`
- [x] 1.3 Move shared message types under `src/shared` and icons under `public/icons`
- [x] 1.4 Move the Extension manifest to the package root with source entry paths

## 2. Vite and CRXJS

- [x] 2.1 Add Vite and CRXJS with a Chrome 116 production target and `dist` output
- [x] 2.2 Replace custom build/watch scripts with Vite development and production commands
- [x] 2.3 Verify the built MV3 manifest, module service worker, side-panel HTML, CSS, and icons

## 3. Tests and release tooling

- [x] 3.1 Update test entry paths without changing test behavior
- [x] 3.2 Validate Extension artifacts recursively from built manifest and HTML references
- [x] 3.3 Cover missing nested manifest/HTML references in release tests
- [x] 3.4 Update development and release documentation for the new workflow
- [x] 3.5 Add an Extension-only zip command that does not build npm release artifacts

## 4. Verification

- [x] 4.1 Run Extension tests/typecheck/build and inspect the unpacked `dist`
- [x] 4.2 Run the full repository check, strict OpenSpec validation, and `git diff --check`
- [x] 4.3 Build and verify the retained alpha candidate without publishing
- [ ] 4.4 Reload the Extension in daily Chrome and complete the controlled-favicon acceptance
- [ ] 4.5 Sync evidence and archive both completed OpenSpec changes

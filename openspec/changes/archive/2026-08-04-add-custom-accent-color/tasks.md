## 1. Shared appearance foundation

- [x] 1.1 Add a shared, dependency-free accent preference module with strict normalization, contrast-aware light/dark derivation, and unit tests
- [x] 1.2 Extend Side Panel state initialization and local-storage persistence to restore a valid base accent or fall back safely

## 2. Side Panel settings and tokens

- [x] 2.1 Add the accessible native color control immediately before the existing theme selector and keep the row usable at narrow Side Panel widths
- [x] 2.2 Apply resolved accent roles through the document-root semantic tokens without changing danger, warning, or branded colors
- [x] 2.3 Add component coverage for placement, accessibility, immediate preview, persistence, fallback, and theme independence

## 3. Extension surface propagation

- [x] 3.1 Extend page-comment start and appearance-only messages with validated accent roles while preserving authorization and document binding
- [x] 3.2 Update active page-comment highlights, markers, touch guidance, and editors in place, with runtime and background tests
- [x] 3.3 Apply the normalized accent to the controlled-tab action badge and refresh it on local preference changes, with unit coverage

## 4. Verification and compatibility

- [x] 4.1 Run Extension tests, typecheck, and production build; fix all regressions
- [x] 4.2 Run the full repository check, strict OpenSpec validation, and `git diff --check`
- [x] 4.3 Review agent-browser 0.33.0 and browser-platform compatibility records and confirm the presentation-only change requires no classification update
- [x] 4.4 Reload the unpacked Extension in daily Chrome, verify the picker and live accent propagation in narrow and wide Side Panels, then remove temporary screenshots and any browser state the user did not elect to keep

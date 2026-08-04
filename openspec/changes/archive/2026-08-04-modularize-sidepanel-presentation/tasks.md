## 1. Presentation Modules

- [x] 1.1 Add shared presentation helpers and feature modules for header/history, setup/access/settings, conversation rendering, and composer/notices.
- [x] 1.2 Reduce `SidepanelApp` to controller creation, cross-region refs/local selection, and feature composition without changing rendered behavior.

## 2. Styles and Tailwind

- [x] 2.1 Split the Side Panel cascade behind one ordered `styles.css` entry covering foundation, chrome/settings, conversation, composer, and responsive/motion styles.
- [x] 2.2 Use the existing Tailwind 4 integration for bounded one-off layouts and shared structural primitives while retaining semantic state selectors and theme variables.

## 3. Automated Coverage

- [x] 3.1 Split presentation component scenarios by feature and share typed fake client/state test support without weakening existing assertions.
- [x] 3.2 Run Side Panel component, controller, layout, build-output, typecheck, and Extension build tests; fix regressions.

## 4. Verification and Cleanup

- [x] 4.1 Run formatting, lint, full workspace checks, strict OpenSpec validation, and `git diff --check`.
- [x] 4.2 Perform a bounded unpacked-Extension Chromium smoke check for dark/light, common/narrow widths, settings, setup, and composer states; retain automated timeline coverage, keep screenshots/logs outside the repository, and confirm compatibility documentation does not need a behavior-only update.
- [x] 4.3 Review final module sizes and dependency directions, then remove obsolete styles, imports, and temporary verification artifacts.

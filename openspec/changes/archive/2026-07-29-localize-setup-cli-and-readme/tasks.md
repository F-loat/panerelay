## 1. Documentation

- [x] 1.1 Add a complete Simplified Chinese root README and reciprocal language links
- [x] 1.2 Document CLI automatic language selection and explicit overrides

## 2. CLI localization

- [x] 2.1 Add typed English and Simplified Chinese message catalogs
- [x] 2.2 Resolve locale from `--lang`, `PANERELAY_LANG`, system locale, and English fallback
- [x] 2.3 Localize help, usage errors, setup results, uninstall interaction, and doctor presentation
- [x] 2.4 Keep `doctor --json` unchanged and locale-independent

## 3. Verification

- [x] 3.1 Add focused tests for locale normalization, precedence, argument placement, and help
- [x] 3.2 Run setup package tests and typecheck, full workspace checks, strict OpenSpec validation, and package-content validation
- [x] 3.3 Manually inspect English and Chinese CLI output for help, setup, doctor, and uninstall

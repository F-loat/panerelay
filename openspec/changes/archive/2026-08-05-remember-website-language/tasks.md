## 1. Locale Preference Implementation

- [x] 1.1 Add a shared website locale-preference module that validates, stores, and restores explicit supported locale choices with safe storage fallbacks.
- [x] 1.2 Mark homepage and comparison-page locale links with the shared target-locale contract and initialize the module from both client entry points.
- [x] 1.3 Preserve the current query string and fragment while replacing a mismatched static locale page with its declared equivalent.

## 2. Automated Verification

- [x] 2.1 Extend website contract tests for explicit preference persistence, invalid/unavailable storage behavior, history replacement, and both localized route pairs.
- [x] 2.2 Run the website typecheck, build, and tests, then run the repository's required full validation and whitespace checks.

## 3. Browser and Compatibility Verification

- [x] 3.1 Verify in the locally installed daily Chrome that selecting a language is remembered across later homepage and comparison-page visits, including query strings and fragments.
- [x] 3.2 Confirm the website-only change does not alter documented browser compatibility groups or require a compatibility matrix update.
- [x] 3.3 Remove generated browser logs, screenshots, temporary server state, and other machine-specific verification output before completion.

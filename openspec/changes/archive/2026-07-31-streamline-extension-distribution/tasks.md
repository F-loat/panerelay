## 1. Installation Guidance

- [x] 1.1 Update English and Chinese quickstarts to make the official Chrome Web Store listing the default Extension install path.
- [x] 1.2 Update setup and release documentation while retaining explicitly scoped unpacked Extension guidance for development, self-built, rollback, and candidate verification.
- [x] 1.3 Add localized setup completion guidance that distinguishes the official Store Extension from custom-ID builds.

## 2. Public Release Assets

- [x] 2.1 Keep the complete Actions artifact unchanged and filter the stable GitHub Release checksum file to the attached Extension zip.
- [x] 2.2 Remove `inventory.json` from the public GitHub Release asset list and update the maintainer checklist.

## 3. Verification

- [x] 3.1 Add automated contracts for Store-first guidance, complete Actions artifacts, and minimal public Release assets.
- [x] 3.2 Confirm the official Store listing is reachable in the daily Chrome session and assess compatibility documentation impact.
- [x] 3.3 Run focused release tests, full workspace checks, strict OpenSpec validation, formatting checks, and clean up temporary verification state.
- [x] 3.4 Cover official and custom setup completion guidance and rerun affected validation.

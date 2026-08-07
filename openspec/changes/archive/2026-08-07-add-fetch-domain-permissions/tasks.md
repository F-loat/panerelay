## 1. Protocol and Architecture

- [x] 1.1 Add bounded fetch-permission request/result and HTTP payload types, validators, protocol unions, and focused tests.
- [x] 1.2 Update RFC-0009 to make exact/wildcard/all-domains authorization a durable fetch boundary and record the Agent confirmation lifecycle.

## 2. Extension Policy and Enforcement

- [x] 2.1 Add normalized persistent fetch-grant storage for exact and leading-wildcard domain patterns plus an independent all-domains flag, with unit tests.
- [x] 2.2 Gate Extension fetch handling before Cookie, DNR, or network work and return actionable authorization guidance, with focused denial/revocation tests.
- [x] 2.3 Add correlated Agent permission-request handling with popup close, denial, timeout, duplicate, disconnect, and generation-safe cleanup tests.

## 3. Bridge and CLI Authorization Flow

- [x] 3.1 Add an authenticated, generation-bound Bridge fetch-permission endpoint and correlated Native Messaging lifecycle with relay tests.
- [x] 3.2 Add `panerelay fetch --authorize <hostname|*.domain|url>` browser selection, client handling, localized help/output, and parser/execution tests.

## 4. User Authorization Interfaces

- [x] 4.1 Add the standalone Extension permission page with deny and requested-domain user-gesture actions plus build-output and component tests.
- [x] 4.2 Add a separate side-panel Fetch access section for current-domain and all-domains grants, expandable exact/wildcard domain management, immediate Panerelay-only revocation, localization, and component tests.
- [x] 4.3 Expand each scheme-independent domain grant to declared HTTP and HTTPS Chrome Host Permission patterns, and make the Agent popup full-window, taller, and vertically centered with regression coverage.
- [x] 4.4 Constrain the centered Agent popup content to a responsive maximum width so its full-window background remains usable when resized or full-screened.
- [x] 4.5 Keep all-domains approval out of the Agent popup and protocol result so broad access remains a side-panel-only user action.
- [x] 4.6 Make explicit Agent denial revoke the identical Panerelay domain grant while close, timeout, and Chrome Host Permission remain unchanged.
- [x] 4.7 Make all-domains Fetch access visually override the current-domain selection without deleting its saved grant, with component regression coverage.
- [x] 4.8 Make the current-domain action switch away from all-domains access by serially ensuring the exact grant before disabling the broad grant, with saved and unsaved domain regression coverage.

## 5. Documentation and Compatibility

- [x] 5.1 Update English and Simplified Chinese fetch documentation and CLI examples for authorization, scopes, management, revocation semantics, and the separation from browser control.
- [x] 5.2 Update Chrome/Edge browser-fetch compatibility claims while preserving agent-browser 0.33.0, Browser Use 0.13.7, and Playwright CLI 0.1.17 classifications.
- [x] 5.3 Exercise denial, exact/wildcard approval, all-domains approval, management, revocation, and retry in a real existing daily Chrome/Edge session when a lockstep Extension is available; otherwise record the bounded reason and keep live behavior Partial.
- [x] 5.4 Rebuild and reload the lockstep local Extension/Host, then repeat the wildcard Agent approval and record the live result without retaining browser or account data.
- [x] 5.5 Verify in the live browser that explicit denial of the same wildcard revokes that saved grant and the next matching fetch returns authorization guidance.

## 6. Validation and Cleanup

- [x] 6.1 Run focused protocol, Bridge, CLI, and Extension typechecks/tests and fix all failures.
- [x] 6.2 Run `pnpm install --frozen-lockfile`, `pnpm run check`, strict OpenSpec validation, and `git diff --check`.
- [x] 6.3 Inspect the final diff for cookies, credentials, request bodies, browser logs, screenshots, generated build output, and machine-specific artifacts; remove any such files before handoff.
- [x] 6.4 Run focused Extension tests, rebuild/reinstall the local lockstep artifacts, repeat strict OpenSpec and diff validation, and re-audit the final additions.

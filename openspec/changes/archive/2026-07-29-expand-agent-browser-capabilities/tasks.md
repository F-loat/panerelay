## 1. Acceptance Harness

- [x] 1.1 Extend the local fixture to cover cookies, request details and HAR, headers and offline behavior, file upload and download, emulation, accessibility, and generated artifacts.
- [x] 1.2 Add a repeatable, version-pinned acceptance workflow that writes evidence outside the repository and cleans up temporary browser state.
- [x] 1.3 Record pre-change results for every prioritized command and classify each gap by Provider, Extension, browser ownership, or environment.

## 2. State and Network Diagnostics

- [x] 2.1 Verify and, where needed, fix cookie and storage commands so they operate only on the selected authorized target and origin.
- [x] 2.2 Verify and, where needed, fix request details, HAR capture, extra headers, offline mode, credentials, and request routing.
- [x] 2.3 Add contract coverage for target isolation, revocation during pending commands, and cleanup of routes and emulation overrides.

## 3. Page Artifacts and Files

- [x] 3.1 Verify and, where needed, fix PDF generation and large binary payload integrity across the relay.
- [x] 3.2 Verify file upload with Agent-local paths without adding Extension-side filesystem access.
- [x] 3.3 Verify download behavior and either support it with honest target-scoped semantics or return an explicit unsupported-operation error.

## 4. Emulation and Analysis

- [x] 4.1 Verify and, where needed, fix viewport, media, timezone, locale, user-agent, and network emulation on authorized targets.
- [x] 4.2 Verify accessibility output, including structured results and same-origin iframe content.
- [x] 4.3 Add contract coverage for unsupported browser-wide permission, context, process, and ownership commands.

## 5. Sustained Diagnostics

- [x] 5.1 Verify tracing and profiling with bounded, reconstructable artifacts.
- [x] 5.2 Verify recording or streaming flows and any required chunked transport behavior.
- [x] 5.3 Verify failure cleanup and session recovery after interrupted diagnostic operations.

## 6. Documentation and Final Verification

- [x] 6.1 Update the agent-browser compatibility matrix only for capabilities backed by automated and live-browser evidence.
- [x] 6.2 Update RFC-0002 only if this work changes durable architecture or ownership boundaries.
- [x] 6.3 Run the frozen-lockfile install, repository checks, and whitespace validation.
- [x] 6.4 Run acceptance in the authorized daily Chrome session using only local fixtures, then remove sessions, routes, overrides, and temporary artifacts.
- [x] 6.5 Validate, synchronize, and archive the OpenSpec change after every implementation task is complete.

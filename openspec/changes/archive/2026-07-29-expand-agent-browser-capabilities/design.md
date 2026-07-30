## Context

See `proposal.md` for motivation and `specs/agent-browser-advanced-commands/spec.md` for observable behavior.

RFC-0002 already establishes a browser-level endpoint with synthetic Target semantics, opaque target/session identifiers, lazy `chrome.debugger` attachment, and explicit browser-process limitations. The Bridge currently forwards arbitrary target-scoped CDP commands; therefore many advanced agent-browser commands may already work without implementation changes, but they cannot be promoted from `Forwarded` until their complete command workflows pass.

The connected Chrome profile contains unrelated user tabs and login state. Mutating verification must stay on local fixtures, and diagnostics must not capture unrelated traffic or secrets.

## Goals / Non-Goals

**Goals:**

- Turn the highest-value `Forwarded` and `Partial` groups into evidence-backed `Verified` support.
- Find real workflow gaps at the agent-browser command level rather than infer support from individual CDP method names.
- Fix gaps at the narrowest honest layer while preserving RFC-0002 target, authorization, and ownership semantics.
- Produce reusable fixture coverage and a repeatable version-pinned acceptance record.

**Non-Goals:**

- Add a second automation API beside agent-browser.
- Add a command allowlist for normal target-scoped CDP traffic.
- Emulate browser contexts, process launch settings, proxying, browser shutdown, or top-level containment.
- Persist test artifacts or sensitive browser data in the repository.

## Decisions

### Audit complete commands before changing transport code

Each capability group will first run against the existing browser-level Provider on a local fixture. A group is considered failing only when the standard agent-browser command cannot complete or produces an incorrect observable result.

This avoids adding special cases for CDP commands the existing generic target-scoped relay already handles. The alternative—implementing from a static list of method names—would duplicate agent-browser behavior and overestimate compatibility.

### Keep target-scoped forwarding generic

Page, Network, Runtime, DOM, Accessibility, Emulation, Fetch, Tracing, Profiler, and target-scoped Browser commands continue through the selected page or flattened child session. The Bridge adds special handling only for browser-root operations that agent-browser sends without a target session.

A browser-root operation is synthesized or routed only when Panerelay can preserve its semantics in the daily browser. Otherwise it receives an explicit unsupported CDP error. This follows RFC-0002 instead of weakening it for higher command counts.

### Verify in bounded capability batches

The first implementation pass uses this order:

1. state and network diagnostics: cookies, request detail, HAR, headers, offline, credentials;
2. page output and file interaction: PDF, upload, download;
3. emulation and analysis: viewport, media, accessibility;
4. sustained diagnostic artifacts: tracing, profiling, recording.

Each batch includes fixture changes, command-level evidence, cleanup, and compatibility updates before the next batch. This keeps failures attributable and avoids leaving Fetch, emulation, trace, or recording state active on the user's browser.

### Keep artifact ownership in the local agent-browser process

The Extension only transports CDP commands, events, and payloads. agent-browser remains responsible for resolving upload paths and writing PDF, HAR, trace, profile, download, screenshot, and recording files.

Panerelay's large-message transfer remains the transport mechanism for base64 or event batches. The Extension never receives general filesystem access. If a browser-wide download configuration cannot be applied through the selected target, download remains `Partial` or `Unsupported`.

### Use privacy-preserving fixtures and evidence

Verification uses only local HTTP fixtures and generated non-secret files. Cookie tests use a unique fixture cookie and remove it afterward. HAR and request-detail tests capture fixture traffic only. Repository artifacts contain fixture source and result classifications, while screenshots, HARs, traces, profiles, PDFs, downloads, and recordings stay in the external verification directory.

### Preserve version-specific classifications

`docs/compatibility/agent-browser-0.33.0.md` remains the user-facing coverage record:

- `Verified`: package tests and a representative existing-Chrome scenario pass.
- `Forwarded`: the CDP surface is routed but the command workflow lacks daily-Chrome evidence.
- `Partial`: useful behavior works with a documented semantic limitation.
- `Unsupported`: Panerelay cannot provide the required browser ownership or security guarantee.

No classification is promoted solely because a CDP method returned success once.

## Risks / Trade-offs

- **Chrome exposes some Browser-domain methods inconsistently through tab debuggees** → Test the complete command and keep explicit failure when semantics are unavailable.
- **HAR, trace, profiler, and recording streams can produce large or sustained payloads** → Use bounded local scenarios, verify integrity, and stop collectors in cleanup paths.
- **Network or emulation state can outlive a failed command** → Add reversible commands and close the relay session after each batch; verify a fresh session is unaffected.
- **Cookie or request diagnostics could expose daily-browser secrets** → Run only on the local fixture and never print unrelated cookie values, authorization headers, or request bodies.
- **A command can succeed while relying on process-wide behavior Panerelay does not own** → Inspect the agent-browser implementation and observable result before marking it `Verified`.

## Migration Plan

1. Add the OpenSpec project files and this change without altering runtime behavior.
2. Extend local fixtures and command-level tests.
3. Apply minimal Bridge, Extension, or protocol changes only for reproduced gaps.
4. Run package checks, rebuild the unpacked Extension, and reload it when runtime code changes.
5. Execute bounded daily-Chrome scenarios and update the compatibility matrix.
6. Archive the OpenSpec change after implementation and verification; keep RFC-0002 `Accepted` until release.

Rollback removes the new command-specific changes and fixtures while leaving the RFC-0002 browser-level relay intact.

# Browser platform compatibility

- Panerelay release: current development candidate
- Extension targets: Chromium Manifest V3 and Firefox Manifest V3
- Last verified: 2026-07-31

## Status meanings

- **Verified**: covered by deterministic Extension, Bridge, setup, packaging, and protocol tests.
- **Forwarded**: shares an existing tested browser API path, but a dedicated real-browser acceptance run is pending.
- **Partial**: the collaboration surface works with a documented platform limitation.
- **Unsupported**: the capability is omitted or rejected before a lease, debugger session, or false success can occur.

This record distinguishes deterministic coverage from real-browser evidence. Chrome daily-profile automation evidence remains in [agent-browser 0.33.0 compatibility](agent-browser-0.33.0.md). Edge and Firefox real-browser smoke evidence is not yet claimed.

## Runtime capabilities

| Capability | Chrome / Chromium | Microsoft Edge | Firefox |
| --- | --- | --- | --- |
| Native Messaging | Verified | Forwarded | Partial |
| Side panel or sidebar | Verified | Forwarded | Partial |
| Codex and Qoder conversations | Verified | Forwarded | Partial |
| Project selection and page comments | Verified | Forwarded | Partial |
| Explicit site and tab automation authorization | Verified | Forwarded | Forwarded |
| Existing-tab CDP relay | Verified | Forwarded | Unsupported |
| Existing-tab WebDriver relay | Unsupported | Unsupported | Forwarded |
| agent-browser Provider | Verified | Forwarded | Partial |
| Controlled-tab badge and favicon | Verified | Forwarded | Unsupported |

Edge uses the Chromium Manifest V3 package and declares `browserFamily: "edge"` with CDP relay enabled when its debugger and side-panel APIs are present. It inherits the same permission, tab authorization, control-lease, revocation, target-lineage, and fail-closed rules as Chrome. Dedicated daily-Edge acceptance remains pending, so those paths are classified as Forwarded rather than Verified.

Firefox uses a separate manifest with a Gecko identity, background script, and `sidebar_action`. It deliberately omits Chromium-only `debugger` and `sidePanel` permissions. An explicitly installed `panerelay-firefox` launcher starts Firefox with Marionette; the Bridge owns a loopback geckodriver `--connect-existing` process and exposes only participant-scoped virtual WebDriver sessions. Current-tab and all-tabs authorization, top-document rendezvous, route allowlisting, virtual session rewriting, revocation, and cleanup have deterministic coverage. Real Firefox acceptance and an agent-browser release carrying the WebDriver Provider contract remain pending, so these paths are not classified as Verified.

## Installation and artifacts

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| macOS Native Messaging discovery | Verified | Setup writes managed manifests for Chrome variants, Chromium, Edge variants, and Firefox per-user locations. |
| Linux Native Messaging discovery | Verified | Setup writes Chrome-family, Edge stable/beta/dev, and Firefox per-user manifests. |
| Windows current-user registration | Verified | Setup writes separate Chromium/Firefox manifests and Google Chrome, Microsoft Edge, and Mozilla HKCU registry entries. |
| Identity validation and persistence | Verified | Chromium and Firefox identities have browser-specific validation, CLI/environment precedence, persisted values, and an exact Bridge allowlist. |
| Update and uninstall | Verified | Lifecycle tests cover rewriting and removing all managed manifests and registry keys without touching unrelated data. |
| Managed Firefox launcher | Verified | Setup tests cover executable/driver discovery, minimal `--marionette` arguments, per-user POSIX/Windows launchers, process correlation, update, doctor, and idempotent removal. Real browser startup remains pending. |
| Lockstep build artifacts | Verified | Candidate validation requires one Chromium/Edge zip and one Firefox zip with matching semantic/numeric versions and official identities. |
| Chrome Web Store distribution | Verified | The official Chromium identity is derived from the retained public manifest key. |
| Firefox Add-ons distribution | Partial | The official Gecko identity is fixed in source and release artifacts; store submission/signing is outside the automated workflow. |

## Security boundary

Browser family and capability declarations do not grant access. Site permission, tab authorization, WebDriver rendezvous, and the current control lease remain separate. Older compatible Chromium registrations without capability data retain prior CDP behavior; explicit unavailable values are authoritative. Panerelay never falls back from Firefox to another connected browser and never returns the raw geckodriver endpoint or real session ID.

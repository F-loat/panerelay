# Firefox WebDriver development compatibility

- Panerelay: current development candidate
- Firefox/geckodriver: real-runtime versions not yet recorded
- agent-browser baseline: `v0.33.0` at `1ed371f3af472cc0d6cd8fdaea75d1a085ff7534`
- Provider contract: reproducible development patch in [`../spikes/fixtures/agent-browser-v0.33.0-webdriver-provider/`](../spikes/fixtures/agent-browser-v0.33.0-webdriver-provider/)
- Last updated: 2026-07-31

No Firefox command group is classified as Verified yet. Deterministic tests prove the local contract and policy behavior; a supported real Firefox run is still required.

| Command group | Status | Current evidence or limit |
| --- | --- | --- |
| Provider selection | Forwarded | Patched agent-browser declares `browser.provider.webdriver-existing-session` and selects its existing WebDriver backend. Unpatched clients fail before participant allocation. |
| Managed startup | Forwarded | Setup, token/process correlation, minimal Marionette arguments, loopback geckodriver connect-existing flags, health, session creation, driver-exit handling, and owned-driver cleanup are tested with injected processes. |
| Navigation and history | Forwarded | Exact WebDriver URL, back, forward, and refresh routes are allowlisted only after an authorized window rendezvous. Document changes invalidate the old mapping. |
| Snapshot and page reads | Forwarded | Source, URL, title, element lookup, and synchronous script routes reach agent-browser's WebDriver backend through a selected mapped window. |
| Click and fill | Forwarded | Element lookup, click, clear, value, and actions routes are bounded and serialized per real driver session. |
| Screenshot | Forwarded | Screenshot responses are forwarded with a 16 MiB relay bound and no payload logging. |
| Cookies | Partial | The backend's current-document cookie read is forwarded; browser-wide cookie operations are not exposed. |
| Multiple existing tabs | Partial | The relay challenges every WebDriver handle, returns only participant-scoped opaque window identities, and maps only uniquely authorized top documents. The current agent-browser WebDriver backend does not expose its Chromium tab command surface. |
| Switch/close window routes | Forwarded | Exact W3C routes accept only participant-mapped opaque identities. Close invalidates the handle across participants. The coordinated agent-browser backend does not currently surface these as CLI tab commands. |
| New window | Unsupported | Current-tab authorization fails with an all-tabs action. Even with all-tabs authorization the relay rejects creation before driver forwarding until a new top document can complete a unique rendezvous safely. |
| Network interception, HAR, tracing, profiling, screencast, CDP | Unsupported | These remain explicit agent-browser WebDriver backend limitations. |
| Browser chrome/system access | Unsupported | Panerelay never starts geckodriver with `--allow-system-access` and exposes no browser-chrome route. |
| Participant cleanup and revocation | Forwarded | Provider close, scoped heartbeat expiry, explicit authorization release, permission removal, navigation, tab close, Extension disconnect, driver exit, and Bridge shutdown invalidate virtual credentials and mappings. |

Real acceptance must record exact Firefox, geckodriver, agent-browser, Extension, Panerelay, operating-system, launcher, authorization, navigation, snapshot, input, screenshot, revocation, and cleanup evidence before any row moves to Verified.

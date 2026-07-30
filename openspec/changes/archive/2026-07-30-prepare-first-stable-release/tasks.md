## 1. Baseline and integration probes

- [x] 1.1 Reconcile the remaining active alpha OpenSpec tasks with their existing implementation evidence, complete or explicitly defer each item, and archive only changes whose verification is complete
- [x] 1.2 Add a bounded Qoder CLI spike that records the tested runtime version, `--acp` initialization, advertised session/image/permission capabilities, and a non-sensitive local prompt transcript summary
- [x] 1.3 Record the Windows implementation reference from Mearl and the Panerelay-specific user-data, launcher, registry, update, and cleanup differences without copying product-specific behavior

## 2. Cross-platform process and Windows setup foundations

- [x] 2.1 Add shared platform-aware executable candidate, file-access, version-probe, and `.cmd`/`.bat` spawn helpers with macOS, Linux, and Windows unit coverage
- [x] 2.2 Extend Native Host path resolution with a user-owned Windows Host, launcher, manifest, runtime-config, and Provider-config layout
- [x] 2.3 Generate the quoted Windows Native Host launcher and point both the Chrome manifest and agent-browser plugin registration at the launchable path
- [x] 2.4 Register and unregister the exact current-user Chrome Native Messaging registry key through dependency-injected structured `reg.exe` calls
- [x] 2.5 Make Windows setup and update replace only Panerelay-managed artifacts and make partial/repeated uninstall idempotent
- [x] 2.6 Extend doctor with Windows registry/manifest/launcher/effective Extension origin agreement checks and localized actionable failures
- [x] 2.7 Cover paths with spaces and metacharacters, stale registry values, npm wrappers, missing artifacts, unrelated registry keys, and unsupported platforms in Bridge and setup tests
- [x] 2.8 Extend packed-consumer release fixtures and CI to exercise setup, doctor, update, and uninstall on Windows Node.js 20 and 22

## 3. Provider-neutral Agent routing

- [x] 3.1 Extract an internal Agent provider interface for descriptors, conversation lifecycle, sending, interruption, approval responses, events, and cleanup
- [x] 3.2 Adapt CodexProvider to the interface without changing its normalized protocol behavior or browser-session scoping
- [x] 3.3 Replace AgentService's single Codex field with a provider registry that aggregates descriptors and routes each request by provider ID
- [x] 3.4 Bind conversation IDs to their originating provider and reject missing, unknown, or mismatched provider requests before adapter access
- [x] 3.5 Extend normalized approval data only as needed for provider-neutral Qoder tool permissions while keeping provider-native option identifiers inside the Bridge
- [x] 3.6 Add provider-registry and Codex-regression tests for discovery, routing, event correlation, mismatch rejection, close, and unavailable adapters

## 4. Qoder ACP adapter

- [x] 4.1 Add `@agentclientprotocol/sdk` as a packaged Bridge dependency and add Qoder runtime-path configuration, install guidance, and optional doctor reporting
- [x] 4.2 Implement bounded Qoder executable discovery and probing for explicit configuration, PATH, npm wrappers, user-local installs, and official versioned installs
- [x] 4.3 Implement lazy `qodercli --acp` process startup, initialization, stderr sanitization, timeout handling, restart, and deterministic disposal
- [x] 4.4 Implement capability-negotiated Qoder session list, start, resume/load, prompt, interrupt, and close behavior
- [x] 4.5 Normalize Qoder text, reasoning, plan, tool, usage, completion, cancellation, and provider-error updates into bounded ConversationEvent values
- [x] 4.6 Map supported ACP permission options to explicit Panerelay approval decisions and cancel pending permissions on interruption, close, process exit, and Bridge shutdown
- [x] 4.7 Supply each Qoder session with a uniquely scoped Panerelay agent-browser MCP definition that still requires browser authorization and the exclusive control lease
- [x] 4.8 Add Qoder tests for missing/incompatible executables, capabilities, sessions/history, streaming, unknown updates, permissions, image support, browser MCP configuration, timeouts, exit, and cleanup
- [x] 4.9 Retain each Qoder conversation's agent-browser session label and close it after terminal turns, runtime exit, and provider shutdown
- [x] 4.10 Add deterministic Qoder regression coverage for completed, failed, interrupted, exited, and provider-close browser-session cleanup

## 5. Dynamic side-panel providers

- [x] 5.1 Merge runtime descriptors into the ordered Codex/Qoder support catalog, prefer a ready prior or first-ready selection, fall back to Codex when none is ready, and carry structured install/login/docs guidance
- [x] 5.2 Route list, start, resume, send, interrupt, and approval operations using the selected conversation's provider instead of a Codex constant
- [x] 5.3 Render normalized Qoder tool activity, reasoning, completion, failure, and supported permission choices without exposing ACP payloads
- [x] 5.4 Add English and Simplified Chinese ready/not-installed and structured provider setup-guide text without changing machine-readable diagnostics
- [x] 5.5 Extend side-panel structure and behavior tests for the full supported catalog, installed-provider defaulting, Codex fallback, unavailable-provider setup guidance, conversation isolation, approvals, and browser-authorization independence

## 6. Minimum agent-browser version and stable release identity

- [x] 6.1 Probe and parse the installed agent-browser version, reject versions below 0.33.0, and report the detected version and actionable upgrade guidance in doctor
- [x] 6.2 Replace the alpha release descriptor with stable `0.1.0`, Chrome version `0.1.0.2`, official Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`, minimum agent-browser `0.33.0`, and an explicit verified-version list
- [x] 6.3 Retain the public Extension manifest `key`, update the shared default Extension ID constant, and add deterministic tests that derive the official ID from the key
- [x] 6.4 Add localized `--extension-id` setup/update/doctor input, `PANERELAY_EXTENSION_ID`, strict Chrome ID validation, persisted effective identity, and CLI/environment/persisted/default precedence tests
- [x] 6.5 Add the actual `chrome.runtime.id` to browser registration, reject registration that differs from the configured effective ID, and record the validated ID in Bridge state
- [x] 6.6 Make Native Messaging installation and doctor use the effective Extension ID while update preserves an existing custom ID unless explicitly overridden
- [x] 6.7 Align root, package, Extension, packed dependency, inventory, checksum, and retained-candidate metadata with lockstep stable `0.1.0`
- [x] 6.8 Generalize alpha-specific release assertions and tests into channel-neutral stable checks while preserving the separately authorized publish command
- [x] 6.9 Reject stale alpha metadata, official public-key/ID drift, effective-ID/origin/registration mismatch, malformed custom IDs, private signing material, missing compatibility records, Windows launcher omissions, ACP packaging omissions, and unsupported dependency versions in release validation

## 7. Stable documentation and compatibility record

- [x] 7.1 Rewrite the English and Chinese quickstarts for stable installation, official and custom Extension IDs, explicit/project/user Provider selection, diagnosis, update, rollback, uninstall, Windows, and optional Qoder setup
- [x] 7.2 Replace "Alpha limitations" with separate compatibility, architecture-boundary, privacy/retention, and lockstep-version guidance
- [x] 7.3 Document agent-browser 0.33.0 as the minimum supported and initial verified baseline, explain newer-version evidence semantics, and keep the 0.33.0 matrix version-specific
- [x] 7.4 Update package READMEs and installed Agent Skill guidance so explicit `--provider panerelay` and configured defaults are both accurate
- [x] 7.5 Update RFC-0001 implementation evidence for Windows and Qoder and RFC-0002/RFC-0003 wording only where minimum-version or stable-release status changed
- [x] 7.6 Add stable release checklist gates for Windows Native Messaging, Qoder ACP, Codex, agent-browser, candidate integrity, clean-tree prerequisites, and separately authorized publication

## 8. Verification and release-candidate completion

- [x] 8.1 Run package-focused protocol, Bridge, setup, Extension, release-tool, and Qoder adapter tests during implementation
- [x] 8.2 Run `pnpm install --frozen-lockfile`, `pnpm run check`, `pnpm run release:check`, `openspec validate --all --strict`, and `git diff --check`
- [x] 8.3 Produce one retained `0.1.0` candidate, inspect every npm tarball and Extension artifact, verify the public key derives the official ID, and verify its inventory and checksums without publishing
- [x] 8.4 Record the maintainer-approved deferral of the final retained-candidate reinstall, doctor, control-visibility, revocation, and cleanup pass without claiming that evidence passed
- [x] 8.5 Preserve the completed bounded Codex/Qoder browser-MCP evidence and explicitly defer the remaining final-candidate authorization-revocation rerun
- [x] 8.6 Record real Windows Chrome setup, Host launch, update, uninstall, and paths-with-spaces acceptance as deferred and automated-only rather than verified
- [x] 8.7 Record version-specific compatibility evidence, remove temporary consumers/browser state/candidates except the intentionally retained artifact, and confirm no logs, screenshots, credentials, or machine-specific output entered the repository
- [x] 8.8 Sync completed delta specs and archive this implemented change under the recorded evidence deferrals; do not treat archival as release readiness or publish, tag, upload, or release without a separate explicit request

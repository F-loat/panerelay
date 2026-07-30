## Context

See `proposal.md` for motivation and the four delta specs for observable behavior. The alpha
already has a provider-neutral conversation protocol, a Codex app-server adapter, user-scoped
macOS/Linux Native Messaging setup, lockstep candidate tooling, and verified agent-browser 0.33.0
coverage. The remaining stable-release work crosses release metadata, setup, Bridge process
management, Extension UI, CI, and compatibility documentation.

RFC-0001 owns the Native Messaging trust boundary and Agent provider contract. RFC-0002 owns
daily-Chrome target and browser-process limitations. RFC-0003 owns bounded activity and control
session liveness. This change adds platform and adapter implementations within those decisions; it
does not create a new authorization or ownership model.

The Mearl repository provides three reusable implementation shapes: Windows Native Messaging
through a quoted `.cmd` launcher plus an HKCU Chrome registry value, Qoder CLI integration through
`qodercli --acp` with capability negotiation, and an Agent selector that keeps supported providers
visible while rendering structured setup guidance for an unavailable selection. PaneRelay will
adapt those shapes to its smaller local-first protocol rather than copy Mearl's product-specific
services or source code.

## Goals / Non-Goals

**Goals:**

- Make the stable candidate installable and diagnosable by a normal user on macOS, Linux, and
  Windows.
- Keep Codex and Qoder behind one provider registry and one normalized Extension protocol.
- Turn the exact agent-browser alpha pin into an honest minimum-version and evidence policy.
- Preserve credential-free candidate generation and explicit publication authority.

**Non-Goals:**

- Generalize PaneRelay into a universal ACP gateway or expose provider-native events.
- Make Qoder installation mandatory or make any Agent provider grant browser authorization.
- Emulate browser-process features excluded by RFC-0002.
- Add automatic release publication or persistent activity/history storage.

## Decisions

### Use stable SemVer with a monotonically increasing Chrome version

The npm packages, root package, Extension `version_name`, inventory, and documentation use
`0.1.0`. The numeric Chrome manifest version uses `0.1.0.2`, which sorts after the alpha candidate's
`0.1.0.1`; using `0.1.0.0` would look natural but would be a downgrade to Chrome.

The release descriptor replaces the alpha-specific single `agentBrowserVersion` assumption with
`agentBrowserMinimumVersion: "0.33.0"` and
`agentBrowserVerifiedVersions: ["0.33.0"]`. Release validation checks both the minimum policy and
the existence of each referenced compatibility record.

Lockstep PaneRelay component versions remain the safest first stable distribution because the
Native Messaging protocol does not negotiate backward compatibility. Independent package versions
remain a future compatibility-RFC topic.

### Retain the public manifest key as the official default and allow an installation override

The Extension manifest retains its public RSA key. Chrome deterministically derives
`panplnkjlkoceaonlmpdekjphgmbggmi` from that key, so unpacked development builds, retained
candidates, the Chrome Web Store item, Native Messaging manifests, and Bridge state can share one
default identity.

The release descriptor adds `extensionId: "panplnkjlkoceaonlmpdekjphgmbggmi"`. Release validation
decodes the manifest key as public-key DER, hashes it with SHA-256, converts the leading 128 bits
using Chrome's `a`-through-`p` nibble encoding, and compares the result with the descriptor. It
performs the same check against the built Extension manifest.

`PANERELAY_EXTENSION_ID` changes from the old development identity to the checked official ID.
It remains the default rather than an unoverrideable installation constant. Setup accepts
`--extension-id <id>` and `PANERELAY_EXTENSION_ID`, validates exactly 32 lowercase characters in
Chrome's `a`-through-`p` alphabet, and resolves the effective identity in this order:

1. command-line option;
2. environment override;
3. previously persisted runtime configuration;
4. official default.

Setup persists the effective ID in runtime configuration and writes one exact
`chrome-extension://<id>/` Native Messaging origin. Update reuses the stored value when no new
override is supplied; changing the option intentionally replaces the managed origin. Doctor reads
the same stored identity and compares it with every installed manifest rather than assuming the
official ID.

The Extension adds `chrome.runtime.id` to its versioned browser registration. The Native Host
compares that value with the configured effective ID before accepting the logical registration and
writes the actual validated ID to Bridge state. Chrome's `allowed_origins` remains the first
connection gate; the protocol comparison prevents stale configuration from being reported as
ready.

The public manifest key is not signing authority: no private key, PEM signing file, dashboard
credential, or Verified CRX Upload secret is committed, packed, logged, or required by candidate
validation.

Removing the manifest key was rejected because it would assign path-derived IDs to unpacked builds
and make the official build identity unstable. Restricting setup to that official ID was rejected
because users need to connect custom, rebranded, or independently packaged Extension builds.

### Register the Windows Host per user and launch it through a managed wrapper

Windows keeps installed Host code, launcher, manifest, runtime config, and Provider config under
PaneRelay's user-owned data directory. Setup writes a `panerelay-native-host.cmd` launcher that
invokes the exact current Node executable and installed bundled Host with quoted paths. Both the
Chrome manifest and agent-browser plugin config point to the launcher.

Setup registers
`HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\<host-name>` with a default `REG_SZ` value
containing the manifest path. `reg.exe` is invoked with an argument array, never a constructed
shell command. Uninstall deletes only that exact key and PaneRelay-managed files, and treats absent
artifacts as success.

The manifest need not live in a system-wide Chrome directory because Windows Chrome discovers it
through the registry. This avoids the administrative permissions implied by writing ProgramData
while retaining Mearl's proven registry/launcher shape.

Executable discovery becomes platform-aware: Windows checks `.cmd`, `.exe`, and bare candidates
with `F_OK`; `.cmd`/`.bat` children launch through `ComSpec` using a fixed `/d /s /c` argument
shape; native executables continue to spawn directly. These helpers are shared by setup, doctor,
Codex, Qoder, and agent-browser probes so Windows behavior cannot drift between adapters.

### Make AgentService a provider registry

The Bridge extracts an internal `AgentProvider` contract from `CodexProvider`: descriptor,
conversation list/start/resume/send/interrupt/respond, event subscription, and close. `AgentService`
owns a map keyed by provider ID, aggregates descriptors for `agent.providers`, and routes every
other request to exactly one provider. Conversation IDs remain provider-associated and a mismatch
fails before adapter access.

Codex event normalization remains unchanged behind the new interface. This refactor is preferred
to adding Qoder branches throughout `AgentService`, which would recreate provider-specific
coupling at the routing boundary.

The Extension owns an ordered catalog of provider IDs supported by the current PaneRelay build,
initially Codex then Qoder. Runtime descriptors overlay availability, capabilities, version, and
diagnostic data onto that catalog, so a disconnected or incomplete discovery response never
replaces the selector with a misleading "no provider available" option.

For a new conversation, a previously selected provider is restored only while it is both supported
and ready. Otherwise the selector chooses the first ready provider in catalog order. If no provider
is ready, it selects Codex as the stable setup entry point. An explicit in-session switch to an
unavailable provider remains selected and displays its setup guide, but conversation operations
stay disabled until a later discovery marks it ready.

Provider descriptors carry structured setup metadata instead of requiring the Extension to parse a
free-form hint: install command, optional login command, and optional official documentation URL.
Following Mearl's interaction shape, an unavailable selection renders those steps in the main
conversation area and labels unavailable menu entries as not installed. Provider selection changes
conversation routing only; browser authorization UI and control leases remain independent.

### Adapt Qoder ACP inside the Bridge

`QoderProvider` discovers `PANERELAY_QODER_PATH`, platform PATH candidates, normal npm command
locations, `~/.qoder/bin/qodercli`, and official versioned Qoder CLI installations. Candidates must
pass a bounded version probe. Starting the provider launches `qodercli --acp`, connects the
`@agentclientprotocol/sdk` NDJSON client over stdio, and initializes with PaneRelay client
metadata.

One lazily started ACP process can own multiple provider sessions. The adapter records advertised
session, prompt, image, and permission capabilities and rejects operations that the current
runtime does not advertise. Process exit fails active turns, cancels pending permissions, clears
session mappings, and permits a fresh later probe.

ACP session creation and resume receive a PaneRelay-scoped agent-browser MCP definition rather
than an unrestricted browser connection. The MCP command selects the `panerelay` Provider and a
unique session label, so it must acquire the normal Bridge relay credential and browser-side
control lease.

PaneRelay records that unique agent-browser label as part of the Qoder session it created. Qoder
owns the MCP child process, but ACP process or session shutdown does not prove that agent-browser's
per-label daemon has closed its PaneRelay Provider connection. The adapter therefore runs a
bounded, idempotent `agent-browser close` for the recorded label whenever a prompt completes,
fails, or is interrupted, and sweeps every recorded label again when the Qoder runtime exits or
the provider closes. A terminal turn event is not emitted until its cleanup attempt has finished;
cleanup failures are reported through sanitized diagnostics without replacing the original Qoder
turn result. Reusing the ACP conversation reuses its label and lets agent-browser reconnect on the
next browser tool call.

ACP updates are accumulated only as needed to emit bounded `ConversationEvent` values. Text,
thought, plan, tool, usage, completion, and failure map into existing normalized shapes. A small
extension to normalized approval data represents Qoder tool permission choices; it carries stable
PaneRelay decisions and adapter-private ACP option IDs remain in the Bridge pending-request map.
Unknown updates are ignored with a sanitized diagnostic or fail the affected operation; raw ACP
objects never cross Native Messaging.

### Keep version support and evidence separate

Setup probes `agent-browser --version`, rejects versions below 0.33.0, and reports newer versions
as satisfying the minimum. The checked `0.33.0` matrix remains the only initial `Verified`
version-specific record. A newer version can connect and run, but release docs do not copy
`Verified` labels forward until representative groups pass and a new compatibility record is
added.

This is preferred to an exact stable pin, which turns a documented evidence baseline into an
unnecessary installation restriction, and to an unbounded claim that all future releases are
verified.

### Gate the stable candidate by platform-specific evidence

The existing release library remains the single candidate builder. Its checks become
release-channel-neutral, validate stable metadata, inspect the Windows launcher and ACP dependency,
derive and verify the Extension ID from the retained public key, and exercise
setup/doctor/update/uninstall with injected platform and registry dependencies.

CI runs source and packed-consumer checks on Node.js 20 and 22 across Linux, macOS, and Windows.
Real daily-Chrome agent-browser and Codex/Qoder turns remain bounded local acceptance runs. A
Windows Native Messaging acceptance record must show Chrome launching the registered Host and
doctor observing the connection before maintainers declare the candidate ready. Generated logs
and screenshots stay outside the repository; compatibility documents summarize the evidence.

For this change's closeout, the maintainer accepted deferring the final retained-candidate
reinstall/revocation pass and the real Windows Chrome run because those environments were not
practical to complete locally. This disposition allows the implemented change to be archived, but
it does not turn those missing observations into passing evidence and does not satisfy the
`stable-distribution` requirement for declaring the candidate releasable. Compatibility and
release documentation must continue to identify both gaps until a later acceptance run closes
them. Publication, tagging, and uploads remain separately authorized actions.

## Risks / Trade-offs

- **Qoder ACP changes across CLI versions** → Probe capabilities at runtime, keep provider-native
  types adapter-private, fail unknown permission shapes closed, and record the accepted Qoder
  version in stable evidence.
- **Windows quoting or npm wrappers fail only on real Windows** → Share one wrapper launcher,
  dependency-inject registry/process tests, run Windows CI, and require one real Chrome Host launch
  before release.
- **A newer agent-browser passes version checks but regresses behavior** → Separate minimum support
  from `Verified` claims and make the detected version visible in diagnostics.
- **Official identity constants drift from the retained public key** → Derive the ID in release
  tests and reject source, packaged, or protocol-default mismatches.
- **A custom ID points at the wrong Extension** → Validate its syntax before writes, allow only its
  exact Native Messaging origin, and compare the runtime Extension registration with persisted
  state.
- **Stable release scope combines platform, Agent, and packaging work** → Keep independent spec and
  test groups, then accept the release only after all converge in one retained candidate.
- **Lockstep packages cause coordinated updates** → Retain the rule for `0.1.0`; revisit only with
  protocol negotiation and an RFC.

## Migration Plan

1. Finish or explicitly defer the remaining active alpha change tasks and preserve their accepted
   implementation evidence.
2. Add shared cross-platform process helpers and Windows Host installation with unit and packed
   consumer coverage.
3. Refactor AgentService behind the internal provider contract, then add and test Qoder ACP.
4. Update the Extension provider selector and normalized approval presentation.
5. Change release identity and compatibility metadata to stable `0.1.0`, update bilingual docs,
   RFC evidence, compatibility records, and release gates.
6. Run full source, platform, packed-artifact, daily-Chrome, Qoder, and Windows acceptance; retain
   one candidate for inspection.
7. Roll back before publication by reinstalling the alpha setup/Extension pair. After publication,
   roll forward with a new patch version rather than replacing immutable npm artifacts.

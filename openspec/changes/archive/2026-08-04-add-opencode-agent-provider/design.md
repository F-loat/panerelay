## Context

See [proposal.md](proposal.md) for motivation. RFC-0001 remains authoritative for the Bridge-owned Agent provider boundary, provider-neutral Extension messages, approvals, and credential-free Extension. RFC-0003 remains authoritative for automation participant visibility and revocation, while RFC-0006 owns browser selection and participant pinning. This change adds another local Agent runtime inside those decisions and does not alter CDP or browser ownership.

The Bridge already has one ACP client implementation in `QoderProvider`. It launches a stdio subprocess, negotiates capabilities, owns multiple ACP sessions, normalizes updates and permission requests, and fails active turns when the subprocess exits. OpenCode 1.18.12 exposes stable ACP v1 through `opencode acp`; its current initialization response advertises load, list, resume, close, embedded context, and image support, and its event implementation emits the standard message, thought, tool, usage, and permission shapes already consumed by Panerelay.

The current Qoder adapter mixes reusable ACP behavior with Qoder discovery, process arguments, labels, setup metadata, and error text. It also discards the `cwd` returned by ACP session listing and falls back to the process home directory when loading history. OpenCode scopes its backing SDK requests by directory, so a publishable integration must preserve that association.

Static source inspection classifies OpenCode's expected ACP behavior as `Forwarded`. Only a representative real 1.18.12 subprocess run can upgrade individual groups to `Verified`; absent runtime evidence remains explicit rather than inferred from the protocol version.

## Goals / Non-Goals

**Goals:**

- Share one bounded, capability-negotiated ACP process/session implementation between Qoder and OpenCode.
- Keep executable discovery, launch arguments, labels, setup guidance, and version evidence provider-specific.
- Preserve session working directories for correct list/load/resume behavior.
- Reuse the existing normalized conversation and approval protocol without an Extension wire change.
- Make OpenCode optional, diagnosable, cross-platform, and covered in packed-distribution checks.

**Non-Goals:**

- Add a public general-purpose ACP gateway or stabilize the internal ACP adapter as a package API.
- Surface ACP configuration options, models, modes, auth methods, commands, or arbitrary client filesystem methods in the Side Panel.
- Attach to OpenCode's HTTP server or TUI, or synchronize with a separately running OpenCode process.
- Inject or own browser automation tools on OpenCode's behalf.

## Decisions

### Extract a private profile-driven ACP provider

The Bridge will move subprocess transport, initialization, session state, history capture, prompts, updates, permissions, interruption, timeout, and exit cleanup into an internal ACP provider implementation. A closed provider profile supplies:

- provider ID, display name, description, and default titles;
- executable resolution and detected version;
- fixed launch arguments (`--acp` for Qoder, `acp` for OpenCode);
- install, login, and official-documentation guidance;
- bounded diagnostic and identifier prefixes.

`QoderProvider` and `OpenCodeProvider` remain named wrappers so AgentService and tests do not construct an arbitrary subprocess profile. Provider-native wire objects stay inside the Bridge.

Copying Qoder into a second large provider was rejected because permission correlation, process-exit behavior, bounds, and capability checks would drift. A universal public ACP configuration format was rejected because it would let Extension or user input nominate arbitrary executables and broaden the trusted launch boundary.

### Use OpenCode's ACP subprocess rather than HTTP Server/SDK

The OpenCode wrapper launches the resolved executable with the fixed `acp` subcommand over NDJSON stdio. This matches the existing dependency and event mapping, gives the Bridge direct process lifetime ownership, and avoids opening or authenticating another loopback HTTP service.

The official HTTP Server/SDK was considered but rejected for this integration because it would add port selection, authentication material, SSE reconnection, and a second provider-native mapping even though OpenCode already implements the required ACP surface.

### Negotiate behavior and pin evidence separately

Readiness has two levels:

1. discovery resolves an executable and bounded version probe, allowing setup and doctor to report local installation state;
2. provider preparation launches ACP v1 and records advertised capabilities, allowing conversation operations to fail explicitly when unsupported.

OpenCode 1.18.12 is the first evidence baseline, not an exact runtime lock. Other versions can be discovered and attempted through the same ACP negotiation but do not inherit `Verified` classifications. The compatibility record distinguishes discovery, initialization, sessions, history, text, reasoning, tools, usage, images, permissions, cancellation, process exit, and browser-ownership limitations.

Rejecting every version other than 1.18.12 was considered but would turn an evidence pin into an unnecessary product restriction. Treating every future ACP v1 version as verified was rejected because provider behavior can regress without a protocol-version change.

### Preserve directory ownership inside the ACP adapter

The shared adapter records each listed or created session's canonical `cwd`. Resume/load uses that recorded directory. A conversation not known from a prior list or start uses the provider's configured fallback directory, matching the current provider contract, but it does not overwrite a known session directory.

Adding `cwd` to the public `ConversationSummary` or resume request was rejected for the first slice because the Side Panel already lists by selected project and the Bridge can retain the directory association without exposing another filesystem value through Native Messaging.

### Reuse the existing normalized capability set

OpenCode text, thought, tool, usage, permission, cancellation, and history updates map to the existing `ConversationEvent` union. Image inputs use ACP image content blocks only when advertised. ACP plan and configuration updates that have an existing safe presentation may be retained; unsupported configuration, command, mode, and session-info updates remain sanitized diagnostics.

The initial Side Panel uses OpenCode's configured default model and primary agent. Adding model/auth/mode UI would require new provider-neutral protocol and product behavior and is deferred.

### Keep browser automation user-configured and independently owned

New and resumed OpenCode sessions receive an empty client-supplied MCP server list, matching the current Qoder policy. If the user configures agent-browser, Browser Use, or another tool inside OpenCode, that tool connects and cleans up under its own lifecycle. RFC-0001, RFC-0003, and RFC-0006 remain authoritative for authorization, leases, visibility, routing, and revocation.

Passing a generated browser MCP server during `session/new` was rejected because it would create OpenCode-specific implicit tool ownership, make Agent selection affect automation state, and conflict with the accepted separation between Agent providers and automation integrations.

### Integrate discovery through existing protected setup state

Setup resolves, probes, and persists `opencodePath` and `opencodeVersion` alongside the other optional Agent runtimes. Runtime configuration accepts `PANERELAY_OPENCODE_PATH` as the explicit override. Candidate discovery includes the normal cross-platform PATH forms and the documented `~/.opencode/bin/opencode` location. Doctor reports a warning when absent and never makes the Native Host unhealthy solely for OpenCode.

The Extension receives only descriptor readiness, bounded version/capabilities, setup commands, and diagnostics. It never receives the resolved executable path from Agent discovery and never supplies launch material.

## Risks / Trade-offs

- **ACP SDK 0.21.0 in OpenCode and 1.3.0 in Panerelay may differ despite both using stable protocol v1** → Require a real 1.18.12 initialization and conversation probe before claiming `Verified`; fail protocol or shape mismatches at initialization.
- **OpenCode may emit new ACP updates** → Keep exhaustive known normalization, bounded diagnostics, and fail closed for permission shapes.
- **A shared ACP refactor could regress Qoder** → Preserve Qoder's public test seams and run its complete provider suite plus a real or recorded Qoder compatibility regression.
- **Directory mappings live only for the Bridge process** → List by project before resume and retain mappings for the process lifetime; unknown direct resume keeps the existing fallback behavior rather than guessing a directory.
- **OpenCode authentication cannot be completed in the Side Panel** → Report targeted `opencode auth login` guidance and keep credentials outside Panerelay.
- **An OpenCode-owned browser participant can outlive a conversation** → Do not infer ownership; existing user revocation, transport loss, heartbeat expiry, and Native Host shutdown remain authoritative.

## Migration Plan

1. Add shared ACP coverage and migrate Qoder behind the private profile without changing its descriptor or observable conversation behavior.
2. Add OpenCode discovery, wrapper, provider registry entry, setup/doctor state, and Side Panel catalog entry.
3. Run source and packed checks on supported platforms and a temporary-project OpenCode 1.18.12 ACP probe with no browser tool configured.
4. Record capability classifications and retain agent-browser 0.33.0 shared-Bridge regression status unchanged.
5. Roll back by removing the OpenCode wrapper/catalog/setup fields while leaving user-installed OpenCode and its configuration untouched; no conversation or credential migration is performed.

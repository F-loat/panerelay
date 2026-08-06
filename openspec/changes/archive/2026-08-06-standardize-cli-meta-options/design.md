## Context

See [proposal.md](proposal.md) for motivation and [specs/cli-meta-options/spec.md](specs/cli-meta-options/spec.md) for observable behavior. Five package manifests currently declare six npm commands, but only `panerelay` and `panerelay-setup` are human-facing CLIs. The other four names expose implementation entry points whose production callers use explicit setup-managed paths, package APIs, or internal package scripts.

No accepted RFC decision changes. RFC-0001's Bridge policy boundary and RFC-0002's provider/runtime ownership continue to apply, and no compatibility classification changes: agent-browser 0.33.0 groups remain Verified, Forwarded, Partial, or Unsupported exactly as currently recorded.

## Goals / Non-Goals

**Goals:**

- Limit npm `bin` declarations to the two supported user-facing commands.
- Short-circuit all four metadata aliases before either public command's normal behavior.
- Preserve existing English/Simplified Chinese help behavior.
- Preserve every machine entry point and launcher that a supported integration actually invokes.
- Make regression coverage reject accidental additions to the public command set.

**Non-Goals:**

- Adding compatibility shims for the removed unused command names.
- Changing adapter requests, Native Messaging framing, Bridge startup, installation options, or automation behavior.
- Claiming new real-browser or version-specific compatibility evidence.

## Decisions

### Declare only human-facing commands as npm bins

Remove `bin` from the agent-browser and Playwright adapter manifests, and remove both `bin` entries from the Bridge manifest. npm command discovery is a public interface; machine protocol processes and maintenance utilities do not benefit from global command aliases.

The standalone agent-browser executable source is unreferenced once its `bin` declaration is removed and will be deleted. The Playwright executable source remains because setup bundles it into a private artifact. The Bridge Native Host and installer sources also remain because setup-managed Native Messaging and package maintenance scripts invoke them directly.

Keeping deprecated aliases or wrappers was rejected because the command names have no current callers and the requested scope explicitly does not preserve unused history.

### Keep machine entry points machine-oriented

The private Playwright adapter continues to read and emit its bounded stdio protocol. The Native Host continues to dispatch Native Messaging, self-check, Browser Use gateway, and agent-browser plugin modes. The Host installer continues to serve the Bridge package's internal install and uninstall scripts. None of these entry points gains human CLI metadata handling merely because it is executable internally.

This preserves existing production call chains and avoids expanding low-level protocol utilities into supported user workflows.

### Detect metadata at each public process entry point

`panerelay` and `panerelay-setup` recognize the four aliases at their outermost process-dispatch layer. For `panerelay run`, only arguments before the existing `--` separator participate in metadata detection, so child arguments remain untouched.

Each public command reads its adjacent package manifest for explicit version queries. Embedding literal versions was rejected because lockstep release preparation would have another value to update.

Version output is exactly `v<semver>` with no command-name prefix, matching the conventional compact form used by common runtime CLIs. Both aliases share the same formatter so their output cannot drift.

### Verify the exact public command set from package manifests

An executable-level test recursively discovers `bin` entries from publishable package manifests and asserts that their complete set is exactly `panerelay` and `panerelay-setup`. It then runs all four aliases and checks exact `v<semver>` output, usage-bearing help, successful exit, and isolated setup state. A future command therefore requires an intentional contract and test update.

Existing package and setup tests continue to cover the private Playwright launcher, installed Native Host launcher, internal Host installation scripts, and agent-browser Provider mode.

## Risks / Trade-offs

- [Risk] A hidden caller invokes one of the removed npm command names. → Mitigation: repository call-chain review found no supported caller; production paths use explicit internal artifacts, and no compatibility shim is required by scope.
- [Risk] Removing an executable source accidentally removes a packaged runtime dependency. → Mitigation: delete only the unreferenced agent-browser wrapper and retain all entries used by setup, exports, or package scripts.
- [Risk] A future machine entry point is accidentally published as a CLI. → Mitigation: assert the exact manifest-derived command set in the executable audit.

## Migration Plan

Remove the unused npm command declarations in the next lockstep package set. No user configuration, data migration, deprecation period, or compatibility wrapper is required. Rollback restores the manifest entries and the standalone agent-browser wrapper.

## Compatibility Verification

Implementation review verifies that Native Host manifests and Playwright registration still point to setup-managed launchers, the Bridge package scripts still invoke the internal installer, and the agent-browser Provider remains reached through the Native Host plugin mode. The agent-browser 0.33.0 and browser-platform matrices therefore require no update: no browser runtime path, target lifecycle, permission, participant, control, or compatibility classification changes. A daily-Chrome run would not exercise the package-manifest cleanup and is not required; no new real-browser compatibility claim is made.

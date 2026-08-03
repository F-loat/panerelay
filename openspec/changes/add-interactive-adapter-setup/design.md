## Context

`@panerelay/setup` already has TTY confirmation infrastructure for uninstall, independent integration flags, user-level agent-browser Provider configuration, and Browser Use adapter mode preferences. The change adds a small CLI orchestration layer and passes an explicit Browser Use mode through lifecycle installation. Accepted RFC-0001 and RFC-0007 remain authoritative for Provider ownership, adapter boundaries, authorization, and Browser Use connection modes.

## Decisions

### Trigger only for the default setup path

Interactive selection runs only for `setup` when both integration flags are absent, input/output are TTYs, and `--yes` is not present. Doctor and uninstall retain their existing behavior. Explicit flags remain suitable for scripts and Extension-launched commands.

### Ask independently, then ask defaults

The CLI asks whether to install agent-browser, then whether to make it the user-level default; it repeats this pair for Browser Use. A declined integration skips its default question. This allows neither, either, or both integrations and does not conflate installation with default routing.

### Preserve existing explicit semantics

`--agent-browser` continues to install without a user-level default unless `--global-default` is supplied. `--browser-use` continues to use the existing installer behavior. Only answers collected by the new interactive path alter the derived lifecycle options.

### Make Browser Use mode explicit in lifecycle options

Add an internal `browserUseDefault` option with `extension` and `direct` values. The Browser Use installer accepts an optional initial mode and preserves an existing preference on updates; a newly absent preference receives the requested mode, defaulting to the current explicit setup behavior (`extension`). The interactive path passes `direct` when the user declines the default.

### Keep prompts testable

Inject a `prompt` dependency returning answers, rather than coupling tests to process-global readline. The production prompt requires TTYs and accepts `y/yes` and `n/no`, with `n` as the safe default. `--yes` skips the flow rather than treating yes as consent to install optional engines.

## Compatibility and security

The supported integration baselines remain agent-browser 0.33.0 and Browser Use 0.13.7 with Browser Harness 0.1.8. The change is Partial for interactive UX on supported terminals and Unsupported for non-TTY prompt automation by design. No browser verification beyond existing setup/lifecycle tests is needed; the real daily-Chrome claims and browser ownership limitations remain unchanged.

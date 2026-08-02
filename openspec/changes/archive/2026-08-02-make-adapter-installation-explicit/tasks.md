## 1. Setup CLI contract

- [x] 1.1 Add localized `--agent-browser` parsing and help, require it for agent-browser default-scope options, and cover valid and invalid flag combinations.
- [x] 1.2 Move agent-browser probing out of Native Host installation and gate user-level Provider configuration, Skill installation, engine-specific output, and setup success behind the explicit selection.
- [x] 1.3 Make plain doctor engine-neutral and add combinable `--agent-browser` and `--browser-use` diagnostics with focused tests.

## 2. Extension readiness

- [x] 2.1 Remove agent-browser/Browser Use MCP, Skill, instruction, session-label, and cleanup injection from Codex, Claude Code, and Qoder while preserving their own configuration, project working directory, and sanitized tab context.
- [x] 2.2 Expose setup-managed agent-browser Provider availability through the authenticated settings boundary; keep both controls visible and show localized integration guidance.
- [x] 2.3 Add a bounded Native Host integration-install operation and make unavailable `agent-browser` / `browser-use` controls clickable with copy-only hover feedback plus distinct installing, success, and failure states.
- [x] 2.4 Expand the missing-Native-Host state with bilingual product guidance, independent adapter selections, deterministic combined setup commands, and an accessible copy action with confirmation.
- [x] 2.5 Split the missing-Host guide into connected-layout-aligned benefit, tool-selection, and setup-action cards without an enclosing panel.
- [x] 2.6 Move the title and primary description to the connected welcome heading position, simplify adapter selection to description-free settings-style toggles, use readable typography throughout the guide, and reduce the copy control scale.
- [x] 2.7 Preserve optional adapter selections across Native Host retries and transient missing-Host view remounts.
- [x] 2.8 Replace the missing-Host diagnostic sentence in the action card with an installation-oriented title matching the optional-tools section hierarchy.
- [x] 2.9 Place the required local-integration action card before the optional automation-tool card and render its command on a conventional muted-gray code surface.

## 3. Product guidance and durable records

- [x] 3.1 Update English and Chinese root/package/Skill guidance so base setup, agent-browser, and Browser Use commands are concise and equally weighted.
- [x] 3.2 Update the official website and its assertions to remove agent-browser default-adapter language and present both explicit setup choices.
- [x] 3.3 Amend RFC-0001 and relevant compatibility/release documentation with the pre-release setup contract and unchanged compatibility classifications.

## 4. Verification

- [x] 4.1 Run focused setup, Bridge, Extension, website, and release tests for the four integration selections and missing-integration states.
- [x] 4.2 Run `pnpm run check`, strict OpenSpec validation, and `git diff --check`.
- [x] 4.3 Verify the base and explicit-adapter guidance in the daily-Chrome side panel without changing browser authorization, then clean up temporary verification state outside the repository.
- [x] 4.4 Cover the fixed install-command mapping, long-running correlation, duplicate-click protection, localized install copy, default selection, and failure guidance; rerun focused and full validation.
- [x] 4.5 Cover base, individual, and combined missing-Host setup commands, copy feedback, and retry behavior; rebuild the Extension and rerun strict validation.
- [x] 4.6 Assert the three-card missing-Host hierarchy and rerun Extension and strict validation.
- [x] 4.7 Cover compact text-only adapter toggles and the adjusted guide/copy-control scale; rerun Extension and strict validation.
- [x] 4.8 Cover selection persistence after retry and a transient missing-Host view remount; rerun Extension and strict validation.
- [x] 4.9 Cover the localized action-oriented installation title and shared section-title styling; rerun Extension and strict validation.
- [x] 4.10 Assert the benefit, setup-action, and optional-tool card order plus the command background; rerun Extension and strict validation.

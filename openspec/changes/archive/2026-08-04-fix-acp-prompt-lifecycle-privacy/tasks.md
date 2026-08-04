## 1. Context Envelope and History Privacy

- [x] 1.1 Add literal v1 context-envelope helpers for `<panerelay-context version="1">` / `</panerelay-context>` and strict first-user-message normalization for new and exactly matched legacy prompts.
- [x] 1.2 Wrap only the shared ACP first-turn Panerelay context while preserving the existing blank-line boundary, complete user text, image order, and prompt bounds.
- [x] 1.3 Normalize complete loaded ACP history after chunk assembly, omit context-only legacy image turns, and preserve all unmatched user and assistant messages byte-for-byte within existing limits.
- [x] 1.4 Add focused helper, Qoder, and OpenCode regressions for exact markers, loose-marker rejection, chunk boundaries, legacy variants, image-only turns, and user-authored Panerelay-like text.

## 2. ACP Prompt Lifecycle

- [x] 2.1 Keep the configured timeout on ACP initialization and short session control requests while allowing `session/prompt` to await its terminal ACP response without the control timeout.
- [x] 2.2 Preserve active-turn identity as the exactly-once owner across normal completion, cancellation, runtime exit, provider shutdown, and late resolve/reject paths.
- [x] 2.3 Cancel active sessions and pending permissions during interruption or provider shutdown without leaving a detached Agent turn after Panerelay emits a terminal event.
- [x] 2.4 Replace prompt-timeout regressions with Qoder and OpenCode tests for turns outliving the control timeout, continued updates, explicit cancel settlement, runtime exit, shutdown, provider reuse, and late settlement.

## 3. Compatibility and Verification

- [x] 3.1 Update Qoder 1.1.2, OpenCode 1.18.12, agent-browser 0.33.0 context notes, and retained ACP probe documentation with the exact envelope, Side Panel history boundary, long-prompt lifecycle, and provider-native transcript limitation.
- [x] 3.2 Run the Bridge/provider package tests and typecheck, then `pnpm install --frozen-lockfile`, `pnpm run check`, and `git diff --check`.
- [x] 3.3 Run the disposable real Qoder and OpenCode ACP probes when their user-owned runtimes and credentials are available, capture only bounded capability/results, and leave new behavior `Forwarded` when a probe is not run.
- [x] 3.4 Confirm the change creates no browser participant, target attachment, authorization, control lease, persistent prompt log, credential, or temporary real-runtime artifact; clean up every spawned ACP process and probe file.

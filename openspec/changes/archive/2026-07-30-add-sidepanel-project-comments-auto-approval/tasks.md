## 1. Protocol and Native Context

- [x] 1.1 Add provider-neutral conversation-start options and workspace-directory integration request/result types with protocol contract tests.
- [x] 1.2 Implement and test the cross-platform Native Host directory picker, canonical directory validation, and cancelled selection behavior.
- [x] 1.3 Route validated project and bounded/redacted initial page context through AgentService and the Codex/Qoder providers, including provider-specific regression tests.

## 2. Extension Workspace Context

- [x] 2.1 Extend tab workspace records and optimistic revisions with optional project directories, preserving related-tab inheritance and reset behavior with store tests.
- [x] 2.2 Add background project pick/clear orchestration and capture the active URL/title for draft first-send without exposing raw Chrome tab IDs.
- [x] 2.3 Add localized Side Panel project controls that remain editable only for drafts and cover select, cancel, clear, bound, stale, and error states in controller/component tests.

## 3. Page Comments

- [x] 3.1 Align the isolated page-comment runtime with Mearl's one-shot/continuous selection, anchored compact editor, live style annotations, pencil markers, edit/remove/clear actions, and runtime tests.
- [x] 3.2 Add authorization-checked background comment lifecycle routing that fails closed on restricted, unauthorized, navigated, closed, switched, or revoked tabs.
- [x] 3.3 Add localized Side Panel comment controls with single/double-click behavior, annotation pills, context formatting, empty-request sending, success cleanup, retry preservation, and controller/component tests.
- [x] 3.4 Align the editor placement and palette with the Side Panel, add direct color controls, animate element switching, and support visual-viewport-aware touch selection with focused tests.
- [x] 3.5 Replace the font-based confirmation mark with the repository's Lucide Check icon and tear down the active editor, highlight, and preview when its annotation is removed.
- [x] 3.6 Inject and coordinate the comment runtime across authorized reachable frames, preserve top-page plus selected-frame evidence, and cover iframe routing and formatting.

## 4. Pasted Image Input

- [x] 4.1 Add bounded provider-neutral image inputs with Extension and Bridge validation, and map them to Codex data URLs and negotiated Qoder ACP image blocks.
- [x] 4.2 Add image paste, preview, removal, provider/limit errors, image-only send, success cleanup, and retry preservation to the two-line composer with focused tests.

## 5. Automatic Agent Approval

- [x] 5.1 Add a persisted default-off automatic-approval preference and visible localized Side Panel toggle.
- [x] 5.2 Automatically respond exactly once with one-request `accept` for eligible current-conversation Agent approvals, keep unsupported/failed requests manual, and add focused policy/controller/component tests.

## 6. Architecture and Compatibility

- [x] 6.1 Update RFC-0001 with project/page/image context and automatic-Agent-approval boundaries without changing site authorization, raw tab identity, or control-lease ownership.
- [x] 6.2 Update the agent-browser `0.33.0` Side-panel provider session compatibility group and document iframe comment, image-input, and provider-context limitations.
- [x] 6.3 Keep newly discovered/created target bootstrap virtual until substantive page work, exclude protocol setup from favicon activity, and update RFC-0002 plus regression coverage.

## 7. Validation and Cleanup

- [x] 7.1 Run formatting, targeted protocol/Bridge/Extension tests, strict OpenSpec validation, the full workspace check, and `git diff --check`.
- [x] 7.2 Reload the unpacked Extension in daily Chrome and verify project select/cancel/clear, URL/title orientation, Mearl-aligned comment single/continuous add/edit/style/remove/send/retry/lifecycle, pasted image preview/remove/image-only/failure behavior, manual and automatic Agent approvals, authorization isolation, and narrow/wide layouts; remove temporary comments, tabs, state, and screenshots.

## 1. Prompt integration

- [x] 1.1 Add the prompt-library runtime dependency while preserving the setup package's Node.js contract.
- [x] 1.2 Replace readline setup selection with a localized keyboard multiselect and one shared default confirmation.
- [x] 1.3 Handle prompt cancellation before lifecycle mutations and remove the redundant optional-integration output sentence.
- [x] 1.4 Reuse the prompt library for uninstall confirmation and remove obsolete readline parsing helpers.

## 2. Verification and cleanup

- [x] 2.1 Update automated CLI tests for structured selections, empty selection, skipped prompts, and cancellation without setup calls.
- [x] 2.2 Manually exercise the prompt in a real terminal, including a cancellation path with the daily Chrome environment left unchanged.
- [x] 2.3 Confirm the compatibility documentation needs no version-matrix change because integration versions and browser capability claims are unchanged.
- [x] 2.4 Run package checks, strict OpenSpec validation, the full workspace check, and `git diff --check`; remove obsolete messages and test hooks.

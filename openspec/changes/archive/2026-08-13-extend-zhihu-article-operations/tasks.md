## 1. Fetch-only viability spike

- [x] 1.1 Add a bounded Zhihu article-editor spike and report that records the observed first-party endpoints, request metadata categories, and privacy constraints without retaining credentials or article content.
- [x] 1.2 Run a disposable private-draft create/read/update/delete sequence through Browser Fetch with only declared origins and the existing `_xsrf` binding, always attempting cleanup and recording the bounded outcome.
- [x] 1.3 Confirm unsigned private-draft requests succeed, so no `x-zst-81` signer or signing fixture is needed for the retained command subset.
- [x] 1.4 Reconcile the proposal, spec, design, and remaining tasks with the spike result; do not retain production mutations that require page execution, copied signatures, protected-value export, or an unbounded cross-package workaround.

## 2. Zhihu article commands

- [x] 2.1 Extend Zhihu origin, target, request, error, ownership, and draft-state helpers for the exact fetch-compatible endpoint subset.
- [x] 2.2 Add `article-draft` plus guarded `article-create`, `article-update`, and `article-delete` command metadata and handlers with read-back verification.
- [x] 2.3 Keep `article-publish` and published-article updates Unsupported because their public outcomes have not been safely and synchronously verified; reconcile the proposal, design, spike, and compatibility record.

## 3. Automated coverage

- [x] 3.1 Add Zhihu unit fixtures and tests for target parsing, command metadata, request shapes, partial updates, ownership mismatch, `--execute`, response validation, and fail-closed errors without real content or credentials; signing tests are inapplicable because the verified endpoints are unsigned.
- [x] 3.2 Update aggregate catalog/artifact tests and the isolated Zhihu E2E selector for the retained command surface.

## 4. Compatibility and verification

- [x] 4.1 Update the spike and OpenCLI migration compatibility records with the exact Supported, Forwarded, Partial, or Unsupported article-operation conclusions and browser-ownership limitations.
- [x] 4.2 Build and install the matching local Zhihu adapter, run the retained read and disposable mutation sequence in daily Chrome, and confirm cleanup without committing browser output or identifiers.
- [x] 4.3 Run package-scoped tests and typechecks, `pnpm run check`, strict OpenSpec validation, and `git diff --check`.

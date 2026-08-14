## 1. Live compatibility spike

- [x] 1.1 Capture sanitized first-party request shapes for first publication, published-article update, owned-comment update, and owned-comment deletion.
- [x] 1.2 Determine whether each required dynamic signature can be computed from request-known or non-secret inputs within RFC-0010.
- [x] 1.3 Exercise disposable comment mutations and controlled article publication/update verification with cleanup or restoration.
- [x] 1.4 Reconcile the proposal, delta spec, design, and remaining tasks with the spike conclusions.

## 2. Site commands

- [x] 2.1 Add bounded target, ownership, request, and verification helpers for the verified subset.
- [x] 2.2 Retain `article-publish` as Unsupported with explicit protected-signing evidence.
- [x] 2.3 Add verified `comment-delete`; retain `comment-update` as Unsupported without delete-and-recreate emulation.

## 3. Automated coverage

- [x] 3.1 Add command metadata, `--execute`, ownership, request-shape, response-validation, read-back, retry, and fail-closed tests for every retained command.
- [x] 3.2 Update aggregate catalog/artifact and isolated Zhihu coverage for the retained surface.

## 4. Compatibility and verification

- [x] 4.1 Add the sanitized spike report and update the OpenCLI migration compatibility row with exact Supported, Verified, Forwarded, Partial, or Unsupported conclusions.
- [x] 4.2 Build and install the matching local adapter, run the verified commands in daily Chrome, and confirm cleanup/restoration without committing user content or browser output.
- [x] 4.3 Run package-scoped tests and typechecks, `pnpm run check`, `git diff --check`, and strict OpenSpec validation.

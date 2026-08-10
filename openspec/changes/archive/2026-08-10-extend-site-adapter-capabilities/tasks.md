## 1. Architecture and protocol

- [x] 1.1 Amend RFC-0009 to remove user-managed adapter profiles and site-secret injection while retaining artifact, multipart, bounds, structured-error, compatibility, and rollback decisions.
- [x] 1.2 Remove profile metadata/state, credential-bound session/request fields, and profile validators while retaining the strict v2 artifact and structured-error protocol.
- [x] 1.3 Replace profile/secret protocol tests with rejection coverage for removed metadata and retain artifact, bounds, and legacy-message tests.

## 2. Remove user-managed site credentials

- [x] 2.1 Delete protected adapter-profile storage and the `panerelay profiles` command surface, parser branches, help text, and tests.
- [x] 2.2 Remove `--profile` selection and profile values from CLI dispatch, child invocation, site definitions, generated runtime context, setup docs, and packed-consumer coverage.
- [x] 2.3 Remove Bridge session secret state, credential binding resolution/redaction, Extension credential-binding handling, and their tests without changing Cookie bindings.
- [x] 2.4 Reject user-managed adapter credential metadata and preserve fail-closed behavior for stale profile-aware v2 manifests or requests.

## 3. File artifacts and multipart

- [x] 3.1 Prepare one explicit regular-file argument in the CLI with no-follow/identity checks, safe metadata, MIME inference, 12 MiB limit, path removal, and tests.
- [x] 3.2 Extend adapter invocation/runtime with bounded artifacts, artifact lookup, larger input framing, and structured failures.
- [x] 3.3 Implement and test site-kit multipart construction with bounded text fields, one artifact, safe disposition metadata, Base64 output, and the 16 MiB browser-fetch body limit.

## 4. Site toolkit and representative coverage

- [x] 4.1 Add public SiteError, Base64 byte/text decoding, same-origin page seeding, and validated JSON fetch helpers with unit tests and generated-bundle coverage.
- [x] 4.2 Remove profile metadata/source documentation and packed-consumer cases while retaining file-argument coverage.
- [x] 4.3 Add E2E authentication/blocker metadata without retaining credentials or response bodies.
- [x] 4.4 Migrate and unit-test `sinafinance stock` through Base64 GBK decoding, rebuild the catalog, and run its isolated live E2E.
- [x] 4.5 Replace the Profile-secret multipart fixture with credential-free multipart coverage through the complete CLI/Bridge/Extension path.

## 5. Final verification

- [x] 5.1 Update compatibility documentation so API-key/PAT/manual-token sites remain Pending or Unsupported and localStorage-backed login is a separate future browser capability.
- [x] 5.2 Run package-scoped tests throughout, then `pnpm run check`, relevant agent-browser 0.33.0 regressions, OpenSpec strict validation, and `git diff --check`.
- [x] 5.3 Confirm no generated credentials, profile files, uploaded fixtures, browser logs, screenshots, local paths, or temporary artifacts remain in the repository.

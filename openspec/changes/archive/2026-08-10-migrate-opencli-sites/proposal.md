## Why

The OpenCLI inventory contains 176 site directories, while Panerelay currently exposes only the first batch of fetch-compatible adapters. The migration record therefore cannot distinguish a site that has been migrated and verified from one that needs page control, native-app access, authentication, or upstream investigation.

## What Changes

- Compare every non-internal OpenCLI site directory with the Panerelay built-in catalog.
- Migrate public or cookie-backed HTTP commands that fit RFC-0009 into the command-per-file site-kit format, reusing the existing adapter patterns.
- Add each migrated site to the aggregate catalog and CLI-facing inventory with its supported command set.
- Run one explicitly selected, single-site E2E invocation after each migrated site and record the result without retaining browser or credential data.
- Classify remaining sites as Pending or Unsupported only with an evidence-backed reason, including the missing page/interceptor/native/auth capability or an upstream access constraint.
- Preserve simple download utility by returning bounded inline text/base64 or resource URLs where the source's local-file workflow can be safely reduced to ordinary HTTP.
- Remove duplicate and stale inventory entries and add a final coverage summary and follow-up analysis.
- Preserve canonical OpenCLI site names as adapter IDs, including names that begin with a digit, while keeping command, argument, and protected-binding identifiers letter-prefixed.

Non-goals:

- No change to browser-fetch transport, Extension permission, browser selection, control lease, or adapter child execution boundaries. The adapter-ID grammar changes in lockstep without a compatibility alias.
- No implementation of DOM navigation, page JavaScript, network interception, desktop application control, file transfer, or model-agent sessions inside fetch adapters.
- No login-page automation, credential export, private API token handling, or write workflow unless it is already expressible through the existing cookie/form/header binding contract.
- No release, package publication, or change to the upstream OpenCLI repository.

## Capabilities

### New Capabilities

- `opencli-site-migration`: Define complete inventory coverage, supported fetch-adapter migration, per-site E2E evidence, and evidence-backed residual classification.

### Modified Capabilities

- `fetch-site-adapters`: Permit a canonical adapter ID to begin with a lowercase ASCII digit while retaining the existing letter-prefixed grammar for command, argument, and binding identifiers.

## Impact

- Affected source: `packages/sites/src`, `packages/sites/build.mjs`, `packages/sites/src/index.ts`, `packages/sites/e2e/site.e2e.test.mjs`.
- Affected documentation: `docs/compatibility/opencli-site-migration.md` and, when needed, compatibility notes for live E2E limitations.
- Affected planning artifacts: this OpenSpec change and its validation records.
- The implementation uses the existing `@panerelay/site-kit`, `@panerelay/protocol`, Bridge fetch session, and CLI; it adds no new runtime dependency or browser capability. The `12306` and `36kr` built-ins replace the non-canonical `rail12306` and `kr36` IDs directly.

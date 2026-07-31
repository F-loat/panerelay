## 1. Standalone CLI package

- [x] 1.1 Add publishable `@panerelay/cli` metadata, executable entry, build configuration, license, and package documentation
- [x] 1.2 Move localized browser-list, default-set, and default-clear parsing and behavior into the standalone CLI
- [x] 1.3 Add CLI tests for global/npx-equivalent invocation, localization, bounded output, explicit selector precedence, and failure cases

## 2. Setup separation

- [x] 2.1 Remove recurring browser operations, registry command dependencies, and browser-command help from the setup CLI
- [x] 2.2 Update setup tests to reject migrated commands while retaining setup, update, doctor, and uninstall behavior

## 3. Distribution and documentation

- [x] 3.1 Add `@panerelay/cli` to lockstep typecheck, publish, release preparation, package integrity, and packed-consumer coverage
- [x] 3.2 Update English and Chinese README guidance, package READMEs, installed Agent Skill, RFC-0006, and compatibility documentation
- [x] 3.3 Keep `@panerelay/browser-registry` documented as an engine-neutral internal runtime dependency and preserve Edge's `Forwarded` status

## 4. Verification and completion

- [x] 4.1 Run CLI/setup focused tests, frozen install, strict OpenSpec validation, full `pnpm run check`, and `git diff --check`
- [x] 4.2 Verify the built CLI lists both live daily-browser registrations, changes and clears the saved default, never prints credentials, and leaves browser sessions usable
- [x] 4.3 Remove machine-specific output and sync the completed OpenSpec delta specs before archival

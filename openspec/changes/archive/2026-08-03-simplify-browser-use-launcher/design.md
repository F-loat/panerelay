## Approach

Keep `@panerelay/cli` engine-neutral and implement the dedicated entry point in the setup-generated private launcher. The launcher already belongs to the Browser Use integration and receives the exact supported executable during setup, so it can invoke the existing internal Browser Use dispatch only when its argument list is empty.

The generated launcher will be named `panerelay-browser-use`. On POSIX, it will use a shell argument-count check and `exec` the Node CLI artifact with the configured executable. On Windows, the generated `.cmd` launcher will use an exact first-argument check and invoke the same Node CLI artifact. The launcher accepts no Browser selector; browser routing remains in the unified `panerelay browser ...` commands. Connection mode remains configurable through `panerelay connection use browser-use <direct|extension>`.

The shorthand will not expose or persist CDP URLs, alter adapter registration, modify Browser Use configuration, or add a PATH fallback. The configured executable is the setup-detected absolute path already stored in the integration configuration and used by the MCP launcher.

## Compatibility

- The unpublished launcher name changes from `panerelay-browser-use-cli` to `panerelay-browser-use`.
- The generic CLI implementation may retain internal adapter dispatch, but `run browser-use` is no longer a documented or dedicated-launcher user command.
- Direct and Extension mode selection remains owned by the generic CLI and adapter.
- The Browser Use 0.13.7 / Browser Harness 0.1.8 verified baseline remains unchanged.

## Verification

- Unit-test generated POSIX and Windows launcher content.
- Install a temporary integration with a recording Browser Use executable and verify no-argument stdin execution.
- Verify connection and browser administration remain available through the unified CLI.
- Run formatting, lint, typecheck, tests, build, and `git diff --check`.

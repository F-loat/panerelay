# Contributing to Panerelay

Panerelay is in its RFC phase. Contributions that clarify product scope, protocol boundaries, browser compatibility, security invariants, and user-control behavior are especially valuable.

## RFC workflow

1. Open an issue or discussion for substantial changes when early feedback would help.
2. Copy the structure described in [`docs/rfcs/README.md`](docs/rfcs/README.md).
3. Submit the RFC as `Draft`.
4. Resolve open questions and document meaningful alternatives.
5. Change the status only after maintainers record a decision.

Implementation pull requests should reference the accepted RFC or issue that authorizes the behavior.

## Development workflow

- Use pnpm for JavaScript and TypeScript packages.
- Keep browser- and agent-specific integrations outside the shared protocol.
- Treat user authorization, visible control state, and revocation as product requirements.
- Add tests for protocol compatibility and trust-boundary behavior alongside implementation.
- Run `pnpm run check` before submitting a pull request. CI checks formatting, lint,
  types, tests, and production builds on supported Node.js versions.
- Use Conventional Commit messages.

## Reporting security issues

Do not publish exploit details or sensitive browser data in a public issue. Until a dedicated security contact is established, contact the repository owner privately through their GitHub profile.

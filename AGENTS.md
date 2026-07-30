# AGENTS.md

This file provides guidance to coding agents working in PaneRelay.

## Project phase

PaneRelay is preparing its first stable `0.1.0` release. Its Extension connection, Codex/Qoder
side-panel providers, cross-platform setup flow, and browser-level agent-browser Provider are
available for development and release-candidate testing.

Read the relevant documents in `docs/rfcs/` before changing browser attachment, CDP behavior, agent
sessions, permissions, control ownership, or other cross-package boundaries. RFC-0001 and RFC-0002
are accepted. Keep accepted decisions stable unless a new RFC explicitly supersedes them.

## Package management

- Use pnpm.
- Require Node.js 20.19 or newer for workspace development. Published runtime packages keep a
  Node.js 20 or newer compatibility floor.
- Keep publishable packages under the `@panerelay` npm scope.
- Add applications under `apps/` and reusable packages under `packages/`.

## Architectural boundaries

- Keep browser automation semantics in automation engines such as agent-browser.
- Keep browser-specific and agent-provider-specific behavior outside the shared protocol.
- The Bridge is the local routing and policy boundary.
- The Extension must not store model credentials or spawn native agent processes.
- Protocol identifiers are opaque; do not expose raw Chrome tab IDs as stable public IDs.

## Security invariants

- Site permission and tab control are separate decisions.
- Focus never grants authorization.
- Mutating actions require a current control lease.
- Controlled state and revocation must remain visible and available to the user.
- Unsupported or unauthorized actions fail closed.
- Do not log page content, cookies, credentials, prompts, screenshots, or request bodies by default.
- Bind local services to loopback or user-scoped operating-system transports.

## Documentation

- Update the relevant RFC when implementation changes an accepted architecture or protocol decision.
- Record meaningful alternatives and compatibility limitations.
- Commit RFCs with the implementation they govern. `docs/rfcs/` is the durable record for
  cross-cutting architecture, protocol, security, and ownership decisions.
- Commit spike reports and source fixtures when they make a technical conclusion reproducible.
  `docs/spikes/` is for bounded experiments, compatibility probes, and their reusable test pages.
- Do not commit generated screenshots, browser logs, credentials, or machine-specific verification
  output. Store those outside the repository and link or summarize the result when useful.
- Keep version-specific integration coverage in `docs/compatibility/`.
- Use current-state comments in code; do not narrate changes from previous implementations.

## Change workflow

OpenSpec and RFCs serve different scopes:

- An OpenSpec change, when OpenSpec is present, describes one unit of product or engineering work:
  intent, behavior deltas, design, tasks, and verification.
- An RFC records a decision that must remain understandable and authoritative across many future
  changes.
- A spike reduces uncertainty before either document claims a design is viable.

For non-trivial work:

1. Read the relevant accepted RFCs and compatibility documents.
2. If `openspec/` exists, or the user explicitly requests OpenSpec, create or continue one focused
   OpenSpec change before implementation. Keep its proposal, specs, design, and tasks aligned with
   discoveries made during coding.
3. Use a spike first when browser or third-party behavior is uncertain and a small executable probe
   can answer the question.
4. Add or update an RFC when the work introduces or changes a durable cross-package architecture,
   protocol, security, permission, or ownership decision. Link the OpenSpec change and RFC instead
   of duplicating their full content.
5. Implement and validate against explicit acceptance criteria. Update compatibility matrices for
   version-dependent integrations.
6. Archive an OpenSpec change only after its implementation and verification are complete. Mark an
   RFC `Implemented` only when its code has been released, not merely merged or tested locally.

Small fixes, dependency maintenance, formatting, and documentation corrections do not require an
OpenSpec change or a new RFC unless they alter specified behavior or an accepted decision.

## Validation

At minimum:

```bash
pnpm install --frozen-lockfile
pnpm run check
git diff --check
```

During development, use `pnpm run format`, `pnpm run lint:fix`, and package-scoped
typechecks or tests for faster feedback. Run the full check before finishing.

## Git

- Use Conventional Commit messages written in English.
- Keep commits scoped to one coherent change.
- Do not publish packages or create releases unless explicitly requested.

The following commands publish immutable versions to the public npm registry. Run them only after
an explicit user request, with a clean working tree and an intentionally selected version:

```bash
pnpm publish
```

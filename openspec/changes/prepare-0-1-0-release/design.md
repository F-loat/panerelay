## Context

See [proposal.md](proposal.md) for motivation. The repository already identifies `0.1.0` across release metadata, publishable packages, the Extension, compatibility documentation, and the stable release checklist. The README is accurate but architecture-first, and its opening does not clearly separate Panerelay's external-agent browser relay from its browser-side Agent chat experience.

The implementation currently ships side-panel adapters for Codex and Qoder. Claude is not a shipped `0.1.0` provider. Those facts belong to the `0.1.0` release materials rather than the evergreen README. Durable authorization, control ownership, and browser-process limitations remain governed by RFC-0001 through RFC-0003.

## Goals / Non-Goals

**Goals:**

- Make the two product values understandable in the first screen of each README.
- Explain that login-state reuse comes from operating on the user's existing, explicitly authorized Chrome tabs, not from exporting credentials or cookies.
- Give external Agent users and side-panel users one direct quickstart with the minimum commands.
- Keep English and Simplified Chinese structure and claims equivalent.
- Keep the README independent of a particular Panerelay release while directing readers to release notes and compatibility records for version-bound facts.
- Confirm stable release identity and local candidate integrity using existing tooling.

**Non-Goals:**

- Add or imply a shipped Claude provider.
- Replace the detailed compatibility matrix or release checklist with marketing copy.
- Weaken the stable-distribution acceptance gate or reclassify Automated, Forwarded, Partial, or Unsupported capabilities as Verified.
- Publish packages, tag a commit, upload assets, or retain a candidate before an intended release commit exists.

## Decisions

### 1. Lead with outcomes, then explain architecture

The README opening will state that Panerelay connects Agents to the Chrome the user already uses, then present two numbered value propositions:

1. any Agent capable of using agent-browser CLI or MCP can control explicitly authorized existing tabs with their live login state;
2. the Extension side panel discovers supported local Agent providers and offers chat, approvals, activity, and release without storing model credentials.

The Bridge diagram and security boundary follow this section. This order answers “why use it?” before “how is it built?”

Alternative considered: keep the architecture diagram first. Rejected because it makes the reader infer the product value from internal components.

### 2. Keep release inventory out of the evergreen README

The README will describe automatic discovery of supported local Agent providers without naming a version-specific provider inventory, candidate archive, or agent-browser baseline. Each release's notes, release checklist, and compatibility record will identify the providers and versions that actually ship. For `0.1.0`, those materials name Codex and Qoder and do not claim Claude support.

Alternative considered: keep a “What 0.1.0 includes” section in the README. Rejected because it turns the repository landing page into a stale copy of release notes.

### 3. Use one linear quickstart with two visible outcomes

The quickstart will cover Extension loading, one setup command, explicit authorization, the agent-browser verification command, and opening the side panel with an installed supported provider. Optional update, diagnostics, uninstall, and custom-ID material stays below the primary path.

The setup command keeps `--global-provider` so the default-routing behavior is explicit. The verification command keeps `--provider panerelay` so readers can test Panerelay without relying on ambient configuration.

### 4. Treat local validation and publication as separate states

The change may run source checks, release metadata checks, and disposable packed-consumer smoke tests. It will report unresolved real-browser or Windows evidence exactly as documented. It will not execute `pnpm publish`, create `v0.1.0`, call a release API, push a commit, or upload a candidate.

## Risks / Trade-offs

- **[Risk] “Reuse login state” could sound like credential extraction.** → State that Panerelay operates on explicitly authorized existing tabs and does not copy or log cookies or credentials.
- **[Risk] “Any Agent” could overpromise runtime integration.** → Qualify it as any Agent that can invoke agent-browser CLI or MCP; browser-command coverage remains pinned to the compatibility matrix.
- **[Risk] “Zero configuration” could overpromise provider availability.** → Describe automatic discovery after the one-time local setup and require the selected provider CLI to be installed and authenticated.
- **[Risk] An evergreen provider description could hide exact availability.** → Link release notes and compatibility records, where the shipped provider inventory is explicit.
- **[Trade-off] A shorter README carries less edge-case detail.** → Preserve links to the compatibility matrix, release checklist, and RFCs.

## Migration Plan

1. Rewrite both README introductions, value sections, workflow explanation, and quickstart.
2. Audit version identity and release claims against repository metadata and provider code.
3. Run formatting, release checks, strict OpenSpec validation, and the full workspace check.
4. Leave external publication and unresolved platform evidence as explicit follow-up gates.
5. Roll back by restoring the README text; no runtime state or compatibility contract changes.

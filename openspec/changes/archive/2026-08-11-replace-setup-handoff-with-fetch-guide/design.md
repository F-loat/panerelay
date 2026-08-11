## Context

See [proposal.md](proposal.md) for motivation. The homepage currently places an interactive four-choice automation setup handoff beneath the base Setup and Skill commands. The same page already has a separate Connect comparison and a complete raw Fetch CLI example. Base Setup owns its supported interactive integration flow, so the setup handoff duplicates both Setup and the later Connect content.

The change is presentation-only. Fetch authorization remains the separate exact-domain model defined by RFC-0009 and RFC-0010; tab authorization and active control remain governed by RFC-0001 through RFC-0004. The verified and forwarded compatibility classifications remain unchanged.

## Goals / Non-Goals

**Goals:**

- Make the recommended Agent-facing Fetch invocation discoverable immediately after installation.
- Remove the duplicated setup choice state and the code used only to synchronize it.
- Preserve localized, no-JavaScript-readable content and an accessible copy action.

**Non-Goals:**

- Change Setup prompts, Agent configuration, Fetch requests, permissions, or automation-engine behavior.
- Duplicate the full raw CLI walkthrough in the Setup section or remove it from the later Fetch workflow.
- Change any compatibility status or release claim.

## Decisions

### Use one concrete Agent prompt instead of another workflow selector

The replacement presents a known absolute URL and explicitly names the installed `panerelay` Skill, Panerelay Fetch, browser login state, and possible exact-domain approval. This teaches the shortest normal Agent workflow without requiring visitors to know the MCP tool identifier.

Alternative: show tabs for Agent, CLI, and site-adapter variants. Rejected because the later Fetch workflow already contains the complete CLI and adapter path, and another selector would recreate the density being removed.

### Reuse the generic localized copy behavior

The example uses one localization key through the existing `data-copy-text-key` mechanism. The implementation removes handoff-specific selection and command synchronization while retaining generic copy status behavior.

Alternative: hard-code the example in the copy attribute. Rejected because the visible and copied Chinese and English text could drift.

### Keep Connect guidance in the dedicated workflow comparison

The Setup section no longer presents per-engine prompts or manual Setup flags. Upstream links, engine descriptions, commands, and pinned compatibility evidence remain in the existing Connect comparison, preserving all supported integrations without repeating installation choices.

## Risks / Trade-offs

- [Visitors looking for manual per-engine flags no longer find them in Setup] → Keep the dedicated Connect workflow links and advanced repository documentation intact.
- [The sample endpoint may be mistaken for a live service] → Use `api.example.com`, label it as an example, and describe replacing it with the visitor's known URL.
- [Removing selector code could affect unrelated copy controls] → Delete only handoff-specific state and retain focused source and browser interaction checks for the generic copy path.

## Migration Plan

Ship the static homepage markup, localization, styling, script cleanup, and tests together. Rollback is a single static-site revision and requires no data migration, protocol negotiation, or browser state change.

## Context

See [proposal.md](./proposal.md) for motivation. RFC-0009 already defines Fetch domain authorization as independent from automation tab authorization and active control. The Side Panel has a compact automation authorization card, a full Fetch authorization panel in Settings, and controller methods that already perform user-gesture-bound Chrome Host Permission requests. The root READMEs already describe Fetch and Connect, while the setup package already implements the accepted `add --all` contract.

## Goals / Non-Goals

**Goals:**

- Make the connected ready welcome state show four independent card rows, with the two authorization models following the two suggestions.
- Keep the welcome suggestions focused on summarizing content and operating the page.
- Reuse the existing authorization state and permission request paths so compact and Settings surfaces cannot diverge.
- Make the ordinary Fetch onboarding path short while retaining direct MCP configuration for advanced use.
- Add regression coverage around existing all-adapter installation behavior and README structure.

**Non-Goals:**

- Introduce a new protocol message, permission store, or authorization scope.
- Move arbitrary domain management or revocation out of Settings.
- Change Bridge routing, automation ownership, or site-adapter runtime behavior.

## Decisions

### Reuse the existing Fetch authorization controller

The compact Fetch card will call the same current-domain and all-domain controller operations as the full Settings panel. This preserves the direct user gesture needed by `chrome.permissions.request`, existing failure behavior, and the established transition from a broad grant to an exact current-domain grant.

An alternative was to add a compact-specific controller method. That would duplicate authorization transitions and create two paths whose permission and persistence behavior could drift.

### Present four independent card rows

The connected ready welcome stack will render summarize, operate, Automation authorization, and Fetch authorization as four sibling cards. The authorization cards retain the same border, radius, spacing, icon, copy, status, and selector structure as the suggestion cards, without a shared authorization container. Each authorization card reads only its own state. The compact Fetch card offers exactly current domain and all domains; arbitrary domain additions and revocation remain in the full Settings panel.

Both compact selectors use direct toggling: choosing an inactive scope enables it, and choosing the selected scope again disables it. The Automation selector no longer exposes a separate release item. Clearing an authorization scope uses the existing authorization controller and does not call the independent active-control release operation. The shared Select menu supports an explicit selected-option callback so this toggle behavior remains opt-in and does not alter provider, locale, theme, or other selectors.

An alternative was one shared authorization card with two internal rows. Independent sibling cards keep the complete welcome stack visually consistent and avoid implying that Automation and Fetch form one combined setting. A shared card with one common selector was also rejected because it would incorrectly imply one authorization decision grants both capabilities.

### Keep two focused welcome suggestions

The ready-Agent welcome state will retain summarize-page and rename the second action to operate-page with task-oriented copy. The separate find-information suggestion is removed because it overlaps with both free-form composition and the summarize workflow without introducing a distinct capability.

### Fail closed when there is no eligible current domain

The current-domain option will be disabled when the active tab cannot produce an eligible HTTP(S) origin. The all-domain option remains an explicit user choice. The compact card does not infer a domain from browser-internal pages or silently widen the request.

### Keep external MCP configuration in advanced documentation

The primary Fetch section will describe known URLs, built-in site adapters, and domain authorization. Direct external MCP client configuration moves into the existing collapsed advanced section. The architecture overview becomes Mermaid so the two routes and their distinct targets remain easy to scan in both languages.

### Test `add --all` without changing its contract

Setup parsing, installation expansion, help text, and release documentation tests will directly cover `npx --yes @panerelay/setup add --all`. No parser or registry redesign is needed because the current implementation already resolves `all` to every built-in adapter.

## Risks / Trade-offs

- [Four independent cards increase stack height] → Keep every row compact and retain only the two distinct suggestion actions.
- [Selected options normally close without dispatching a change] → Add an opt-in selected-option callback and use it only for the two compact authorization selectors.
- [Chrome permission denial can leave the visual selection unchanged] → Continue deriving displayed selection from confirmed controller state and surface the existing localized error.
- [README Mermaid support varies by renderer] → Keep descriptive node labels and surrounding prose sufficient to understand Fetch and Connect without relying only on the diagram.

## Migration Plan

Ship the Extension copy and compact Fetch surface in the normal lockstep release. No stored state or protocol migration is required. Rollback consists of removing the compact Fetch rendering and restoring the previous compact card label; existing authorization records remain valid throughout.

## Why

agent-browser 0.33.0 enables page, runtime, and network domains as soon as it discovers a page. Treating those passive observation commands as active control changes every discovered tab's count and favicon, while deferring `Network.enable` loses requests that occurred before the first later command.

## What Changes

- Distinguish debugger-attached read-only observation from active browser control.
- Let passive setup and explicitly allowlisted read-only CDP commands attach early enough to preserve event data without increasing the controlled-target count or changing the page favicon.
- Upgrade an observed target to controlled before navigation, interaction, mutation, emulation, or any command whose read-only safety is ambiguous.
- Report observed-target and controlled-target counts separately in the side panel while keeping immediate release available for the complete lease.
- Keep classification fail-closed: `Runtime.evaluate`, unknown methods, and domain-wide method guesses are not considered read-only.
- Deduplicate unchanged target metadata so new-tab setup does not amplify lifecycle traffic.
- Keep an active discovery lease's initial target inventory stable: later ordinary tabs stay private, while Agent-created tabs and tabs opened from a currently controlled tab are reported through trusted Chrome opener relationships.
- Serialize each tab's lifecycle publication so concurrent creation and metadata events cannot emit duplicate target-created events.

Non-goals:

- Do not hide an active Chrome debugger attachment or remove the user's release control.
- Do not infer safety by parsing arbitrary JavaScript expressions.
- Do not change agent-browser's CLI, daemon, automation semantics, or browser ownership limits.
- Do not promise complete events from domains agent-browser has not enabled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-session-lifecycle`: Separates observed debugger attachments from targets upgraded to active control.
- `external-agent-activity`: Reports observation and control independently without treating passive reads as controlled activity.

## Impact

- Protocol: add an observed-target count and a shared fail-closed CDP access classifier.
- Bridge: retain debugger attachment for observation, track controlled targets independently, and preserve network event history.
- Extension: apply the favicon only for control-class commands and avoid unchanged target updates.
- Target discovery: seed the lease from its initial eligible inventory, then expand only for Agent-created tabs or tabs Chrome reports as opened from a currently controlled tab.
- Side panel: render observed and controlled counts separately.
- Tests and documentation: update RFC-0002, RFC-0003, agent-browser 0.33.0 compatibility evidence, and browser-relay/Extension regressions for page, runtime, network, new-tab, and favicon behavior.

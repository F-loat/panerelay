## Why

The homepage repeats automation-engine setup choices immediately after the interactive base Setup command already handles them, while the normal Agent-facing way to use Panerelay Fetch remains easy to miss. The setup journey should spend that space showing visitors how to request a known URL with their existing browser login state.

## What Changes

- Remove the redundant agent-browser, Browser Use, Playwright CLI, and combined integration chooser, setup prompts, and manual integration command from the homepage Setup section.
- Replace that block with a concise Fetch usage guide: give an Agent a known absolute HTTP(S) URL, ask it to use the installed `panerelay` Skill and Panerelay Fetch with browser login state, then approve the exact domain in the Extension when requested.
- Keep an accessible copy action for the localized example Fetch prompt and retain the complete raw CLI example in the Fetch workflow below.
- Remove JavaScript and styling that existed only for the deleted setup handoff selector, and update bilingual source regressions and layout checks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-website`: Setup owns supported automation integration choices on the homepage, while the adjacent guidance teaches the recommended Agent-facing Panerelay Fetch workflow instead of repeating per-engine setup.

## Non-goals

- Do not change Fetch domain authorization, tab authorization, active-control ownership, browser attachment, CDP behavior, or automation-engine semantics.
- Do not change the accepted minimum or verified baseline for agent-browser 0.33.0, Browser Use, or Playwright CLI, and do not change any compatibility group.
- Do not remove the separate Connect comparison or its links and compatibility evidence.

## Impact

- Bilingual homepage markup, localization, styling, interaction code, and source tests under `apps/website/`.
- The `project-website` behavior specification.
- No runtime protocol, Extension permission, Bridge, package API, dependency, or compatibility-matrix impact.

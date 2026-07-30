## Context

See `proposal.md` for motivation. The Side Panel currently combines static markup, localization, provider and conversation orchestration, Chrome messaging, rendering, and event wiring in `index.html`, `index.ts`, and `styles.css`. Vite and CRXJS already build the Extension, so the migration can stay inside the existing application boundary.

The Side Panel must preserve the authorization and ownership decisions in RFC-0001 and RFC-0002. It does not interpret CDP operations, store credentials, or change the Verified/Forwarded/Partial/ Unsupported classifications for agent-browser 0.33.0.

## Goals / Non-Goals

**Goals:**

- Establish a typed React component boundary around each major Side Panel region.
- Make asynchronous provider, conversation, status, and authorization state explicit and testable.
- Use Tailwind for component layout and state variants while preserving the current semantic color, radius, spacing, and typography tokens.
- Keep Chrome runtime messaging behind a small client interface that can be replaced in tests.
- Preserve the current rendered behavior throughout the cutover.

**Non-Goals:**

- Do not change provider selection, conversation creation/resume, tab ownership, error semantics, authorization, or browser control.
- Do not introduce a general shared web design system or add React to the background worker.
- Do not rewrite provider or protocol data models merely to suit the UI framework.
- Do not claim new real-browser compatibility evidence from a presentation-layer refactor.

## Decisions

### Use React 19 only for the Side Panel document

`main.tsx` mounts one `SidepanelApp` root. Components cover the app header, provider selector, conversation actions, welcome suggestions, authorization controls, status/error surfaces, timeline, composer, and settings panel. The background worker remains TypeScript with no React dependency.

This keeps framework lifecycle and bundle cost out of the security-sensitive routing boundary. Vue and a hand-written reactive store were considered, but React matches Mearl's proven component and hook model and has stronger local test ergonomics for the upcoming workspace change.

### Move orchestration into a reducer-backed hook

`useSidepanelController` owns provider, conversation, timeline, connection, authorization, composer, pending approval, and settings state. It exposes intent methods rather than DOM nodes. Incoming runtime events dispatch reducer actions, and effects register and clean up listeners exactly once.

Provider-neutral Chrome messages live in `sidepanel-client.ts`. The client has no visual state and can be replaced with a deterministic fake in component tests. Existing pure helpers remain separate where useful.

### Preserve behavior before changing conversation semantics

The migration first reproduces the existing state machine, including current eager conversation resume and start behavior. The later conversation-workspace change is responsible for lazy history, draft-only new conversations, provider prewarm, and tab binding.

This sequencing makes regressions attributable. Combining both changes would make screenshot and interaction differences ambiguous and would complicate rollback.

### Adopt Tailwind 4 through Vite with semantic tokens

The Vite Tailwind plugin processes a Side Panel stylesheet that imports Tailwind and maps existing CSS custom properties to semantic theme values. Components use utilities and small reusable component classes for layout and state variants. Complex Markdown content, animations, and browser control details may retain scoped CSS where utilities would reduce clarity.

The current appearance remains the baseline. Tailwind's preflight is explicitly accounted for, and the output is checked in both narrow and wide Side Panel sizes. CSS variables remain the stable theme vocabulary so a later design-system extraction does not require changing component logic.

### Use Vitest, Testing Library, and happy-dom for UI behavior

Pure protocol and background tests keep the Node test runner. Side Panel component tests use Vitest with happy-dom and a fake client to cover rendering, localization, provider switching, authorization, message submission, approvals, activity, settings, and error handling. Static source assertions are removed once the corresponding behavior has a component test.

This provides user-observable assertions without requiring Chrome for every UI state. A final unpacked-Extension smoke check still covers the actual Vite/CRXJS output.

## Risks / Trade-offs

- **Large parity migration hides a behavior change** → land state and component tests before deleting the imperative entry point, and compare the same localized states in Chrome.
- **Tailwind preflight changes native controls or Markdown** → retain explicit semantic component styles for those surfaces and test narrow Side Panel rendering.
- **React effects duplicate Chrome listeners during development** → every effect returns cleanup, and tests assert one subscription per mounted client.
- **Bundle size increases** → scope React to one document and inspect the production build output; browser-control and Native Messaging bundles remain unchanged.
- **The migration blocks conversation work** → keep the client and controller contracts narrow so behavior work can begin immediately after parity checks pass.

## Migration Plan

1. Add React, Tailwind, and component-test dependencies and configure the existing Vite build.
2. Add the typed client, translations, reducer/controller, and component tree alongside the current implementation.
3. Reproduce existing UI states and interactions in component tests.
4. Switch the Side Panel HTML to the React entry point and remove superseded imperative DOM wiring.
5. Run package and repository checks, build the unpacked Extension, and smoke-test the Side Panel.
6. Roll back by restoring the previous Side Panel entry files; background, protocol, permissions, and stored data are unchanged.

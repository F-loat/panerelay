# First-screen experience research

## Objective

Define an attractive, product-accurate first screen that explains Panerelay to a new visitor from installation through the first controlled browser action. The result must make the product understandable without relying on brand familiarity, while preserving Panerelay's explicit authorization and visible-release boundaries.

## Product truth

The real zero-to-first-control journey is:

```text
Install the Extension
        ↓
Install the Panerelay Native Host
        ↓
Connect agent-browser, browser-use, both, or neither
        ↓
Explicitly authorize the current tab or all supported tabs
        ↓
The selected Agent observes and controls only eligible tabs
        ↓
Control actor, activity, favicon, and release stay visible
        ↓
Release ends control without changing the selected authorization scope
```

Authoritative implementation references:

- The toolbar action opens the side panel: `apps/extension/src/background/index.ts`.
- The missing-Native-Host guide and optional integration choices: `apps/extension/src/pages/sidepanel/app.tsx` (`PanerelaySetupGuide`).
- The current-tab/all-tabs controls and release action: `apps/extension/src/pages/sidepanel/app.tsx` (`AuthorizationPanel`).
- The control actor, state, targets, heartbeat, and activity list: `apps/extension/src/pages/sidepanel/app.tsx` (`ExternalControl`).
- Eligible targets fail closed before authorization: `apps/extension/src/background/index.ts` (`listEligibleTargets`).
- Engine-specific controlled favicons and the green status dot: `apps/extension/src/background/controlled-favicon.ts`.
- Release preserves authorization while ending control: `apps/extension/src/pages/sidepanel/app.component.test.tsx`.
- Agent-guided upstream inspection, integration, doctor, and acceptance checks: `skills/panerelay-browser/SKILL.md`, installed independently with `npx skills`.

## External benchmarks

The most useful pattern is not one competitor's complete layout. It is a combination of a clear dual setup entry and a product-accurate interface walkthrough.

- [Browserbase](https://www.browserbase.com/) pairs a direct human action with a distinct “Setup for agents” action. Panerelay should borrow the human/Agent entry split, but say “the tabs you choose” rather than claiming access to the whole web.
- [Browserbase Agent setup](https://docs.browserbase.com/welcome/getting-started) asks coding Agents to read a public `SKILL.md`, supporting Panerelay's short prompt plus authoritative published-guide approach.
- [Browser Use](https://browser-use.com/) demonstrates strong hierarchy, restrained color, and one dominant CTA. Its [Human Quickstart](https://docs.browser-use.com/open-source/quickstart) and [Agent-oriented prompts](https://docs.browser-use.com/open-source/vibecoding) validate separating human installation from Agent-guided integration.
- [agent-browser](https://agent-browser.dev/) leads with a precise category statement and executable installation commands. Panerelay should keep that precision in docs and setup states, but its first screen must also show the authorization UI that differentiates the product.
- [Linear](https://linear.app/) places a real product surface immediately below a confident, concise promise. Its useful pattern is a visible human-to-Agent state chain, not decorative motion.
- [Cursor](https://cursor.com/) uses one real task across product interfaces. Panerelay should similarly keep one scenario through installation, authorization, action, and release.
- [Raycast](https://www.raycast.com/) has strong platform-aware installation hierarchy and visual confidence, but its large atmospheric artwork and whitespace would delay product understanding for an early-stage Panerelay.
- [Vercel](https://vercel.com/) demonstrates concise positioning and restrained visual hierarchy. Its rotating audience labels are unsuitable for agent-browser and browser-use because those integrations are peers, not global product modes.
- [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/) provide the labels, pause, restart, and seek behavior needed by a controlled multistage walkthrough. [`gsap.matchMedia()`](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/) supports separate responsive and reduced-motion behavior with automatic cleanup.
- [WAI carousel guidance](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) and [WCAG Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) require visitor control over automatically changing content and stopping auto-rotation on interaction.

## Positioning recommendation

The first screen should lead with the external-Agent outcome because it is the least obvious and most differentiated:

**English**

> Let your Agent use the browser you already use.

> Connect agent-browser or browser-use to the Chrome and Edge tabs you choose—reuse signed-in sessions, stay in control.

**Simplified Chinese**

> 让 Agent 在你常用的浏览器里工作。

> 把 agent-browser 或 browser-use 接入你明确授权的 Chrome / Edge 标签页，复用登录状态，随时释放控制。

`Agent side panel · Automation integrations` remains a useful eyebrow and a second-screen product model, but should not carry the primary promise.

Primary first-screen actions:

1. Install the Extension / 安装扩展 — dominant product CTA.
2. Set up with your Agent / 交给 Agent 接入 — copies the concise website-guide-backed handoff; centered copied feedback overlays the original content without changing its intrinsic button size.
3. Documentation — a lower-emphasis text link rather than a third equal CTA.

## Approved-direction storyboard

The walkthrough uses one stable browser/desktop stage. All six steps are visible as compact selectable navigation, but only the selected interface is rendered as the active visual state. The default path uses agent-browser because its command flow is concise; browser-use remains a peer choice in step 3 and receives full explanation later on the page.

### 01 — Install Extension

Show a representative Chrome Web Store product surface rather than duplicating browser chrome pixel for pixel:

- Panerelay icon and name;
- the real description “Connect authorized browser tabs to local AI agents” / “将已授权的浏览器标签页连接到本地 AI Agent”；
- “Add to Chrome” / “添加至 Chrome” as the single highlighted action;
- the Panerelay toolbar icon appearing after installation.

The surrounding store layout is representative because Chrome-owned UI can change independently.

### 02 — Connect Local

Accurately reproduce the Extension's missing-Native-Host state:

- “Install the Panerelay integration” / “安装 Panerelay 本地集成”;
- the real description and benefit rows;
- “Install the local integration” / “安装本地集成”;
- the gray command surface containing `npx --yes @panerelay/setup`;
- copy and retry controls.

The terminal completion may show only actual setup vocabulary such as “Panerelay setup complete” and “Native Host”. This command must not imply that agent-browser or browser-use was installed.

### 03 — Connect Tool

Show a neutral “Your Agent” conversation surface with three peer choices: agent-browser, browser-use, and both. The default scenario is agent-browser. The Agent reads the authoritative published guide, checks the existing environment, and only then runs the selected Panerelay integration and doctor commands.

The interface must distinguish detecting or installing an upstream tool from adding its Panerelay integration. It must not imply that `@panerelay/setup` installs an upstream automation tool.

### 04 — Authorize Tab

Accurately reproduce the Extension settings card:

- “Browser access” / “浏览器授权”;
- “This tab” / “当前标签页”;
- “All tabs” / “所有标签页”;
- the real un-authorized and single-tab help text;
- “Release” / “释放” after authorization.

Before this action, the Agent sees no unauthorized target. After current-tab authorization, the card names the authorized page and keeps the selected scope visible.

### 05 — Agent Works

Use one task that requires both observation and a control-class action. The Agent first lists the now-eligible tab and takes a snapshot, then performs a click or navigation.

Synchronize the real observable product states:

- agent-browser favicon plus green dot on the controlled tab;
- the action badge count;
- “External control” / “外部控制” with actor and session;
- “Active” / “正在控制”, one controlled tab, and a live heartbeat;
- sanitized “Read page” and “Interact with page” activity rows.

The task result returns to the Agent surface. Panerelay's activity UI does not display captured page content.

### 06 — Release Anytime

Show the user activating the real Release action. The end state restores the page favicon, clears the action badge, and changes External Control to Released. The selected current-tab authorization remains active and the card still names the authorized target. A short product annotation may explain that clicking the already-selected scope is the separate action that cancels authorization.

## Visual direction

- Use a near-black canvas and one quiet emerald ambient glow; green is reserved for install readiness, authorization, active control, and success.
- Use one confident sans-serif hero rather than mixing a display serif into the core product promise.
- Allocate roughly 40% of desktop width to the promise and actions and 60% to the product stage.
- Keep the stage readable and crisp: one complete surface, one highlighted user action, and one causal state change per step.
- Use light browser chrome only where the real surface is light, especially the Extension side panel; this contrast makes the product legible instead of burying every interface in the page's dark theme.
- Use a compact six-step rail inside the stage frame. It must not resemble a large global adapter switcher.
- Animate opacity and transforms only. Avoid continuous typing, elastic easing, large zooms, parallax, blur animation, and decorative perpetual motion.
- Auto-play one 12–16 second pass and stop on the released state. Hover, focus, manual step selection, document hiding, or leaving the viewport pauses it. Manual selection does not auto-resume.
- On mobile, stack copy above the stage, use a single-column side-panel-shaped surface, make steps horizontally scrollable or a 3-by-2 grid, disable auto-play, and keep the primary CTA in the first viewport.

## Rejected patterns

- Starting with a command against an already configured browser: it skips the new user's first question and obscures installation requirements.
- Discovering a tab before authorization: current implementation fails closed and returns no unauthorized targets.
- Page-owned authorization and release overlays: these are not Panerelay product UI.
- Multiple terminal, browser, authorization, and result windows overlapping at once: users cannot map an action to its consequence.
- A code-only hero: installation commands are supporting evidence; the authorization and control UI is the differentiator.
- A pure brand-poster hero: Panerelay does not yet have enough category familiarity for an unexplained slogan.
- A large global agent-browser/browser-use switcher: integrations are peer choices within Automation tool integrations, not site modes.
- An infinite animation loop: it distracts, wastes work offscreen, and conflicts with accessible motion guidance.
- Green fill for every selected or hovered element: it destroys the meaning of authorization and active control.

## First-screen acceptance criteria

Product accuracy:

- The sequence starts with Extension installation and shows all six states in order.
- No tab title or target is visible to the Agent before authorization.
- Setup does not claim to install agent-browser or browser-use.
- Authorization occurs in an Extension-derived interface using the real labels and state descriptions.
- Observation alone does not trigger the controlled favicon; a mutating control action does.
- The controlled favicon, actor, activity, heartbeat, and release state match current product behavior.
- Release ends control and preserves the selected authorization scope.

Interaction and accessibility:

- Every step is directly selectable by pointer and keyboard without passing through intermediate states.
- Pause/resume and replay are available whenever auto-play is enabled.
- Auto-play runs once, pauses on hover/focus/visibility/intersection changes, and never resumes after manual selection without an explicit visitor action.
- Reduced-motion and no-JavaScript states remain coherent, complete, and operable without automatic movement.
- Only the active panel is exposed to keyboard focus and assistive technology; automatic state changes are not repeatedly announced.
- The stage does not change height as steps change and does not cause page-level horizontal overflow.

Responsive and performance:

- The first screen remains readable at 1440×900, 1280×720, and 390×844 in English and Simplified Chinese.
- The primary CTA and the current walkthrough state remain visible without an initial scroll on the target desktop layouts.
- Motion uses only composited opacity and transform changes and adds no GSAP plugins, ScrollTrigger, analytics, or remote runtime dependency.
- The page targets LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1; visual review must confirm that animation does not repaint the entire hero continuously.

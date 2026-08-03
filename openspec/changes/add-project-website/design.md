## Context

See `proposal.md` for the motivation. Panerelay now has a vanilla Vite website implementation and GitHub Pages workflow awaiting production deployment, but its public narrative still starts from individual integrations instead of the product outcomes. The refreshed journey must explain Panerelay first through the Agent side panel and Automation tool integrations, then explain both automation engines without changing the durable authorization, ownership, or compatibility decisions in RFC-0001 through RFC-0007 and the version-specific records under `docs/compatibility/`.

The two reference sites establish a useful developer-tool pattern: a restrained dark palette, a single strong value statement, code as product proof, and a short sequence of capability sections. Panerelay needs its own visual identity and a more prominent trust model because it operates in a user's daily browser.

## Goals / Non-Goals

**Goals:**

- Deliver a polished, responsive single-page project site with clear install and source paths.
- Present Agent side panel and Automation tool integrations as the core product model, with agent-browser and Browser Use as peer choices inside the latter.
- Make repository entry documentation answer “which outcome do I want, how do I install Panerelay, and what should I ask my Agent to configure?” before explaining internals.
- Keep the initial page fully useful as static HTML, with JavaScript limited to progressive enhancement.
- Make the permission model, revocation behavior, credential boundary, and browser-ownership limits visible rather than hiding them in secondary documentation.
- Present the complete product narrative in English and Simplified Chinese without introducing a localization service or client-rendered application shell.
- Produce deterministic static assets that work at the GitHub Pages repository subpath.
- Integrate website build and validation into the existing workspace without adding an independent dependency stack.

**Non-Goals:**

- Build a full documentation portal, blog, CMS, hosted application, telemetry pipeline, external localization platform, or arbitrary locale catalog.
- Reimplement browser automation visuals with captured user data or claim behavior beyond the accepted RFCs and compatibility records.
- Change any Extension, Bridge, protocol, setup, release, or browser-control behavior.
- Claim that Panerelay transparently intercepts arbitrary Browser Use Python SDK construction or that Edge Browser Use has a verified baseline.

## Decisions

### Use a small vanilla Vite application

`apps/website` will use semantic HTML, CSS, and a small TypeScript entry point built by the same Vite version already present in the workspace. Vite provides local preview, hashed production assets, and a reproducible static build while the vanilla page avoids a client-rendering dependency for content.

Alternative considered: React would match the Extension stack, but adds runtime and hydration work with no benefit for a mostly static landing page. Hand-copying source files into a Pages artifact would avoid a bundler, but would create a separate ad hoc build path and weaker asset handling.

### Use a single narrative page with progressive disclosure

The page will contain:

1. a compact navigation and direct install/source actions;
2. a hero that promises an Agent can use the browser the visitor already uses, leads with separate human and Agent setup actions, and demonstrates the complete first-use journey;
3. one product-accurate browser/desktop stage whose six selectable interface states are built from semantic HTML/CSS/SVG rather than product screenshots;
4. paired Agent side-panel and automation-tool integration workflows, with an agent-browser/Browser Use comparison inside the latter;
5. a short product installation sequence followed by Agent-guided workflow handoffs;
6. a trust and compatibility section that links to the authoritative records;
7. a final call to action and repository-oriented footer.

This keeps discovery fast while giving security-conscious visitors enough context before installation. A multi-page site was considered, but would duplicate existing repository documentation and make claim drift more likely.

### Establish an original Panerelay visual system

The site will reuse the existing Panerelay mark and pair it with a near-black surface, one quiet emerald ambient glow, confident sans-serif headings, thin structural borders, and monospace product evidence. Green is reserved for installation readiness, authorization, active control, and success so it retains semantic meaning. The first screen allocates roughly forty percent of desktop width to positioning and actions and sixty percent to the product stage. On wide desktop viewports, the hero and 75-pixel positioning strip together fill one dynamic viewport; short desktop heights tighten the hero padding, while intermediate and mobile widths stack the two columns and keep their natural height. Localized headline sizing is constrained by the actual copy column so glyphs cannot paint under the product stage. Subtle reveal states may enhance cause and effect, but the design remains legible without animation and disables non-essential motion under `prefers-reduced-motion`.

The design borrows the reference sites' clarity and developer-tool density, not their logos, layouts, copy, or proprietary assets. Image CDNs will not be required. The only external visual dependency is an explicitly allowlisted open-source Chinese display font stylesheet; the page remains usable with system fallbacks when it is unavailable.

### Demonstrate the standard workflow on the first screen

The hero leads with “Let Agents work with the browser you already use” / “让 Agent 在你的日常浏览器里工作”. Its dominant action installs the Extension. A separate “Set up with your Agent” / “交给 Agent 接入” action copies the concise repository-Skill-backed handoff, while documentation remains a lower-emphasis link. `Agent side panel · Automation integrations` stays as an eyebrow and the broader model is explained later rather than carrying the primary promise. The button remains intrinsically sized by its original label; copied feedback is overlaid at its center while the original content stays in layout.

The hero's right side is one stable browser/desktop stage rather than a decorative mockup or a stack of simultaneous surfaces. A compact six-step rail directly selects these complete states:

1. **Install Extension** — a representative Chrome Web Store product surface using the real Panerelay name and description, one highlighted Add to Chrome action, and the toolbar icon appearing after installation;
2. **Install Skill** — the unified `panerelay-browser` Skill benefits, gray `npx skills add F-loat/panerelay --skill panerelay-browser` command surface, copy action, ready state, and installed result;
3. **Connect Tool** — a neutral Agent conversation with peer agent-browser, browser-use, and combined choices, followed by the installed Skill's environment inspection, upstream version detection, selected Panerelay integration, and doctor without implying that Panerelay setup installs the upstream tool;
4. **Authorize Tab** — the Extension-derived Browser Access card, current-tab/all-tabs buttons, real help and target text, and the Release action after authorization; no target title is visible to the Agent before this state;
5. **Agent Works** — an authorized tab list and observation followed by a control-class action, at which point the engine favicon gains its green dot, the action badge appears, External Control becomes active, and sanitized activity metadata is visible while the task result returns to the Agent;
6. **Release Anytime** — the real Release action clears active control indicators and changes External Control to released while leaving the selected authorization scope and target intact.

The stage uses a light surface where the actual Extension is light, which keeps functional UI readable against the website's dark canvas. Each step highlights one action and one causal state change. Representative Chrome Web Store framing is intentionally not a pixel-for-pixel copy of browser-owned UI that may change independently; Extension-derived states use current repository vocabulary and layout. Assistive technology receives one stable description of the complete journey rather than repeated automatic announcements.

GSAP core is appropriate because the walkthrough coordinates interruptible, replayable stages, direct step selection, and playback lifecycle. The implementation uses one labeled `gsap.timeline()` with shared defaults, transform aliases, and `autoAlpha`; it does not use ScrollTrigger or optional plugins. The automatic desktop pass lasts roughly twelve to sixteen seconds, runs once, and stops on the released state. Hover, focus, manual selection, document hiding, and leaving the viewport pause it; manual selection never silently resumes. Selecting a nonadjacent step seeks directly without flashing through intermediate interfaces. `gsap.matchMedia()` provides separate desktop, narrow-screen, and `prefers-reduced-motion` behavior and reverts on teardown. Narrow screens and reduced-motion visitors use direct manual selection without automatic advancement. Static HTML remains coherent before enhancement and when JavaScript is unavailable.

Alternative considered: CSS keyframes remain preferable for simple decorative loops, but the requested workflow has ordered semantic stages, playback controls, responsive state, and visibility lifecycle. Encoding those relationships through animation delays and duplicated keyframes would be harder to maintain and verify than one explicit timeline.

### Keep JavaScript optional

HTML will contain the complete English content, all six walkthrough interfaces, one stable accessible walkthrough description, both engine panels, the repository Skill installation command, all concise Agent handoff prompts, and usable links. Before enhancement, one coherent walkthrough state remains visible and the complete journey remains available to assistive technology. TypeScript handles language selection, mobile navigation, command and prompt copying, direct walkthrough step selection, the GSAP timeline, the engine tab enhancement, and small view-state enhancements. Inactive walkthrough panels are removed from keyboard navigation and the accessibility tree after enhancement. Copy status uses an `aria-live` region, while automatic walkthrough changes do not repeatedly announce. Navigation, language, playback, step, and engine controls remain keyboard-operable.

Alternative considered: heavier scroll and canvas effects would make a more theatrical page, but increase failure modes, accessibility cost, and bundle size without strengthening the product explanation.

### Keep engine choice local to the automation-tool workflow

The global header remains product navigation. A compact segmented `tablist` inside the Automation tool integrations introduction switches between agent-browser and Browser Use because these are automation-engine choices, not site-wide modes. It sizes to its labels instead of spanning the full workflow card and omits redundant integration-status sublabels. The no-JavaScript baseline renders both panels in document order. Enhancement hides the inactive panel, maintains `aria-selected`, `tabindex`, and `aria-controls`, and supports arrow-key navigation.

The comparison may advance every six seconds only before visitor interaction. Pointer hover or focus pauses the timer; manual selection permanently stops it for that page load; `prefers-reduced-motion: reduce` prevents it from starting. The setup section keeps the repository Skill installation command engine-independent and offers Agent handoff choices for agent-browser, Browser Use, or both. Selecting a handoff changes the visible natural-language prompt and the subordinate manual integration command together, while the Skill installation command remains unchanged and all prompts remain present in source HTML.

Alternative considered: a header-level engine switch would incorrectly imply a global product mode and would compete with language and navigation controls on narrow screens. Permanently animated carousels were rejected because they interrupt reading and conflict with accessible tab behavior.

### Lead installation with the Agent

The website and root READMEs will show two installation steps: install the Extension, then install the repository-level `panerelay-browser` Skill with `npx skills`. That independently managed unified Skill covers agent-browser, Browser Use, and Playwright CLI; it tells the Agent to inspect the environment, install or update the selected upstream tool from its official source only when needed, run setup for the corresponding Panerelay Provider or adapter, run doctor, verify the authorized connection, and preserve explicit tab authorization. The website does not publish a second Agent setup document.

Website and README handoffs stay deliberately short: they identify the chosen scenario and ask the Agent to use the installed `panerelay-browser` Skill. Environment checks, detailed commands, unrelated-configuration boundaries, user-controlled Extension installation and tab-authorization stops, diagnostics, and acceptance criteria live in that Skill rather than being duplicated across presentation copy.

The website presents each setup handoff in one prompt card with a compact copy action vertically centered on the card's right edge. It uses the same icon-and-label interaction as the other copy controls and replaces that content with centered copied feedback without changing the card geometry. The adjacent Browser–Bridge–Agent diagram uses a centered flex group so the three nodes remain balanced within the full visual panel rather than starting at its left edge.

The Automation tool integrations and Agent side-panel workflow cards share one copy-column and visual-column track definition. Their vertical dividers therefore align at wide widths, while the existing responsive breakpoint still stacks each card into one column.

Package READMEs still provide technical CLI reference for explicit Provider and adapter flags in advanced setup. Root quickstarts keep those details out of the primary Extension-plus-Skill path and end with one concrete instruction for asking the Agent to start work. The root READMEs place advanced setup, manual verification, Skill lifecycle commands, and Panerelay installation management together in one default-collapsed section after the architecture overview. They omit separate supported-workflow and documentation sections because the product-path table, top navigation, inline integration links, and package READMEs already cover those destinations. Version copy distinguishes minimum supported versions from the exact verified records. Browser Use text names its Browser Harness-backed CLI and CLI MCP surfaces covered by the unified Skill, and keeps arbitrary Python SDK construction outside the claimed transparent path. The existing `docs/compatibility/` files remain the dense evidence source and are linked rather than duplicated.

### Keep bilingual content in a small local dictionary

Translatable HTML nodes and metadata will use stable keys backed by an English and Simplified Chinese dictionary in the website bundle. The page will use a stored explicit preference first, then choose Simplified Chinese for browser languages beginning with `zh`, and otherwise retain English. The switcher will update the visible copy, accessible labels, `html[lang]`, title, and description in place and store only the selected language in `localStorage`.

English remains the source HTML and complete no-JavaScript fallback. The switcher itself will be progressively enhanced, so a storage failure or disabled JavaScript leaves the page usable. A framework-level i18n library was considered, but two fixed landing-page locales do not justify its dependency, routing, hydration, or extraction machinery.

The Simplified Chinese presentation will be written as native product copy rather than a structural translation of the English sentences. It will also receive a locale-specific typography layer: system UI Chinese fonts for body and functional text, LXGW WenKai with system Kai/serif fallbacks for editorial accents, medium rather than heavy editorial weight, tighter Chinese body rhythm, and container-specific headline scales for the hero, section introductions, workflow cards, setup steps, trust panel, and final call to action. The trust statement uses deliberate phrase breaks so fixed-width Chinese glyphs do not create accidental one-character lines.

Kami's [Simplified Chinese typography page](https://kami.tw93.fun/index-zh.html) demonstrates the useful principle of separating Chinese editorial and functional type roles. Panerelay will adopt that principle, not its exact font asset or document visual system. Kami loads TsangerJinKai02, whose foundry distributes commercial use through a separate [authorization path](https://tsanger.cn/product/32); Panerelay will not redistribute it.

Instead, editorial accents will use [LXGW WenKai](https://github.com/lxgw/LxgwWenKai), an OFL-1.1 typeface, through the author-recognized [ZSFT FontsAPI](https://fonts.zeoseven.com/items/292/). A single allowlisted stylesheet with `font-display: swap` provides character-subset WOFF2 files. Functional text stays on the system UI stack, and system Kai/serif fallbacks preserve the page if the CDN is unavailable.

### Build for the repository Pages subpath

Vite will emit relative asset URLs so the same `dist` works at `https://f-loat.github.io/panerelay/`, in local preview, and in an artifact inspection. The Pages workflow will run on pushes to `main` that affect the website or workflow, and support manual dispatch only when the selected ref is `refs/heads/main`. A job-level guard rejects other manual refs before checkout. It will install with the frozen lockfile, build the website, upload only `apps/website/dist`, and deploy through the official Pages actions with `contents: read`, `pages: write`, and `id-token: write`.

Alternative considered: a `gh-pages` branch would add generated commits and long-lived branch management. GitHub's artifact-based Pages deployment keeps source and generated output separate.

### Validate content and rendered behavior at multiple layers

Node tests will assert essential source and build contracts, including calls to action, compatibility language, bilingual dictionary completeness, preference behavior, and relative output assets. Workspace checks will cover formatting, lint, tests, and build. Browser validation will exercise desktop and 375-pixel layouts, language switching and reload persistence, keyboard focus, copy behavior, console errors, accessibility checks, and the final production URL.

Walkthrough tests will additionally assert the six stage panels and real product vocabulary, direct keyboard-operable step selection, the labeled GSAP timeline, one-pass behavior, pause/restart control, hover/focus/intersection/visibility pausing, reduced-motion and mobile static behavior, absence of ScrollTrigger/plugins, no horizontal overflow, and stable content without JavaScript. Behavioral contracts cover fail-closed target visibility, observation-versus-control presentation, sanitized activity content, and release preserving authorization. Bundle inspection confirms the animation remains local and adds no analytics or remote runtime dependency.

The website will state agent-browser 0.33.0 and Browser Use 0.13.7 with Browser Harness 0.1.8 as pinned evidence baselines. Chrome claims will link to their recorded classifications; Edge will remain `Forwarded`. `Verified`, `Forwarded`, `Partial`, and `Unsupported` keep their meanings from the existing compatibility records and are not redefined by this site.

## Risks / Trade-offs

- [Marketing copy can drift from implementation evidence] → Keep concrete compatibility text narrow, link to the checked-in records, and assert critical boundary language in tests.
- [A single page can become visually long] → Use a strong section rhythm, compact copy, anchored navigation, and responsive spacing rather than adding secondary pages.
- [GitHub Pages is unavailable until repository Pages is enabled] → Configure Pages for workflow builds after the branch is integrated, trigger the workflow, and verify the deployment status and URL through the GitHub API.
- [Static illustrations may imply capabilities too broadly] → Label flows and browser states explicitly and avoid fabricated performance metrics or unsupported integrations.
- [Relative assets can behave differently between root preview and project hosting] → use relative Vite output, inspect the built HTML, and test both local preview and production.
- [English headline sizing can orphan fixed-width Chinese glyphs at intermediate widths] → Give `zh-CN` container-specific type scales and deliberate trust-statement breaks, then verify intentional phrase wrapping at 1024, 375, and wide desktop viewports.
- [Automatic engine rotation can move content while it is being read] → Keep the interval restrained, pause on hover/focus, stop after interaction, and disable it under reduced motion.
- [Peer presentation can overstate Browser Use coverage] → Label it optional, link its exact compatibility record, and keep the CLI/Skill/CLI MCP and Python SDK boundaries in visible copy.
- [An automatic first-screen walkthrough can distract or consume work while hidden] → Run one restrained pass only, provide direct steps and pause/restart controls, expose one stable accessible description, stop automatic motion on mobile and under reduced-motion, and pause when hovered, focused, outside the viewport, or hidden.
- [An animation dependency can outweigh a static project site] → Import GSAP core only, avoid plugins and ScrollTrigger, inspect production output, and keep every narrative state useful before enhancement.

## Migration Plan

1. Add and validate the website workspace application.
2. Add the Pages workflow and merge the change into the default branch.
3. Configure the repository Pages build type to GitHub Actions.
4. Run the deployment workflow and verify the published URL on desktop and mobile.
5. Set the repository homepage URL to the deployed site.

Rollback is to disable Pages or redeploy a prior successful Pages artifact, then revert the website/workflow commit. No product data, protocol state, or installed Extension state requires migration.

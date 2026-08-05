import './styles.css';
import { gsap } from 'gsap';
import { translations, type Locale, type TranslationKey } from './i18n';

document.documentElement.classList.add('js');

const languageLinks = document.querySelectorAll<HTMLAnchorElement>('[data-language-option]');

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'zh-CN';
}

// Each locale has its own statically rendered document, so the served page decides the locale.
function documentLocale(): Locale {
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : 'en';
}

let currentLocale: Locale = documentLocale();

function translation(key: TranslationKey): string {
  return translations[currentLocale][key];
}

function isTranslationKey(value: string | undefined): value is TranslationKey {
  return value !== undefined && Object.hasOwn(translations.en, value);
}

function applyLocale(locale: Locale): void {
  currentLocale = locale;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (isTranslationKey(key)) {
      element.textContent = translation(key);
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    const key = element.dataset.i18nHtml;
    if (isTranslationKey(key)) {
      element.innerHTML = translation(key);
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    const key = element.dataset.i18nAriaLabel;
    if (isTranslationKey(key)) {
      element.setAttribute('aria-label', translation(key));
    }
  }

  for (const element of document.querySelectorAll<HTMLMetaElement>('[data-i18n-content]')) {
    const key = element.dataset.i18nContent;
    if (isTranslationKey(key)) {
      element.content = translation(key);
    }
  }

  for (const link of languageLinks) {
    if (link.dataset.languageOption === locale) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  setMenuOpen(navigation?.dataset.open === 'true');
}

const navigation = document.querySelector<HTMLElement>('[data-navigation]');
const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-button]');
const menuLinks = navigation?.querySelectorAll<HTMLAnchorElement>('a') ?? [];
const menuMedia = window.matchMedia('(min-width: 961px)');

function setMenuOpen(open: boolean): void {
  if (!navigation || !menuButton) {
    return;
  }

  navigation.dataset.open = String(open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', translation(open ? 'nav.close' : 'nav.open'));
}

menuButton?.addEventListener('click', () => {
  setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
});

for (const link of menuLinks) {
  link.addEventListener('click', () => setMenuOpen(false));
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || menuButton?.getAttribute('aria-expanded') !== 'true') {
    return;
  }

  setMenuOpen(false);
  menuButton.focus();
});

menuMedia.addEventListener('change', event => {
  if (event.matches) {
    setMenuOpen(false);
  }
});

type AutomationEngine = 'agent-browser' | 'browser-use' | 'playwright';

const automationEngines: AutomationEngine[] = ['agent-browser', 'browser-use', 'playwright'];

const engineWorkflow = document.querySelector<HTMLElement>('[data-engine-workflow]');
const engineSelectors = document.querySelectorAll<HTMLButtonElement>('[data-engine-select]');
const engineTabs = document.querySelectorAll<HTMLButtonElement>('[data-engine-tab]');
const enginePanels = document.querySelectorAll<HTMLElement>('[data-engine-panel]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const ENGINE_ROTATION_INTERVAL_MS = 6_000;
let activeEngine: AutomationEngine = 'agent-browser';
let engineSelectionIsManual = false;
let engineWorkflowHovered = false;
let engineWorkflowFocused = false;
let engineRotationTimer: number | undefined;

function isAutomationEngine(value: string | undefined): value is AutomationEngine {
  return automationEngines.some(engine => engine === value);
}

function clearEngineRotation(): void {
  if (engineRotationTimer !== undefined) {
    window.clearTimeout(engineRotationTimer);
    engineRotationTimer = undefined;
  }
}

function scheduleEngineRotation(): void {
  clearEngineRotation();
  if (
    !engineWorkflow ||
    engineSelectionIsManual ||
    engineWorkflowHovered ||
    engineWorkflowFocused ||
    reducedMotion.matches
  ) {
    return;
  }
  engineRotationTimer = window.setTimeout(() => {
    const currentIndex = automationEngines.indexOf(activeEngine);
    const nextEngine = automationEngines[(currentIndex + 1) % automationEngines.length];
    setActiveEngine(nextEngine ?? 'agent-browser', false);
    scheduleEngineRotation();
  }, ENGINE_ROTATION_INTERVAL_MS);
}

function setActiveEngine(engine: AutomationEngine, manual: boolean): void {
  activeEngine = engine;
  if (manual) engineSelectionIsManual = true;

  for (const selector of engineSelectors) {
    const selected = selector.dataset.engineSelect === engine;
    selector.dataset.active = String(selected);
    if (selector.getAttribute('role') === 'tab') {
      selector.setAttribute('aria-selected', String(selected));
      selector.tabIndex = selected ? 0 : -1;
    }
  }
  for (const panel of enginePanels) {
    panel.hidden = panel.dataset.enginePanel !== engine;
  }

  if (manual) clearEngineRotation();
}

for (const selector of engineSelectors) {
  selector.addEventListener('click', () => {
    const engine = selector.dataset.engineSelect;
    if (isAutomationEngine(engine)) setActiveEngine(engine, true);
  });
}

for (const tab of engineTabs) {
  tab.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const currentIndex = automationEngines.findIndex(engine => engine === tab.dataset.engineTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? automationEngines.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + automationEngines.length) %
            automationEngines.length;
    const engine = automationEngines[nextIndex] ?? 'agent-browser';
    setActiveEngine(engine, true);
    [...engineTabs].find(candidate => candidate.dataset.engineTab === engine)?.focus();
  });
}

engineWorkflow?.addEventListener('pointerenter', () => {
  engineWorkflowHovered = true;
  clearEngineRotation();
});
engineWorkflow?.addEventListener('pointerleave', () => {
  engineWorkflowHovered = false;
  scheduleEngineRotation();
});
engineWorkflow?.addEventListener('focusin', () => {
  engineWorkflowFocused = true;
  clearEngineRotation();
});
engineWorkflow?.addEventListener('focusout', event => {
  if (engineWorkflow.contains(event.relatedTarget as Node | null)) return;
  engineWorkflowFocused = false;
  scheduleEngineRotation();
});
reducedMotion.addEventListener('change', event => {
  if (event.matches) clearEngineRotation();
  else scheduleEngineRotation();
});

setActiveEngine(activeEngine, false);
scheduleEngineRotation();

type HandoffChoice = AutomationEngine | 'all';

const handoffChoices: HandoffChoice[] = ['agent-browser', 'browser-use', 'playwright', 'all'];
const handoffSelectors = document.querySelectorAll<HTMLButtonElement>('[data-handoff-select]');
const handoffTabs = document.querySelectorAll<HTMLButtonElement>('[data-handoff-tab]');
const handoffPanels = document.querySelectorAll<HTMLElement>('[data-handoff-panel]');
const handoffCommand = document.querySelector<HTMLElement>('[data-handoff-command]');
const handoffCommandCopy = document.querySelector<HTMLButtonElement>('[data-handoff-command-copy]');
const handoffCommands: Record<HandoffChoice, string> = {
  'agent-browser': 'npx --yes @panerelay/setup --agent-browser',
  'browser-use': 'npx --yes @panerelay/setup --browser-use',
  playwright: 'npx --yes @panerelay/setup --playwright',
  all: 'npx --yes @panerelay/setup --agent-browser --browser-use --playwright',
};

function isHandoffChoice(value: string | undefined): value is HandoffChoice {
  return isAutomationEngine(value) || value === 'all';
}

function setActiveHandoff(choice: HandoffChoice): void {
  for (const selector of handoffSelectors) {
    const selected = selector.dataset.handoffSelect === choice;
    selector.dataset.active = String(selected);
    selector.setAttribute('aria-selected', String(selected));
    selector.tabIndex = selected ? 0 : -1;
  }
  for (const panel of handoffPanels) {
    panel.hidden = panel.dataset.handoffPanel !== choice;
  }

  const command = handoffCommands[choice];
  if (handoffCommand) handoffCommand.textContent = command;
  if (handoffCommandCopy) {
    handoffCommandCopy.dataset.copyCommand = command;
    handoffCommandCopy.dataset.copied = 'false';
  }
}

for (const selector of handoffSelectors) {
  selector.addEventListener('click', () => {
    const choice = selector.dataset.handoffSelect;
    if (isHandoffChoice(choice)) setActiveHandoff(choice);
  });
}

for (const tab of handoffTabs) {
  tab.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const currentIndex = handoffChoices.findIndex(choice => choice === tab.dataset.handoffTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? handoffChoices.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + handoffChoices.length) %
            handoffChoices.length;
    const nextChoice = handoffChoices[nextIndex] ?? 'agent-browser';
    setActiveHandoff(nextChoice);
    [...handoffTabs].find(candidate => candidate.dataset.handoffTab === nextChoice)?.focus();
  });
}

setActiveHandoff('agent-browser');

const copyButtons = document.querySelectorAll<HTMLButtonElement>(
  '[data-copy-command], [data-copy-text-key]',
);
const copyStatus = document.querySelector<HTMLElement>('[data-copy-status]');

for (const button of copyButtons) {
  button.addEventListener('click', async () => {
    const textKey = button.dataset.copyTextKey;
    const textToCopy = isTranslationKey(textKey)
      ? translation(textKey)
      : button.dataset.copyCommand;
    if (!textToCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      button.dataset.copiedLabel = translation('command.copied');
      button.dataset.copied = 'true';
      if (copyStatus) {
        const successKey = button.dataset.copySuccessKey;
        copyStatus.textContent = translation(
          isTranslationKey(successKey) ? successKey : 'command.copySuccess',
        );
      }
      window.setTimeout(() => {
        button.dataset.copied = 'false';
      }, 1800);
    } catch {
      if (copyStatus) {
        copyStatus.textContent = translation('command.copyUnavailable');
      }
    }
  });
}

type DemoStage = 'install' | 'local' | 'tool' | 'authorize' | 'work' | 'release';

const productDemo = document.querySelector<HTMLElement>('[data-product-demo]');
const demoStatus = document.querySelector<HTMLElement>('[data-demo-status]');
const demoToggle = document.querySelector<HTMLButtonElement>('[data-demo-toggle]');
const demoToggleLabel = demoToggle?.querySelector<HTMLElement>('[data-demo-toggle-label]');
const demoReplay = document.querySelector<HTMLButtonElement>('[data-demo-replay]');
const demoSteps = document.querySelectorAll<HTMLButtonElement>('[data-demo-step]');
const demoPanels = document.querySelectorAll<HTMLElement>('[data-demo-panel]');
const demoStageOrder: DemoStage[] = ['install', 'local', 'tool', 'authorize', 'work', 'release'];
let productDemoTimeline: gsap.core.Timeline | undefined;
let demoManuallyPaused = false;
let demoPausedForVisibility = false;
let demoPausedForViewport = false;
let demoPausedForHover = false;
let demoPausedForFocus = false;
let demoComplete = false;

function isDemoStage(value: string | undefined): value is DemoStage {
  return demoStageOrder.includes(value as DemoStage);
}

function setDemoAutoplay(active: boolean): void {
  if (productDemo) productDemo.dataset.demoAutoplay = String(active);
}

function addDemoTimelineStage(
  timeline: gsap.core.Timeline,
  stage: DemoStage,
  duration: number,
): void {
  const step = [...demoSteps].find(candidate => candidate.dataset.demoStep === stage);
  timeline.addLabel(stage).call(() => setDemoStage(stage));
  if (!step) {
    timeline.to({}, { duration });
    return;
  }
  timeline.fromTo(
    step,
    { '--demo-step-progress': 0 },
    { '--demo-step-progress': 1, duration, ease: 'none' },
  );
}

function setDemoStage(stage: DemoStage): void {
  if (!productDemo) return;
  productDemo.dataset.demoState = stage;
  for (const step of demoSteps) {
    const selected = step.dataset.demoStep === stage;
    step.dataset.active = String(selected);
    step.setAttribute('aria-selected', String(selected));
    step.tabIndex = selected ? 0 : -1;
  }
  for (const panel of demoPanels) {
    const selected = panel.dataset.demoPanel === stage;
    panel.hidden = !selected;
    panel.inert = !selected;
    panel.setAttribute('aria-hidden', String(!selected));
  }
  if (demoStatus) {
    const statusKey = `demo.status.${stage}` as TranslationKey;
    demoStatus.dataset.i18n = statusKey;
    demoStatus.textContent = translation(statusKey);
  }
}

function setDemoPaused(paused: boolean): void {
  productDemoTimeline?.paused(paused);
  if (!demoToggle || !demoToggleLabel) return;
  const labelKey: TranslationKey = paused ? 'demo.resumeShort' : 'demo.pauseShort';
  const ariaKey: TranslationKey = paused ? 'demo.resume' : 'demo.pause';
  demoToggleLabel.dataset.i18n = labelKey;
  demoToggleLabel.textContent = translation(labelKey);
  demoToggle.dataset.i18nAriaLabel = ariaKey;
  demoToggle.setAttribute('aria-label', translation(ariaKey));
}

function resumeDemoWhenAllowed(): void {
  if (
    !productDemoTimeline ||
    demoComplete ||
    demoManuallyPaused ||
    demoPausedForVisibility ||
    demoPausedForViewport ||
    demoPausedForHover ||
    demoPausedForFocus
  ) {
    return;
  }
  productDemoTimeline.resume();
  setDemoPaused(false);
}

function createProductDemoTimeline(): gsap.core.Timeline {
  setDemoStage('install');
  setDemoAutoplay(true);
  demoComplete = false;

  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: 'none' },
    onComplete: () => {
      demoComplete = true;
      demoToggle?.setAttribute('disabled', '');
    },
  });

  addDemoTimelineStage(timeline, 'install', 2.2);
  addDemoTimelineStage(timeline, 'local', 2.6);
  addDemoTimelineStage(timeline, 'tool', 3);
  addDemoTimelineStage(timeline, 'authorize', 2.5);
  addDemoTimelineStage(timeline, 'work', 3.3);
  addDemoTimelineStage(timeline, 'release', 1.8);

  return timeline;
}

function initializeProductDemo(): void {
  if (!productDemo) return;

  setDemoStage('install');

  for (const step of demoSteps) {
    step.addEventListener('click', () => {
      const stage = step.dataset.demoStep;
      if (!isDemoStage(stage)) return;
      demoManuallyPaused = true;
      setDemoAutoplay(false);
      demoComplete = false;
      demoToggle?.removeAttribute('disabled');
      productDemoTimeline?.pause().seek(stage, true);
      setDemoStage(stage);
      setDemoPaused(true);
    });
    step.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = demoStageOrder.indexOf(step.dataset.demoStep as DemoStage);
      const nextIndex =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? demoStageOrder.length - 1
            : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + demoStageOrder.length) %
              demoStageOrder.length;
      const nextStage = demoStageOrder[nextIndex] ?? 'install';
      const nextStep = [...demoSteps].find(candidate => candidate.dataset.demoStep === nextStage);
      nextStep?.click();
      nextStep?.focus();
    });
  }

  const demoMedia = gsap.matchMedia();
  demoMedia.add(
    {
      autoPlay: '(min-width: 901px) and (prefers-reduced-motion: no-preference)',
      staticMode: '(max-width: 900px), (prefers-reduced-motion: reduce)',
    },
    context => {
      const autoPlay = Boolean(context.conditions?.autoPlay);
      productDemo.dataset.reducedMotion = String(!autoPlay);
      demoManuallyPaused = false;
      demoComplete = false;
      setDemoStage('install');

      if (!autoPlay) {
        setDemoAutoplay(false);
        demoToggle?.setAttribute('disabled', '');
        demoReplay?.setAttribute('disabled', '');
        return;
      }

      demoToggle?.removeAttribute('disabled');
      demoReplay?.removeAttribute('disabled');
      demoPausedForVisibility = document.hidden;
      productDemoTimeline = createProductDemoTimeline();
      resumeDemoWhenAllowed();
      return () => {
        productDemoTimeline?.kill();
        productDemoTimeline = undefined;
      };
    },
  );

  demoToggle?.addEventListener('click', () => {
    if (!productDemoTimeline) return;
    demoManuallyPaused = !productDemoTimeline.paused();
    if (demoManuallyPaused) setDemoPaused(true);
    else {
      setDemoAutoplay(true);
      resumeDemoWhenAllowed();
    }
  });

  demoReplay?.addEventListener('click', () => {
    if (!productDemoTimeline) return;
    demoManuallyPaused = false;
    setDemoAutoplay(true);
    demoComplete = false;
    demoToggle?.removeAttribute('disabled');
    setDemoStage('install');
    productDemoTimeline.restart(true);
    setDemoPaused(false);
  });

  productDemo.addEventListener('pointerenter', () => {
    demoPausedForHover = true;
    productDemoTimeline?.pause();
  });
  productDemo.addEventListener('pointerleave', () => {
    demoPausedForHover = false;
    resumeDemoWhenAllowed();
  });
  productDemo.addEventListener('focusin', () => {
    demoPausedForFocus = true;
    productDemoTimeline?.pause();
  });
  productDemo.addEventListener('focusout', event => {
    if (productDemo.contains(event.relatedTarget as Node | null)) return;
    demoPausedForFocus = false;
    resumeDemoWhenAllowed();
  });

  const demoObserver = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      if (!entry || !productDemoTimeline) return;
      demoPausedForViewport = !entry.isIntersecting;
      if (demoPausedForViewport) productDemoTimeline.pause();
      else resumeDemoWhenAllowed();
    },
    { threshold: 0.08 },
  );
  demoObserver.observe(productDemo);

  document.addEventListener('visibilitychange', () => {
    if (!productDemoTimeline) return;
    demoPausedForVisibility = document.hidden;
    if (document.hidden) productDemoTimeline.pause();
    else resumeDemoWhenAllowed();
  });

  window.addEventListener(
    'pagehide',
    () => {
      demoObserver.disconnect();
      productDemoTimeline?.kill();
      demoMedia.revert();
    },
    { once: true },
  );
}

const year = document.querySelector<HTMLElement>('[data-current-year]');
if (year) {
  year.textContent = String(new Date().getFullYear());
}

applyLocale(documentLocale());
initializeProductDemo();

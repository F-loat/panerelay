import './styles.css';
import { translations, type Locale, type TranslationKey } from './i18n';

document.documentElement.classList.add('js');

const localeStorageKey = 'panerelay.locale';
const languageButtons = document.querySelectorAll<HTMLButtonElement>('[data-language-option]');
let currentLocale: Locale = 'en';

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'zh-CN';
}

function readStoredLocale(): Locale | null {
  try {
    const storedLocale = window.localStorage.getItem(localeStorageKey);
    return isLocale(storedLocale) ? storedLocale : null;
  } catch {
    return null;
  }
}

function detectLocale(): Locale {
  const storedLocale = readStoredLocale();
  if (storedLocale) {
    return storedLocale;
  }

  const preferredLanguage = navigator.languages[0] ?? navigator.language;
  return preferredLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(localeStorageKey, locale);
  } catch {
    // Storage can be unavailable in hardened browser contexts; switching still works in memory.
  }
}

function translation(key: TranslationKey): string {
  return translations[currentLocale][key];
}

function applyLocale(locale: Locale): void {
  currentLocale = locale;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n as TranslationKey | undefined;
    if (key) {
      element.textContent = translation(key);
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    const key = element.dataset.i18nHtml as TranslationKey | undefined;
    if (key) {
      element.innerHTML = translation(key);
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    const key = element.dataset.i18nAriaLabel as TranslationKey | undefined;
    if (key) {
      element.setAttribute('aria-label', translation(key));
    }
  }

  for (const element of document.querySelectorAll<HTMLMetaElement>('[data-i18n-content]')) {
    const key = element.dataset.i18nContent as TranslationKey | undefined;
    if (key) {
      element.content = translation(key);
    }
  }

  for (const button of languageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.languageOption === locale));
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

for (const button of languageButtons) {
  button.addEventListener('click', () => {
    const locale = button.dataset.languageOption ?? null;
    if (!isLocale(locale)) {
      return;
    }

    persistLocale(locale);
    applyLocale(locale);
  });
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

type AutomationEngine = 'agent-browser' | 'browser-use';

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
  return value === 'agent-browser' || value === 'browser-use';
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
    setActiveEngine(activeEngine === 'agent-browser' ? 'browser-use' : 'agent-browser', false);
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
    const engine =
      event.key === 'ArrowRight' || event.key === 'End' ? 'browser-use' : 'agent-browser';
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

type HandoffChoice = AutomationEngine | 'both';

const handoffSelectors = document.querySelectorAll<HTMLButtonElement>('[data-handoff-select]');
const handoffTabs = document.querySelectorAll<HTMLButtonElement>('[data-handoff-tab]');
const handoffPanels = document.querySelectorAll<HTMLElement>('[data-handoff-panel]');

function isHandoffChoice(value: string | undefined): value is HandoffChoice {
  return isAutomationEngine(value) || value === 'both';
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

    const choices: HandoffChoice[] = ['agent-browser', 'browser-use', 'both'];
    const currentIndex = choices.findIndex(choice => choice === tab.dataset.handoffTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) %
            choices.length;
    const nextChoice = choices[nextIndex] ?? 'agent-browser';
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
    const textKey = button.dataset.copyTextKey as TranslationKey | undefined;
    const textToCopy = textKey ? translation(textKey) : button.dataset.copyCommand;
    if (!textToCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      button.dataset.copied = 'true';
      const label = button.querySelector<HTMLElement>('[data-copy-label]');
      if (label) {
        label.textContent = translation('command.copied');
      }
      if (copyStatus) {
        const successKey = (button.dataset.copySuccessKey ??
          'command.copySuccess') as TranslationKey;
        copyStatus.textContent = translation(successKey);
      }
      window.setTimeout(() => {
        button.dataset.copied = 'false';
        if (label) {
          const labelKey = (button.dataset.copyLabelKey ?? 'command.copyShort') as TranslationKey;
          label.textContent = translation(labelKey);
        }
      }, 1800);
    } catch {
      if (copyStatus) {
        copyStatus.textContent = translation('command.copyUnavailable');
      }
    }
  });
}

const year = document.querySelector<HTMLElement>('[data-current-year]');
if (year) {
  year.textContent = String(new Date().getFullYear());
}

applyLocale(detectLocale());

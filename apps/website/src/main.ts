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

const copyButtons = document.querySelectorAll<HTMLButtonElement>('[data-copy-command]');
const copyStatus = document.querySelector<HTMLElement>('[data-copy-status]');

for (const button of copyButtons) {
  button.addEventListener('click', async () => {
    const command = button.dataset.copyCommand;
    if (!command) {
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      button.dataset.copied = 'true';
      const label = button.querySelector<HTMLElement>('[data-copy-label]');
      if (label) {
        label.textContent = translation('command.copied');
      }
      if (copyStatus) {
        copyStatus.textContent = translation('command.copySuccess');
      }
      window.setTimeout(() => {
        button.dataset.copied = 'false';
        if (label) {
          label.textContent = translation('command.copyShort');
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

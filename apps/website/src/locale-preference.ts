type WebsiteLocale = 'en' | 'zh-CN';

const LOCALE_STORAGE_KEY = 'panerelay.website.locale';

function isWebsiteLocale(value: string | null | undefined): value is WebsiteLocale {
  return value === 'en' || value === 'zh-CN';
}

function readLocalePreference(): WebsiteLocale | null {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isWebsiteLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLocalePreference(locale: WebsiteLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The static language links remain functional when storage is unavailable.
  }
}

export function initializeLocalePreference(): void {
  const languageLinks = document.querySelectorAll<HTMLAnchorElement>('[data-language-option]');

  for (const link of languageLinks) {
    const locale = link.dataset.languageOption;
    if (isWebsiteLocale(locale)) {
      link.addEventListener('click', () => writeLocalePreference(locale));
    }
  }

  const documentLocale = document.documentElement.lang;
  const preferredLocale = readLocalePreference();
  if (!isWebsiteLocale(documentLocale) || !preferredLocale || preferredLocale === documentLocale) {
    return;
  }

  const targetLink = [...languageLinks].find(
    link => link.dataset.languageOption === preferredLocale,
  );
  if (!targetLink) {
    return;
  }

  const targetUrl = new URL(targetLink.href, window.location.href);
  targetUrl.search = window.location.search;
  targetUrl.hash = window.location.hash;
  window.location.replace(targetUrl);
}

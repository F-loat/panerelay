import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { parse } from 'node-html-parser';

const websiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const siteOrigin = 'https://f-loat.github.io/panerelay/';

/**
 * Localized homepages are generated from the English source document so every locale ships a
 * crawlable static URL whose initial HTML already carries localized metadata and body content.
 */
export const localePages = [
  {
    locale: 'zh-CN',
    // Open Graph locales use `language_TERRITORY`, unlike the BCP 47 tag used by `lang`/`hreflang`.
    openGraphLocale: 'zh_CN',
    output: 'zh-CN/index.html',
    canonical: `${siteOrigin}zh-CN/`,
    // Assets referenced as `./name` from the root document live one directory up.
    assetPrefix: '../',
    localeHomeHref: './',
    englishHomeHref: '../',
    compareHref: './compare/',
  },
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loadTranslations() {
  const source = await readFile(join(websiteRoot, 'src/i18n.ts'), 'utf8');
  const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'esm' });
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  return module.translations;
}

function localize(root, attribute, catalog, apply) {
  for (const element of root.querySelectorAll(`[${attribute}]`)) {
    const key = element.getAttribute(attribute);
    if (key && Object.hasOwn(catalog, key)) {
      apply(element, catalog[key]);
    }
  }
}

function localizeDocument(html, page, catalog) {
  const root = parse(html, { comment: true });
  const documentElement = root.querySelector('html');
  documentElement.setAttribute('lang', page.locale);
  documentElement.setAttribute('data-locale', page.locale);

  localize(root, 'data-i18n', catalog, (element, value) => element.set_content(escapeHtml(value)));
  localize(root, 'data-i18n-html', catalog, (element, value) => element.set_content(value));
  localize(root, 'data-i18n-aria-label', catalog, (element, value) =>
    element.setAttribute('aria-label', value),
  );
  localize(root, 'data-i18n-content', catalog, (element, value) =>
    element.setAttribute('content', value),
  );

  // Repoint project-relative references at the locale directory depth.
  for (const element of root.querySelectorAll('[href^="./"], [src^="./"]')) {
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute);
      if (value?.startsWith('./')) {
        element.setAttribute(attribute, `${page.assetPrefix}${value.slice(2)}`);
      }
    }
  }

  for (const element of root.querySelectorAll('[data-compare-link]')) {
    element.setAttribute('href', page.compareHref);
  }

  for (const element of root.querySelectorAll('[data-language-option]')) {
    const option = element.getAttribute('data-language-option');
    const active = option === page.locale;
    element.setAttribute('href', active ? page.localeHomeHref : page.englishHomeHref);
    if (active) {
      element.setAttribute('aria-current', 'page');
    } else {
      element.removeAttribute('aria-current');
    }
  }

  root.querySelector('link[rel="canonical"]').setAttribute('href', page.canonical);
  root.querySelector('meta[property="og:url"]').setAttribute('content', page.canonical);
  root.querySelector('meta[property="og:locale"]').setAttribute('content', page.openGraphLocale);

  return `${root.toString()}\n`;
}

export async function generateLocalePages() {
  const translations = await loadTranslations();
  const source = await readFile(join(websiteRoot, 'index.html'), 'utf8');
  const generated = [];

  for (const page of localePages) {
    const outputPath = join(websiteRoot, page.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, localizeDocument(source, page, translations[page.locale]), 'utf8');
    generated.push(outputPath);
  }

  return generated;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateLocalePages();
}

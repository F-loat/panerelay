#!/usr/bin/env node

import {
  PANERELAY_BROWSER_ID_ENV,
  PANERELAY_BROWSER_ENV,
  clearBrowserDefault,
  listBrowserRegistrations,
  readBrowserDefault,
  selectBrowserRegistration,
  setBrowserDefault,
} from '@panerelay/browser-registry';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLocale, resolveLocale, translate, type SupportedLocale } from './i18n.js';

export type CliOperation = 'browsers' | 'browser-use' | 'browser-clear';

export interface ParsedCliArgs {
  browserSelector?: string;
  help: boolean;
  language?: SupportedLocale;
  operation?: CliOperation;
}

interface LanguageArguments {
  argv: string[];
  language?: SupportedLocale;
}

function languageValue(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (argument === '--lang') return argv[index + 1];
    if (argument.startsWith('--lang=')) return argument.slice('--lang='.length);
  }
  return undefined;
}

function extractLanguageArguments(argv: string[]): LanguageArguments {
  const remaining: string[] = [];
  let rawLanguage: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (argument !== '--lang' && !argument.startsWith('--lang=')) {
      remaining.push(argument);
      continue;
    }
    if (rawLanguage !== undefined) throw new Error('LANGUAGE_REPEATED');
    rawLanguage = argument === '--lang' ? argv[index + 1] : argument.slice('--lang='.length);
    if (!rawLanguage || rawLanguage.startsWith('-')) throw new Error('LANGUAGE_MISSING');
    if (argument === '--lang') index += 1;
  }
  if (!rawLanguage) return { argv: remaining };
  const language = normalizeLocale(rawLanguage);
  if (!language) throw new Error(`LANGUAGE_UNSUPPORTED:${rawLanguage}`);
  return { argv: remaining, language };
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const localized = extractLanguageArguments(argv);
  if (
    localized.argv.length === 0 ||
    localized.argv.includes('--help') ||
    localized.argv.includes('-h')
  ) {
    return {
      help: true,
      language: localized.language,
    };
  }

  const command = localized.argv[0]!;
  let browserSelector: string | undefined;
  let operation: CliOperation;
  let optionStart: number;
  if (command === 'browsers') {
    operation = 'browsers';
    optionStart = 1;
  } else if (command === 'browser') {
    const action = localized.argv[1];
    if (action === 'use') {
      browserSelector = localized.argv[2];
      if (!browserSelector || browserSelector.startsWith('-')) {
        throw new Error('BROWSER_SELECTOR_MISSING');
      }
      operation = 'browser-use';
      optionStart = 3;
    } else if (action === 'clear') {
      operation = 'browser-clear';
      optionStart = 2;
    } else {
      throw new Error(`Unknown command: browser${action ? ` ${action}` : ''}`);
    }
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  for (let index = optionStart; index < localized.argv.length; index += 1) {
    throw new Error(`Unknown option: ${localized.argv[index]}`);
  }
  return {
    ...(browserSelector ? { browserSelector } : {}),
    help: false,
    language: localized.language,
    operation,
  };
}

function printHelp(locale: SupportedLocale): void {
  console.log(translate(locale, 'help'));
}

export interface CliDependencies {
  clearBrowserDefault?: typeof clearBrowserDefault;
  environment?: NodeJS.ProcessEnv;
  listBrowserRegistrations?: typeof listBrowserRegistrations;
  readBrowserDefault?: typeof readBrowserDefault;
  selectBrowserRegistration?: typeof selectBrowserRegistration;
  setBrowserDefault?: typeof setBrowserDefault;
  systemLocale?: string;
}

function localizeArgumentError(error: unknown, locale: SupportedLocale): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'LANGUAGE_MISSING') return translate(locale, 'errorLanguageMissing');
  if (message === 'LANGUAGE_REPEATED') return translate(locale, 'errorLanguageRepeated');
  if (message === 'BROWSER_SELECTOR_MISSING') {
    return translate(locale, 'errorBrowserSelectorMissing');
  }
  if (message.startsWith('LANGUAGE_UNSUPPORTED:')) {
    return translate(locale, 'errorLanguageUnsupported', {
      language: message.slice('LANGUAGE_UNSUPPORTED:'.length),
    });
  }
  if (message.startsWith('Unknown command: ')) {
    return translate(locale, 'errorUnknownCommand', {
      command: message.slice('Unknown command: '.length),
    });
  }
  if (message.startsWith('Unknown option: ')) {
    return translate(locale, 'errorUnknownOption', {
      option: message.slice('Unknown option: '.length),
    });
  }
  return message;
}

export async function main(
  argv: string[] = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  let locale = resolveLocale({
    environment: dependencies.environment,
    requestedLocale: languageValue(argv),
    systemLocale: dependencies.systemLocale,
  });
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    console.error(localizeArgumentError(error, locale));
    printHelp(locale);
    return 2;
  }
  locale = parsed.language ?? locale;
  if (parsed.help) {
    printHelp(locale);
    return 0;
  }

  try {
    const registryOptions = { environment: dependencies.environment };
    if (parsed.operation === 'browsers') {
      const registrations = await (
        dependencies.listBrowserRegistrations ?? listBrowserRegistrations
      )(registryOptions);
      const saved = await (dependencies.readBrowserDefault ?? readBrowserDefault)(registryOptions);
      console.log(translate(locale, 'browserListTitle'));
      if (registrations.length === 0) {
        console.log(translate(locale, 'browserListEmpty'));
      } else {
        for (const registration of registrations) {
          const { state } = registration;
          const details = [
            state.browserFamily ?? 'unknown',
            registration.ready
              ? translate(locale, 'browserReady')
              : translate(locale, 'browserUnavailable'),
            ...(saved?.browserId === state.browserId
              ? [translate(locale, 'browserDefaultMarker')]
              : []),
          ];
          console.log(`  ${state.browserName} (${details.join(', ')})`);
          console.log(`    ${state.browserId}`);
        }
      }
      if (
        saved &&
        !registrations.some(registration => registration.state.browserId === saved.browserId)
      ) {
        console.log(translate(locale, 'browserDefaultStale', { id: saved.browserId }));
      }
      return 0;
    }

    if (parsed.operation === 'browser-use') {
      const selection = await (dependencies.selectBrowserRegistration ?? selectBrowserRegistration)(
        {
          ...registryOptions,
          environment: {
            ...(dependencies.environment ?? process.env),
            [PANERELAY_BROWSER_ID_ENV]: undefined,
            [PANERELAY_BROWSER_ENV]: parsed.browserSelector,
          },
        },
      );
      await (dependencies.setBrowserDefault ?? setBrowserDefault)(
        selection.state.browserId,
        registryOptions,
      );
      console.log(
        translate(locale, 'browserDefaultSet', {
          id: selection.state.browserId,
          name: selection.state.browserName,
        }),
      );
      return 0;
    }

    await (dependencies.clearBrowserDefault ?? clearBrowserDefault)(undefined, registryOptions);
    console.log(translate(locale, 'browserDefaultCleared'));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1];
const isMainModule = (() => {
  if (!invokedFile) return false;
  try {
    return realpathSync(resolve(invokedFile)) === realpathSync(currentFile);
  } catch {
    return resolve(invokedFile) === currentFile;
  }
})();
if (isMainModule) {
  process.exitCode = await main();
}

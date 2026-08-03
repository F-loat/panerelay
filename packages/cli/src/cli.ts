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
import { setBrowserUseEnvironmentMode } from '@panerelay/browser-use/environment';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLocale, resolveLocale, translate, type SupportedLocale } from './i18n.js';
import {
  CliAdapterDispatchError,
  resolveCliConnection,
  saveCliConnectionMode,
} from './adapter-dispatcher.js';
import type { CliAdapterMode } from '@panerelay/protocol';
import { runCliConnectionCommand } from './command-runner.js';

export type CliOperation =
  'browsers' | 'browser-use' | 'browser-clear' | 'connection-use' | 'connection-resolve' | 'run';

export interface ParsedCliArgs {
  browserSelector?: string;
  adapterId?: string;
  connectionMode?: CliAdapterMode;
  childCommand?: string[];
  actorName?: string;
  sessionLabel?: string;
  help: boolean;
  language?: SupportedLocale;
  operation?: CliOperation;
}

interface LanguageArguments {
  argv: string[];
  language?: SupportedLocale;
}

function optionAndInlineValue(argument: string): [string, string | undefined] {
  const separator = argument.indexOf('=');
  return separator < 0
    ? [argument, undefined]
    : [argument.slice(0, separator), argument.slice(separator + 1)];
}

function languageValue(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (argument === '--') break;
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
    if (argument === '--') {
      remaining.push(...argv.slice(index));
      break;
    }
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
  const separator = localized.argv.indexOf('--');
  const commandArguments = separator < 0 ? localized.argv : localized.argv.slice(0, separator);
  if (
    localized.argv.length === 0 ||
    commandArguments.includes('--help') ||
    commandArguments.includes('-h')
  ) {
    return {
      help: true,
      language: localized.language,
    };
  }

  const command = localized.argv[0]!;
  let browserSelector: string | undefined;
  let adapterId: string | undefined;
  let connectionMode: CliAdapterMode | undefined;
  let childCommand: string[] | undefined;
  let actorName: string | undefined;
  let sessionLabel: string | undefined;
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
  } else if (command === 'connection') {
    const action = localized.argv[1];
    if (action !== 'use' && action !== 'resolve') {
      throw new Error(`Unknown command: connection${action ? ` ${action}` : ''}`);
    }
    adapterId = localized.argv[2];
    if (!adapterId || adapterId.startsWith('-')) throw new Error('ADAPTER_ID_MISSING');
    if (action === 'use') {
      const rawMode = localized.argv[3];
      if (rawMode !== 'direct' && rawMode !== 'extension') {
        throw new Error('ADAPTER_MODE_INVALID');
      }
      connectionMode = rawMode;
      operation = 'connection-use';
      optionStart = 4;
    } else {
      operation = 'connection-resolve';
      optionStart = 3;
      for (let index = optionStart; index < localized.argv.length; index += 1) {
        const argument = localized.argv[index]!;
        const [option, inlineValue] = optionAndInlineValue(argument);
        if (!['--mode', '--browser', '--actor', '--session-label'].includes(option!)) {
          throw new Error(`Unknown option: ${argument}`);
        }
        const value = inlineValue ?? localized.argv[++index];
        if (!value || value.startsWith('-')) throw new Error(`OPTION_VALUE_MISSING:${option}`);
        if (option === '--mode') {
          if (value !== 'direct' && value !== 'extension') {
            throw new Error('ADAPTER_MODE_INVALID');
          }
          connectionMode = value;
        } else if (option === '--browser') {
          browserSelector = value;
        } else if (option === '--actor') {
          actorName = value;
        } else {
          sessionLabel = value;
        }
      }
      optionStart = localized.argv.length;
    }
  } else if (command === 'run') {
    adapterId = localized.argv[1];
    if (!adapterId || adapterId.startsWith('-')) throw new Error('ADAPTER_ID_MISSING');
    const separator = localized.argv.indexOf('--', 2);
    if (separator < 0 || !localized.argv[separator + 1]) throw new Error('CHILD_COMMAND_MISSING');
    for (let index = 2; index < separator; index += 1) {
      const argument = localized.argv[index]!;
      const [option, inlineValue] = optionAndInlineValue(argument);
      if (!['--mode', '--browser', '--actor', '--session-label'].includes(option!)) {
        throw new Error(`Unknown option: ${argument}`);
      }
      const value = inlineValue ?? localized.argv[++index];
      if (!value || value.startsWith('-') || index >= separator) {
        throw new Error(`OPTION_VALUE_MISSING:${option}`);
      }
      if (option === '--mode') {
        if (value !== 'direct' && value !== 'extension') {
          throw new Error('ADAPTER_MODE_INVALID');
        }
        connectionMode = value;
      } else if (option === '--browser') {
        browserSelector = value;
      } else if (option === '--actor') {
        actorName = value;
      } else {
        sessionLabel = value;
      }
    }
    childCommand = localized.argv.slice(separator + 1);
    operation = 'run';
    optionStart = localized.argv.length;
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  for (let index = optionStart; index < localized.argv.length; index += 1) {
    throw new Error(`Unknown option: ${localized.argv[index]}`);
  }
  return {
    ...(browserSelector ? { browserSelector } : {}),
    ...(adapterId ? { adapterId } : {}),
    ...(connectionMode ? { connectionMode } : {}),
    ...(childCommand ? { childCommand } : {}),
    ...(actorName ? { actorName } : {}),
    ...(sessionLabel ? { sessionLabel } : {}),
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
  resolveCliConnection?: typeof resolveCliConnection;
  saveCliConnectionMode?: typeof saveCliConnectionMode;
  setBrowserUseEnvironmentMode?: typeof setBrowserUseEnvironmentMode;
  runCliConnectionCommand?: typeof runCliConnectionCommand;
  systemLocale?: string;
}

function localizeArgumentError(error: unknown, locale: SupportedLocale): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'LANGUAGE_MISSING') return translate(locale, 'errorLanguageMissing');
  if (message === 'LANGUAGE_REPEATED') return translate(locale, 'errorLanguageRepeated');
  if (message === 'BROWSER_SELECTOR_MISSING') {
    return translate(locale, 'errorBrowserSelectorMissing');
  }
  if (message === 'ADAPTER_ID_MISSING') return translate(locale, 'errorAdapterIdMissing');
  if (message === 'CHILD_COMMAND_MISSING') return translate(locale, 'errorChildCommandMissing');
  if (message === 'ADAPTER_MODE_INVALID') return translate(locale, 'errorAdapterModeInvalid');
  if (message.startsWith('OPTION_VALUE_MISSING:')) {
    return translate(locale, 'errorOptionValueMissing', {
      option: message.slice('OPTION_VALUE_MISSING:'.length),
    });
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

function localizeRuntimeError(error: unknown, locale: SupportedLocale): string {
  if (!(error instanceof CliAdapterDispatchError)) {
    return error instanceof Error ? error.message : String(error);
  }
  if (locale === 'en') return error.message;
  const keys = {
    'adapter-missing': 'errorAdapterMissing',
    'adapter-incompatible': 'errorAdapterIncompatible',
    'adapter-unavailable': 'errorAdapterUnavailable',
    'adapter-timeout': 'errorAdapterTimeout',
    'adapter-invalid-response': 'errorAdapterInvalidResponse',
    'browser-unavailable': 'errorBrowserUnavailable',
    'generation-changed': 'errorGenerationChanged',
    'not-ready': 'errorConnectionNotReady',
    busy: 'errorConnectionBusy',
  } as const;
  return translate(locale, keys[error.code], {
    adapter: /"([^"]+)"/.exec(error.message)?.[1] ?? 'unknown',
  });
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

    if (parsed.operation === 'connection-use') {
      await (dependencies.saveCliConnectionMode ?? saveCliConnectionMode)(
        parsed.adapterId!,
        parsed.connectionMode!,
        {
          adapterPreferences: { environment: dependencies.environment },
          adapterRegistry: { environment: dependencies.environment },
          environment: dependencies.environment,
        },
      );
      if (parsed.adapterId === 'browser-use') {
        await (dependencies.setBrowserUseEnvironmentMode ?? setBrowserUseEnvironmentMode)(
          parsed.connectionMode!,
          { environment: dependencies.environment },
        );
      }
      console.log(
        translate(locale, 'connectionModeSaved', {
          adapter: parsed.adapterId!,
          mode: parsed.connectionMode!,
        }),
      );
      return 0;
    }

    if (parsed.operation === 'connection-resolve') {
      const result = await (dependencies.resolveCliConnection ?? resolveCliConnection)(
        {
          adapterId: parsed.adapterId!,
          actor: {
            name: parsed.actorName ?? parsed.adapterId!,
            ...(parsed.sessionLabel ? { sessionLabel: parsed.sessionLabel } : {}),
          },
          ...(parsed.browserSelector ? { browserSelector: parsed.browserSelector } : {}),
          ...(parsed.connectionMode ? { mode: parsed.connectionMode } : {}),
        },
        {
          adapterPreferences: { environment: dependencies.environment },
          adapterRegistry: { environment: dependencies.environment },
          environment: dependencies.environment,
        },
      );
      console.log(
        JSON.stringify({
          protocol: 'panerelay.connection.v1',
          adapterId: result.adapterId,
          mode: result.mode,
          connection: result.connection,
          ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
          ...(result.concurrencyKey ? { concurrencyKey: result.concurrencyKey } : {}),
          environmentKeys: Object.keys(result.environment).sort(),
        }),
      );
      return 0;
    }

    if (parsed.operation === 'run') {
      return await (dependencies.runCliConnectionCommand ?? runCliConnectionCommand)(
        {
          adapterId: parsed.adapterId!,
          actor: {
            name: parsed.actorName ?? parsed.adapterId!,
            ...(parsed.sessionLabel ? { sessionLabel: parsed.sessionLabel } : {}),
          },
          childCommand: parsed.childCommand!,
          ...(parsed.browserSelector ? { browserSelector: parsed.browserSelector } : {}),
          ...(parsed.connectionMode ? { mode: parsed.connectionMode } : {}),
        },
        {
          adapterPreferences: { environment: dependencies.environment },
          adapterRegistry: { environment: dependencies.environment },
          environment: dependencies.environment,
          concurrencyLock: { environment: dependencies.environment },
        },
      );
    }

    await (dependencies.clearBrowserDefault ?? clearBrowserDefault)(undefined, registryOptions);
    console.log(translate(locale, 'browserDefaultCleared'));
    return 0;
  } catch (error) {
    console.error(localizeRuntimeError(error, locale));
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

import {
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
  type HostToExtensionMessage,
  type IntegrationBrowserDefaultResult,
  type IntegrationBrowserUseDefaultResult,
  type IntegrationDefaultProviderResult,
  type IntegrationRequestMessage,
} from '@panerelay/protocol';
import {
  readCliAdapterMode,
  readCliAdapterRegistration,
  setCliAdapterMode,
  type CliAdapterRegistration,
} from '@panerelay/cli/adapter-config';
import {
  clearBrowserDefault,
  listBrowserRegistrations,
  readBrowserDefault,
  setBrowserDefault,
} from '@panerelay/browser-registry';
import {
  clearPanerelayUserDefaultProvider,
  readUserDefaultProvider,
  setPanerelayUserDefaultProvider,
  type UserDefaultProviderState,
} from './agent-browser-config.js';
import { pickWorkspaceDirectory } from './workspace-directory.js';

export interface IntegrationServiceOptions {
  clearBrowserDefault?: typeof clearBrowserDefault;
  clearDefaultProvider?: typeof clearPanerelayUserDefaultProvider;
  currentBrowser?: () => BridgeState | null;
  listBrowsers?: typeof listBrowserRegistrations;
  readBrowserUseAdapter?: () => Promise<CliAdapterRegistration | null>;
  readBrowserUseMode?: () => Promise<'direct' | 'extension' | null>;
  readBrowserDefault?: typeof readBrowserDefault;
  readDefaultProvider?: typeof readUserDefaultProvider;
  setBrowserDefault?: typeof setBrowserDefault;
  setBrowserUseMode?: (mode: 'direct' | 'extension') => Promise<void>;
  setDefaultProvider?: typeof setPanerelayUserDefaultProvider;
  pickDirectory?: typeof pickWorkspaceDirectory;
}

function browserUseResult(
  registration: CliAdapterRegistration | null,
  mode: 'direct' | 'extension' | null,
): IntegrationBrowserUseDefaultResult {
  const available = Boolean(registration?.modes.includes('extension'));
  const effectiveMode = available ? (mode ?? 'direct') : null;
  return {
    available,
    mode: effectiveMode,
    isPanerelay: effectiveMode === 'extension',
  };
}

function result(state: UserDefaultProviderState): IntegrationDefaultProviderResult {
  return {
    provider: state.provider,
    isPanerelay: state.isPanerelay,
  };
}

function browserResult(
  current: BridgeState | null,
  defaultBrowserId: string | null,
  hasMultipleBrowsers: boolean,
): IntegrationBrowserDefaultResult {
  return {
    currentBrowser: current
      ? {
          browserId: current.browserId,
          browserName: current.browserName,
          ...(current.browserFamily ? { browserFamily: current.browserFamily } : {}),
        }
      : null,
    defaultBrowserId,
    hasMultipleBrowsers,
    isCurrentBrowser: Boolean(current && defaultBrowserId === current.browserId),
  };
}

export class IntegrationService {
  readonly #clearBrowserDefault: typeof clearBrowserDefault;
  readonly #clearDefaultProvider: typeof clearPanerelayUserDefaultProvider;
  readonly #currentBrowser: () => BridgeState | null;
  readonly #listBrowsers: typeof listBrowserRegistrations;
  readonly #readBrowserUseAdapter: () => Promise<CliAdapterRegistration | null>;
  readonly #readBrowserUseMode: () => Promise<'direct' | 'extension' | null>;
  readonly #readBrowserDefault: typeof readBrowserDefault;
  readonly #readDefaultProvider: typeof readUserDefaultProvider;
  readonly #send: (message: HostToExtensionMessage) => void;
  readonly #setBrowserDefault: typeof setBrowserDefault;
  readonly #setBrowserUseMode: (mode: 'direct' | 'extension') => Promise<void>;
  readonly #setDefaultProvider: typeof setPanerelayUserDefaultProvider;
  readonly #pickDirectory: typeof pickWorkspaceDirectory;

  constructor(
    send: (message: HostToExtensionMessage) => void,
    options: IntegrationServiceOptions = {},
  ) {
    this.#send = send;
    this.#clearBrowserDefault = options.clearBrowserDefault ?? clearBrowserDefault;
    this.#clearDefaultProvider = options.clearDefaultProvider ?? clearPanerelayUserDefaultProvider;
    this.#currentBrowser = options.currentBrowser ?? (() => null);
    this.#listBrowsers = options.listBrowsers ?? listBrowserRegistrations;
    this.#readBrowserUseAdapter =
      options.readBrowserUseAdapter ?? (() => readCliAdapterRegistration('browser-use'));
    this.#readBrowserUseMode =
      options.readBrowserUseMode ?? (() => readCliAdapterMode('browser-use'));
    this.#readBrowserDefault = options.readBrowserDefault ?? readBrowserDefault;
    this.#readDefaultProvider = options.readDefaultProvider ?? readUserDefaultProvider;
    this.#setBrowserDefault = options.setBrowserDefault ?? setBrowserDefault;
    this.#setBrowserUseMode =
      options.setBrowserUseMode ?? (mode => setCliAdapterMode('browser-use', mode));
    this.#setDefaultProvider = options.setDefaultProvider ?? setPanerelayUserDefaultProvider;
    this.#pickDirectory = options.pickDirectory ?? pickWorkspaceDirectory;
  }

  async handle(message: IntegrationRequestMessage): Promise<void> {
    try {
      switch (message.request.method) {
        case 'default-provider.get': {
          const state = await this.#readDefaultProvider();
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: result(state),
          });
          break;
        }
        case 'default-provider.set': {
          const state = await this.#setDefaultProvider();
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: result(state),
          });
          break;
        }
        case 'default-provider.clear': {
          const state = await this.#clearDefaultProvider();
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: result(state),
          });
          break;
        }
        case 'browser-use-default.get': {
          const registration = await this.#readBrowserUseAdapter();
          const mode = registration ? await this.#readBrowserUseMode() : null;
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserUseResult(registration, mode),
          });
          break;
        }
        case 'browser-use-default.set':
        case 'browser-use-default.clear': {
          const registration = await this.#readBrowserUseAdapter();
          if (!registration?.modes.includes('extension')) {
            throw new Error('The Panerelay Browser Use integration is not available');
          }
          const mode =
            message.request.method === 'browser-use-default.set' ? 'extension' : 'direct';
          await this.#setBrowserUseMode(mode);
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserUseResult(registration, mode),
          });
          break;
        }
        case 'browser-default.get': {
          const current = this.#currentBrowser();
          const [saved, browsers] = await Promise.all([
            this.#readBrowserDefault(),
            this.#listBrowsers(),
          ]);
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserResult(current, saved?.browserId ?? null, browsers.length > 1),
          });
          break;
        }
        case 'browser-default.set-current': {
          const current = this.#currentBrowser();
          if (!current) throw new Error('The current browser is not registered with Panerelay');
          const [saved, browsers] = await Promise.all([
            this.#setBrowserDefault(current.browserId),
            this.#listBrowsers(),
          ]);
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserResult(current, saved.browserId, browsers.length > 1),
          });
          break;
        }
        case 'browser-default.clear-current': {
          const current = this.#currentBrowser();
          if (!current) throw new Error('The current browser is not registered with Panerelay');
          const [saved, browsers] = await Promise.all([
            this.#clearBrowserDefault(current.browserId),
            this.#listBrowsers(),
          ]);
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserResult(current, saved?.browserId ?? null, browsers.length > 1),
          });
          break;
        }
        case 'workspace.pick-directory':
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: { path: await this.#pickDirectory() },
          });
          break;
      }
    } catch (error) {
      this.#send({
        type: 'integration.response',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

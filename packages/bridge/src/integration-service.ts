import {
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
  type HostToExtensionMessage,
  type IntegrationBrowserDefaultResult,
  type IntegrationDefaultProviderResult,
  type IntegrationRequestMessage,
} from '@panerelay/protocol';
import {
  clearBrowserDefault,
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
  readBrowserDefault?: typeof readBrowserDefault;
  readDefaultProvider?: typeof readUserDefaultProvider;
  setBrowserDefault?: typeof setBrowserDefault;
  setDefaultProvider?: typeof setPanerelayUserDefaultProvider;
  pickDirectory?: typeof pickWorkspaceDirectory;
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
    isCurrentBrowser: Boolean(current && defaultBrowserId === current.browserId),
  };
}

export class IntegrationService {
  readonly #clearBrowserDefault: typeof clearBrowserDefault;
  readonly #clearDefaultProvider: typeof clearPanerelayUserDefaultProvider;
  readonly #currentBrowser: () => BridgeState | null;
  readonly #readBrowserDefault: typeof readBrowserDefault;
  readonly #readDefaultProvider: typeof readUserDefaultProvider;
  readonly #send: (message: HostToExtensionMessage) => void;
  readonly #setBrowserDefault: typeof setBrowserDefault;
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
    this.#readBrowserDefault = options.readBrowserDefault ?? readBrowserDefault;
    this.#readDefaultProvider = options.readDefaultProvider ?? readUserDefaultProvider;
    this.#setBrowserDefault = options.setBrowserDefault ?? setBrowserDefault;
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
        case 'browser-default.get': {
          const current = this.#currentBrowser();
          const saved = await this.#readBrowserDefault();
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserResult(current, saved?.browserId ?? null),
          });
          break;
        }
        case 'browser-default.set-current': {
          const current = this.#currentBrowser();
          if (!current) throw new Error('The current browser is not registered with Panerelay');
          const saved = await this.#setBrowserDefault(current.browserId);
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserResult(current, saved.browserId),
          });
          break;
        }
        case 'browser-default.clear-current': {
          const current = this.#currentBrowser();
          if (!current) throw new Error('The current browser is not registered with Panerelay');
          const saved = await this.#clearBrowserDefault(current.browserId);
          this.#send({
            type: 'integration.response',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            result: browserResult(current, saved?.browserId ?? null),
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

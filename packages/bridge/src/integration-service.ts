import {
  PANERELAY_PROTOCOL_VERSION,
  type HostToExtensionMessage,
  type IntegrationDefaultProviderResult,
  type IntegrationRequestMessage,
} from '@panerelay/protocol';
import {
  clearPanerelayUserDefaultProvider,
  readUserDefaultProvider,
  setPanerelayUserDefaultProvider,
  type UserDefaultProviderState,
} from './agent-browser-config.js';
import { pickWorkspaceDirectory } from './workspace-directory.js';

export interface IntegrationServiceOptions {
  clearDefaultProvider?: typeof clearPanerelayUserDefaultProvider;
  readDefaultProvider?: typeof readUserDefaultProvider;
  setDefaultProvider?: typeof setPanerelayUserDefaultProvider;
  pickDirectory?: typeof pickWorkspaceDirectory;
}

function result(state: UserDefaultProviderState): IntegrationDefaultProviderResult {
  return {
    provider: state.provider,
    isPanerelay: state.isPanerelay,
  };
}

export class IntegrationService {
  readonly #clearDefaultProvider: typeof clearPanerelayUserDefaultProvider;
  readonly #readDefaultProvider: typeof readUserDefaultProvider;
  readonly #send: (message: HostToExtensionMessage) => void;
  readonly #setDefaultProvider: typeof setPanerelayUserDefaultProvider;
  readonly #pickDirectory: typeof pickWorkspaceDirectory;

  constructor(
    send: (message: HostToExtensionMessage) => void,
    options: IntegrationServiceOptions = {},
  ) {
    this.#send = send;
    this.#clearDefaultProvider = options.clearDefaultProvider ?? clearPanerelayUserDefaultProvider;
    this.#readDefaultProvider = options.readDefaultProvider ?? readUserDefaultProvider;
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

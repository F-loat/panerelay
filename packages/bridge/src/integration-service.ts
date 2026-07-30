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

export interface IntegrationServiceOptions {
  clearDefaultProvider?: typeof clearPanerelayUserDefaultProvider;
  readDefaultProvider?: typeof readUserDefaultProvider;
  setDefaultProvider?: typeof setPanerelayUserDefaultProvider;
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

  constructor(
    send: (message: HostToExtensionMessage) => void,
    options: IntegrationServiceOptions = {},
  ) {
    this.#send = send;
    this.#clearDefaultProvider = options.clearDefaultProvider ?? clearPanerelayUserDefaultProvider;
    this.#readDefaultProvider = options.readDefaultProvider ?? readUserDefaultProvider;
    this.#setDefaultProvider = options.setDefaultProvider ?? setPanerelayUserDefaultProvider;
  }

  async handle(message: IntegrationRequestMessage): Promise<void> {
    try {
      let state: UserDefaultProviderState;
      switch (message.request.method) {
        case 'default-provider.get':
          state = await this.#readDefaultProvider();
          break;
        case 'default-provider.set':
          state = await this.#setDefaultProvider();
          break;
        case 'default-provider.clear':
          state = await this.#clearDefaultProvider();
          break;
      }
      this.#send({
        type: 'integration.response',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: true,
        result: result(state),
      });
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

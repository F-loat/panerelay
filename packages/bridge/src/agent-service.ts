import {
  PANERELAY_PROTOCOL_VERSION,
  type AgentRequestMessage,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import { CodexProvider } from './codex-provider.js';

export class AgentService {
  private readonly codex: CodexProvider;

  constructor(private readonly sendToExtension: (message: HostToExtensionMessage) => void) {
    this.codex = new CodexProvider({
      onEvent: event => {
        this.sendToExtension({
          type: 'conversation.event',
          protocol: PANERELAY_PROTOCOL_VERSION,
          event,
        });
      },
    });
  }

  async handle(message: AgentRequestMessage): Promise<void> {
    try {
      const result = await this.codex.handle(message.request);
      this.sendToExtension({
        type: 'agent.response',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: true,
        result,
      });
    } catch (error) {
      this.sendToExtension({
        type: 'agent.response',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async close(): Promise<void> {
    await this.codex.close();
  }
}

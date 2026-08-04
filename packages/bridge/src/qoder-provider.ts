import {
  AcpProcessRuntime,
  AcpProvider,
  type AcpProviderOptions,
  type AcpRuntime,
  type AcpRuntimeHandlers,
} from './acp-provider.js';
import { qoderInstallCommand, resolveQoderExecutable } from './qoder-executable.js';

const QODER_PROFILE = {
  id: 'qoder',
  name: 'Qoder',
  description: 'Local Qoder CLI through capability-negotiated ACP sessions.',
  docsUrl: 'https://docs.qoder.com/en/cli/quick-start',
  installCommand: qoderInstallCommand,
  launchArgs: ['--acp'],
  loginCommand: 'qodercli',
  resolveExecutable: ({ config, environment, platform }) =>
    resolveQoderExecutable({
      configuredPath: config.qoderPath,
      environment,
      platform,
    }),
} satisfies ConstructorParameters<typeof AcpProvider>[0];

export type QoderRuntime = AcpRuntime;
export type QoderProviderOptions = AcpProviderOptions;

export class QoderProcessRuntime extends AcpProcessRuntime {
  constructor(
    executable: string,
    handlers: AcpRuntimeHandlers,
    options: {
      environment?: NodeJS.ProcessEnv;
      platform?: NodeJS.Platform;
      timeoutMs?: number;
    } = {},
  ) {
    super(executable, handlers, {
      ...options,
      label: QODER_PROFILE.name,
      launchArgs: QODER_PROFILE.launchArgs,
    });
  }
}

export class QoderProvider extends AcpProvider {
  constructor(options: QoderProviderOptions = {}) {
    super(QODER_PROFILE, options);
  }
}

import { AcpProvider, type AcpProviderOptions, type AcpRuntime } from '../acp/provider.js';
import { openCodeInstallCommand, resolveOpenCodeExecutable } from './executable.js';

const OPENCODE_PROFILE = {
  id: 'opencode',
  name: 'OpenCode',
  description: 'Local OpenCode CLI through capability-negotiated ACP sessions.',
  docsUrl: 'https://opencode.ai/docs/acp/',
  installCommand: openCodeInstallCommand,
  launchArgs: ['acp'],
  loginCommand: 'opencode auth login',
  resolveExecutable: ({ config, environment, platform }) => {
    const configuredPath =
      environment?.PANERELAY_OPENCODE_PATH ||
      (config.opencodePathSource === 'override' ? config.opencodePath : undefined);
    return resolveOpenCodeExecutable({
      configuredPath,
      environment,
      ...(config.opencodePath && config.opencodePath !== configuredPath
        ? { persistedPath: config.opencodePath }
        : {}),
      platform,
    });
  },
} satisfies ConstructorParameters<typeof AcpProvider>[0];

export type OpenCodeRuntime = AcpRuntime;
export type OpenCodeProviderOptions = AcpProviderOptions;

export class OpenCodeProvider extends AcpProvider {
  constructor(options: OpenCodeProviderOptions = {}) {
    super(OPENCODE_PROFILE, options);
  }
}

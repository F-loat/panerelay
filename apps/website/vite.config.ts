import { readFile } from 'node:fs/promises';

import { defineConfig, type Plugin } from 'vite';

const agentSetupGuideUrl = new URL('../../docs/agent-setup.md', import.meta.url);

function agentSetupGuide(): Plugin {
  return {
    name: 'panerelay-agent-setup-guide',
    async buildStart() {
      this.emitFile({
        type: 'asset',
        fileName: 'agent-setup.md',
        source: await readFile(agentSetupGuideUrl, 'utf8'),
      });
    },
    configureServer(server) {
      server.middlewares.use('/agent-setup.md', async (_request, response, next) => {
        try {
          response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
          response.end(await readFile(agentSetupGuideUrl, 'utf8'));
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [agentSetupGuide()],
  build: {
    target: 'es2022',
  },
});

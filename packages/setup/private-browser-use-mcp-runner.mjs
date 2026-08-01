import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';

const browserUseExecutable = process.argv[2];
if (!browserUseExecutable || !isAbsolute(browserUseExecutable)) {
  console.error('Panerelay Browser Use MCP executable is invalid');
  process.exitCode = 1;
} else {
  const warmup = spawn(browserUseExecutable, [], {
    env: process.env,
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  });
  const warmupResult = await new Promise(resolve => {
    let settled = false;
    const finish = code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code);
    };
    const timer = setTimeout(() => {
      warmup.kill('SIGKILL');
      finish(1);
    }, 15_000);
    warmup.once('error', () => finish(1));
    warmup.once('close', code => finish(code ?? 1));
    warmup.stdin.on('error', () => undefined);
    warmup.stdin.end('print(daemon_alive())\n');
  });

  if (warmupResult !== 0) {
    console.error('Panerelay Browser Use MCP daemon warm-up failed');
    process.exitCode = 1;
  } else {
    const server = spawn(browserUseExecutable, ['--cli-mcp'], {
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const handlers = new Map();
    for (const signal of signals) {
      const handler = () => server.kill(signal);
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    process.exitCode = await new Promise(resolve => {
      server.once('error', () => resolve(1));
      server.once('close', (code, signal) => {
        if (signal) resolve(1);
        else resolve(code ?? 1);
      });
    });
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

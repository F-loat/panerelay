#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cpus, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '../..');
const panerelayCli = resolve(repositoryRoot, 'packages/cli/dist/cli.js');
const session = `panerelay-fetch-benchmark-${process.pid}`;
const marker = 'panerelay-opencli-loopback-v1';
const payload = 'x'.repeat(1024);

function integerOption(name, fallback, minimum = 1) {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find(argument => argument.startsWith(prefix));
  const index = process.argv.indexOf(`--${name}`);
  const raw = inline?.slice(prefix.length) ?? (index >= 0 ? process.argv[index + 1] : undefined);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`--${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

const warmupCount = integerOption('warmup', 5, 0);
const sequentialCount = integerOption('sequential', 30);
const concurrency = integerOption('concurrency', 8);
const batchCount = integerOption('batches', 10);
const commandTimeoutMs = integerOption('timeout', 30_000, 100);

function runCommand(command, args, options = {}) {
  return new Promise(resolveResult => {
    const startedAt = performance.now();
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        ...options.env,
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const outputLimit = 1024 * 1024;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, commandTimeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (stdout.length < outputLimit) stdout += chunk.slice(0, outputLimit - stdout.length);
    });
    child.stderr.on('data', chunk => {
      if (stderr.length < outputLimit) stderr += chunk.slice(0, outputLimit - stderr.length);
    });
    child.on('error', error => {
      clearTimeout(timer);
      resolveResult({
        code: null,
        durationMs: performance.now() - startedAt,
        error: error.message,
        stderr,
        stdout,
        timedOut,
      });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolveResult({
        code,
        durationMs: performance.now() - startedAt,
        stderr,
        stdout,
        timedOut,
      });
    });
  });
}

function commandFailure(label, result) {
  const detail = (result.stderr || result.stdout || result.error || 'unknown error').trim();
  return new Error(`${label} failed (${result.code ?? 'no exit code'}): ${detail}`);
}

function parseJson(label, result) {
  if (result.code !== 0 || result.timedOut) throw commandFailure(label, result);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned non-JSON output: ${result.stdout.trim()}`);
  }
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(quantile * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function rounded(value) {
  return value === null ? null : Number(value.toFixed(1));
}

function summarizeSamples(samples) {
  const successful = samples.filter(sample => sample.ok);
  const durations = successful.map(sample => sample.durationMs);
  return {
    attempts: samples.length,
    successes: successful.length,
    failures: samples.length - successful.length,
    medianMs: rounded(percentile(durations, 0.5)),
    p95Ms: rounded(percentile(durations, 0.95)),
    minMs: rounded(durations.length ? Math.min(...durations) : null),
    maxMs: rounded(durations.length ? Math.max(...durations) : null),
  };
}

function summarizeBatches(batches) {
  const durations = batches.map(batch => batch.durationMs);
  return {
    batches: batches.length,
    requestsPerBatch: concurrency,
    attempts: batches.reduce((sum, batch) => sum + batch.attempts, 0),
    successes: batches.reduce((sum, batch) => sum + batch.successes, 0),
    failures: batches.reduce((sum, batch) => sum + batch.failures, 0),
    medianBatchMs: rounded(percentile(durations, 0.5)),
    p95BatchMs: rounded(percentile(durations, 0.95)),
    medianThroughputPerSecond: rounded(
      percentile(
        batches.map(batch => (batch.successes * 1000) / batch.durationMs),
        0.5,
      ),
    ),
  };
}

function startFixture() {
  const server = createServer((request, response) => {
    response.setHeader('cache-control', 'no-store');
    if (request.url === '/setup') {
      response.setHeader(
        'set-cookie',
        'panerelay_benchmark=synthetic-session; Path=/; HttpOnly; SameSite=Strict',
      );
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end('<!doctype html><title>Panerelay Fetch benchmark</title><p>Ready</p>');
      return;
    }
    if (request.url === '/api/data') {
      const authenticated = request.headers.cookie
        ?.split(';')
        .map(value => value.trim())
        .includes('panerelay_benchmark=synthetic-session');
      response.statusCode = authenticated ? 200 : 401;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify(
          authenticated ? { marker, payload } : { error: 'synthetic browser cookie required' },
        ),
      );
      return;
    }
    response.statusCode = 404;
    response.end('Not found');
  });
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve loopback benchmark address'));
        return;
      }
      resolveServer({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(resolveClose => server.close(resolveClose)),
      });
    });
  });
}

async function panerelaySample(apiUrl) {
  const result = await runCommand(process.execPath, [
    panerelayCli,
    '--lang',
    'en',
    'fetch',
    apiUrl,
    '--response',
    'json',
    '--timeout',
    String(commandTimeoutMs),
  ]);
  try {
    const output = parseJson('Panerelay Fetch', result);
    const ok =
      output.status === 200 &&
      output.attachedCookieCount >= 1 &&
      output.body?.marker === marker &&
      output.body?.payload?.length === payload.length;
    return { durationMs: result.durationMs, ok, error: ok ? undefined : 'unexpected response' };
  } catch (error) {
    return {
      durationMs: result.durationMs,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function opencliSample(apiUrl) {
  const expression = `(async()=>{const r=await fetch(${JSON.stringify(apiUrl)},{credentials:'include',cache:'no-store'});const b=await r.json();return {status:r.status,marker:b.marker,payloadLength:b.payload?.length??0}})()`;
  const result = await runCommand('opencli', ['browser', session, 'eval', expression]);
  try {
    const output = parseJson('OpenCLI browser eval', result);
    const ok =
      output.status === 200 && output.marker === marker && output.payloadLength === payload.length;
    return { durationMs: result.durationMs, ok, error: ok ? undefined : 'unexpected response' };
  } catch (error) {
    return {
      durationMs: result.durationMs,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runSequential(apiUrl) {
  const results = { panerelay: [], opencli: [] };
  for (let index = 0; index < sequentialCount; index += 1) {
    const order = index % 2 === 0 ? ['panerelay', 'opencli'] : ['opencli', 'panerelay'];
    for (const implementation of order) {
      results[implementation].push(
        implementation === 'panerelay'
          ? await panerelaySample(apiUrl)
          : await opencliSample(apiUrl),
      );
    }
  }
  return results;
}

async function runBatch(implementation, apiUrl) {
  const startedAt = performance.now();
  const samples = await Promise.all(
    Array.from({ length: concurrency }, () =>
      implementation === 'panerelay' ? panerelaySample(apiUrl) : opencliSample(apiUrl),
    ),
  );
  return {
    attempts: samples.length,
    successes: samples.filter(sample => sample.ok).length,
    failures: samples.filter(sample => !sample.ok).length,
    durationMs: performance.now() - startedAt,
    errors: samples.filter(sample => !sample.ok).map(sample => sample.error),
  };
}

async function runConcurrent(apiUrl) {
  const results = { panerelay: [], opencli: [] };
  for (let index = 0; index < batchCount; index += 1) {
    const order = index % 2 === 0 ? ['panerelay', 'opencli'] : ['opencli', 'panerelay'];
    for (const implementation of order) {
      results[implementation].push(await runBatch(implementation, apiUrl));
    }
  }
  return results;
}

async function version(command, args) {
  const result = await runCommand(command, args);
  if (result.code !== 0) return null;
  return result.stdout.trim().split('\n')[0] || null;
}

async function main() {
  const fixture = await startFixture();
  const setupUrl = `${fixture.baseUrl}/setup`;
  const apiUrl = `${fixture.baseUrl}/api/data`;
  let failure;
  try {
    const openResult = await runCommand('opencli', ['browser', session, 'open', setupUrl]);
    if (openResult.code !== 0) throw commandFailure('OpenCLI browser setup', openResult);

    const probes = await Promise.all([panerelaySample(apiUrl), opencliSample(apiUrl)]);
    if (!probes[0].ok || !probes[1].ok) {
      throw new Error(
        `Benchmark readiness check failed. Panerelay: ${probes[0].error ?? 'ok'}; OpenCLI: ${probes[1].error ?? 'ok'}`,
      );
    }

    for (let index = 0; index < warmupCount; index += 1) {
      await panerelaySample(apiUrl);
      await opencliSample(apiUrl);
    }

    const sequential = await runSequential(apiUrl);
    const concurrent = await runConcurrent(apiUrl);
    const failedErrors = [
      ...sequential.panerelay.filter(sample => !sample.ok).map(sample => sample.error),
      ...sequential.opencli.filter(sample => !sample.ok).map(sample => sample.error),
      ...concurrent.panerelay.flatMap(batch => batch.errors),
      ...concurrent.opencli.flatMap(batch => batch.errors),
    ].filter(Boolean);

    console.log(
      JSON.stringify(
        {
          protocol: marker,
          timestamp: new Date().toISOString(),
          environment: {
            node: process.version,
            os: `${platform()} ${release()}`,
            cpu: cpus()[0]?.model ?? 'unknown',
            logicalCpus: cpus().length,
            memoryGiB: Number((totalmem() / 1024 ** 3).toFixed(1)),
            panerelayCli: await version(process.execPath, [panerelayCli, '--version']),
            opencli: await version('opencli', ['--version']),
          },
          configuration: {
            authentication: 'synthetic HttpOnly loopback cookie',
            responsePayloadBytes: Buffer.byteLength(payload),
            warmupCount,
            sequentialCount,
            concurrency,
            batchCount,
            timeoutMs: commandTimeoutMs,
            opencliPreparedPage: true,
          },
          sequential: {
            panerelay: summarizeSamples(sequential.panerelay),
            opencli: summarizeSamples(sequential.opencli),
          },
          concurrent: {
            panerelay: summarizeBatches(concurrent.panerelay),
            opencli: summarizeBatches(concurrent.opencli),
          },
          failureExamples: [...new Set(failedErrors)].slice(0, 3),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    failure = error;
  } finally {
    await runCommand('opencli', ['browser', session, 'close']).catch(() => undefined);
    await fixture.close();
  }
  if (failure) throw failure;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_FETCH_ADAPTER_PROTOCOL,
  isFetchAdapterInvocationRequest,
  serializeFetchAdapterMessage,
  type FetchAdapterInvocationRequest,
  type FetchAdapterInvocationResponse,
} from '@panerelay/protocol';
import {
  BILIBILI_COMMAND_NAMES,
  executeBilibiliCommand,
  signWbiQuery,
  type BilibiliAdapterDependencies,
} from './commands/index.js';

const MAX_INPUT_BYTES = 1024 * 1024;

export {
  BILIBILI_COMMAND_NAMES,
  executeBilibiliCommand,
  signWbiQuery,
  type BilibiliAdapterDependencies,
};

async function readInvocation(): Promise<FetchAdapterInvocationRequest> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_INPUT_BYTES) {
      throw new Error('Bilibili adapter input exceeded the protocol limit');
    }
    chunks.push(bytes);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('Bilibili adapter input is not valid JSON');
  }
  if (!isFetchAdapterInvocationRequest(value)) throw new Error('Bilibili adapter input is invalid');
  return value;
}

async function run(): Promise<void> {
  let requestId: string = randomUUID();
  let response: FetchAdapterInvocationResponse;
  try {
    const invocation = await readInvocation();
    requestId = invocation.requestId;
    response = {
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId,
      operation: 'execute',
      success: true,
      result: await executeBilibiliCommand(invocation),
    };
  } catch (error) {
    response = {
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId,
      operation: 'execute',
      success: false,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 4_096),
    };
  }
  process.stdout.write(serializeFetchAdapterMessage(response));
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1];
const isMainModule = (() => {
  if (!invokedFile) return false;
  try {
    return realpathSync(resolve(invokedFile)) === realpathSync(currentFile);
  } catch {
    return resolve(invokedFile) === currentFile;
  }
})();

if (isMainModule) await run();

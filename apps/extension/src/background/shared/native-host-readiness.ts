import type { NativeHostState } from '../../shared/messages.js';

const MISSING_NATIVE_HOST_PATTERNS = [
  /specified native messaging host not found/i,
  /native messaging host .+ not found/i,
  /no such native application/i,
];

export function nativeHostDisconnectState(message: string): NativeHostState {
  return MISSING_NATIVE_HOST_PATTERNS.some(pattern => pattern.test(message))
    ? 'missing'
    : 'disconnected';
}

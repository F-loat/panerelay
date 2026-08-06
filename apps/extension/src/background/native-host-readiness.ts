import type { HostReleaseStatus, NativeHostState } from '../shared/messages.js';

const MISSING_NATIVE_HOST_PATTERNS = [
  /specified native messaging host not found/i,
  /native messaging host .+ not found/i,
];

export function nativeHostDisconnectState(message: string): NativeHostState {
  return MISSING_NATIVE_HOST_PATTERNS.some(pattern => pattern.test(message))
    ? 'missing'
    : 'disconnected';
}

export function nativeHostBridgeReady(
  transport: NativeHostState,
  browserRegistered: boolean,
): boolean {
  return transport === 'connected' && browserRegistered;
}

export function hostReleaseAfterDisconnect(current: HostReleaseStatus): HostReleaseStatus {
  return current.state === 'restart-pending'
    ? current
    : { state: 'checking', retryAvailable: false };
}

export function nativeHostDisconnectPreservesAuthorization(current: HostReleaseStatus): boolean {
  return current.state === 'restart-pending';
}

export function hostReleaseAfterRegistration(
  hostVersion: string,
  extensionVersion: string,
): HostReleaseStatus {
  return {
    state: 'ready',
    hostVersion,
    targetVersion: extensionVersion,
    retryAvailable: false,
  };
}

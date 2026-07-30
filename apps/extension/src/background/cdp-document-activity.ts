import { classifyCdpTargetAccess } from '@panerelay/protocol';

export function cdpCommandTouchesDocument(method: string): boolean {
  return classifyCdpTargetAccess(method) === 'control';
}

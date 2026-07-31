export function debuggerDetachReason(reason: 'target_closed' | 'canceled_by_user'): string | null {
  if (reason === 'target_closed') return null;
  return `Chrome debugger detached: ${reason}`;
}

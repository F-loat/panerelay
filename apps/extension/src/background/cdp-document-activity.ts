const DOCUMENT_NEUTRAL_CDP_METHODS = new Set(['Runtime.runIfWaitingForDebugger']);

export function cdpCommandTouchesDocument(method: string): boolean {
  return !method.startsWith('Target.') && !DOCUMENT_NEUTRAL_CDP_METHODS.has(method);
}

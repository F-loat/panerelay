import type { CdpTargetInfo } from '@panerelay/protocol';

export class TargetExposureState {
  private readonly tabIds = new Set<number>();
  private seeded = false;

  seedEligible(tabIds: Iterable<number>): void {
    if (this.seeded) return;
    this.seeded = true;
    for (const tabId of tabIds) this.tabIds.add(tabId);
  }

  expose(tabId: number): void {
    this.tabIds.add(tabId);
  }

  exposeRelated(sourceTabId: number, tabId: number, sourceControlled: boolean): boolean {
    if (!sourceControlled || !this.tabIds.has(sourceTabId)) return false;
    this.tabIds.add(tabId);
    return true;
  }

  has(tabId: number): boolean {
    return this.tabIds.has(tabId);
  }

  remove(tabId: number): void {
    this.tabIds.delete(tabId);
  }

  clear(): void {
    this.seeded = false;
    this.tabIds.clear();
  }
}

export class TargetPublicationQueue {
  private readonly tails = new Map<number, Promise<void>>();

  enqueue(tabId: number, operation: () => Promise<void>): Promise<void> {
    const previous = this.tails.get(tabId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.tails.set(tabId, current);
    return current.then(
      () => this.clearIfCurrent(tabId, current),
      error => {
        this.clearIfCurrent(tabId, current);
        throw error;
      },
    );
  }

  private clearIfCurrent(tabId: number, operation: Promise<void>): void {
    if (this.tails.get(tabId) === operation) this.tails.delete(tabId);
  }
}

export function targetInfoEquals(left: CdpTargetInfo, right: CdpTargetInfo): boolean {
  return (
    left.targetId === right.targetId &&
    left.type === right.type &&
    left.title === right.title &&
    left.url === right.url &&
    left.attached === right.attached &&
    left.active === right.active
  );
}

interface PendingRequest<TResult> {
  reject: (reason?: unknown) => void;
  resolve: (result: TResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface PendingRequestTrackerOptions {
  cancelTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  createRequestId?: () => string;
  scheduleTimer?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  timeoutMessage?: (label: string) => string;
}

export class PendingRequestTracker<TResult> {
  private readonly pending = new Map<string, PendingRequest<TResult>>();
  private readonly cancelTimer: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly createRequestId: () => string;
  private readonly scheduleTimer: (
    callback: () => void,
    timeoutMs: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly timeoutMessage: (label: string) => string;

  constructor(
    private readonly timeoutMs: number,
    options: PendingRequestTrackerOptions = {},
  ) {
    this.cancelTimer = options.cancelTimer ?? clearTimeout;
    this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
    this.scheduleTimer = options.scheduleTimer ?? setTimeout;
    this.timeoutMessage = options.timeoutMessage ?? (label => `Timed out waiting for ${label}`);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  request(label: string, dispatch: (requestId: string) => void): Promise<TResult> {
    const requestId = this.createRequestId();
    return new Promise<TResult>((resolve, reject) => {
      const timer = this.scheduleTimer(() => {
        if (!this.take(requestId)) return;
        reject(new Error(this.timeoutMessage(label)));
      }, this.timeoutMs);
      this.pending.set(requestId, { reject, resolve, timer });
      try {
        dispatch(requestId);
      } catch (error) {
        this.reject(requestId, error);
      }
    });
  }

  resolve(requestId: string, result: TResult): boolean {
    const pending = this.take(requestId);
    if (!pending) return false;
    pending.resolve(result);
    return true;
  }

  reject(requestId: string, reason: unknown): boolean {
    const pending = this.take(requestId);
    if (!pending) return false;
    pending.reject(reason);
    return true;
  }

  rejectAll(reason: string): void {
    for (const requestId of [...this.pending.keys()]) {
      this.reject(requestId, new Error(reason));
    }
  }

  private take(requestId: string): PendingRequest<TResult> | undefined {
    const pending = this.pending.get(requestId);
    if (!pending) return undefined;
    this.pending.delete(requestId);
    this.cancelTimer(pending.timer);
    return pending;
  }
}

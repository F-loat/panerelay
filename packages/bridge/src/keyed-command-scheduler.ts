interface CommandWaiter<TOwner> {
  owner: TOwner;
  reject: (error: Error) => void;
  resolve: (release: () => void) => void;
}

interface CommandQueue<TOwner> {
  owner: TOwner;
  waiters: CommandWaiter<TOwner>[];
}

export interface KeyedCommandSchedulerOptions<TOwner> {
  inactiveOwnerError: () => Error;
  isOwnerActive: (owner: TOwner) => boolean;
}

export class KeyedCommandScheduler<TKey, TOwner> {
  private readonly queues = new Map<TKey, CommandQueue<TOwner>>();

  constructor(private readonly options: KeyedCommandSchedulerOptions<TOwner>) {}

  acquire(key: TKey, owner: TOwner): Promise<() => void> {
    const existing = this.queues.get(key);
    if (!existing) {
      this.queues.set(key, { owner, waiters: [] });
      return Promise.resolve(this.releaseFor(key, owner));
    }
    return new Promise<() => void>((resolve, reject) => {
      existing.waiters.push({ owner, reject, resolve });
    });
  }

  async run<TResult>(
    key: TKey,
    owner: TOwner,
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const release = await this.acquire(key, owner);
    try {
      if (!this.options.isOwnerActive(owner)) throw this.options.inactiveOwnerError();
      return await operation();
    } finally {
      release();
    }
  }

  cancel(owner: TOwner, error = this.options.inactiveOwnerError()): void {
    for (const queue of this.queues.values()) {
      const retained: CommandWaiter<TOwner>[] = [];
      for (const waiter of queue.waiters) {
        if (waiter.owner === owner) waiter.reject(error);
        else retained.push(waiter);
      }
      queue.waiters = retained;
    }
  }

  clear(error: Error): void {
    for (const queue of this.queues.values()) {
      for (const waiter of queue.waiters) waiter.reject(error);
    }
    this.queues.clear();
  }

  private releaseFor(key: TKey, owner: TOwner): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const queue = this.queues.get(key);
      if (!queue || queue.owner !== owner) return;
      let next = queue.waiters.shift();
      while (next && !this.options.isOwnerActive(next.owner)) {
        next.reject(this.options.inactiveOwnerError());
        next = queue.waiters.shift();
      }
      if (!next) {
        this.queues.delete(key);
        return;
      }
      queue.owner = next.owner;
      next.resolve(this.releaseFor(key, next.owner));
    };
  }
}

/** Limits retained serialized payload, not the Node heap or active callers' objects. */
export class ByteLru<T> {
  private entries = new Map<string, {value: T; bytes: number}>();
  private bytes = 0;
  private evictions = 0;
  constructor(readonly maxEntries: number, readonly maxBytes: number) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new Error("Invalid cache budget");
    }
  }
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T, bytes: number): void {
    this.delete(key);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Invalid cache weight");
    if (bytes > this.maxBytes) return;
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      this.delete(this.entries.keys().next().value!);
      this.evictions++;
    }
    this.entries.set(key, {value, bytes});
    this.bytes += bytes;
  }
  delete(key: string): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
  clear(): void { this.entries.clear(); this.bytes = 0; this.evictions = 0; }
  stats() { return {entries: this.entries.size, bytes: this.bytes, evictions: this.evictions, maxEntries: this.maxEntries, maxBytes: this.maxBytes}; }
}

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value, (_key, item) => item instanceof Map ? [...item.entries()] : item) ?? "null");
}

export class HistoryCapacityError extends Error {
  constructor() { super("Historical computation queue is full"); this.name = "HistoryCapacityError"; }
}

/** Single flight, bounded retained results, bounded active builds and wait queue. */
export class BoundedAsyncCache<T> {
  private values: ByteLru<{value: T}>;
  private pending = new Map<string, Promise<T>>();
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(maxEntries: number, maxBytes: number, readonly maxActive = 2, readonly maxQueued = 32) {
    this.values = new ByteLru(maxEntries, maxBytes);
    if (maxActive < 1 || maxQueued < 0) throw new Error("Invalid cache concurrency");
  }
  get(key: string, build: () => Promise<T>): Promise<T> {
    const hit = this.values.get(key);
    if (hit) return Promise.resolve(hit.value);
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.active >= this.maxActive && this.queue.length >= this.maxQueued) {
      return Promise.reject(new HistoryCapacityError());
    }
    const slot = this.active < this.maxActive
      ? (this.active++, Promise.resolve())
      : new Promise<void>(resolve => this.queue.push(resolve));
    const promise = slot.then(build).then(value => {
      this.values.set(key, {value}, jsonBytes(value));
      return value;
    }).finally(() => {
      this.pending.delete(key);
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    });
    this.pending.set(key, promise);
    return promise;
  }
  stats() { return {...this.values.stats(), active: this.active, queued: this.queue.length, pending: this.pending.size}; }
}

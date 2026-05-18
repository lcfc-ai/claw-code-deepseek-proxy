export class ReasoningCache {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): string | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: string): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  sweep(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
}

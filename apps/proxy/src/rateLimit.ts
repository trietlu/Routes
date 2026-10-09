import { type Clock, TtlLruCache } from './cache';

const HOUR_MS = 60 * 60 * 1000;

/** Devices tracked at once; the least recently seen is forgotten first. */
const MAX_DEVICES = 50_000;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export type TakeResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Per-device token bucket: `perHour` tokens that refill continuously over a
 * rolling hour. In memory, per instance (NFR-9).
 */
export class DeviceRateLimiter {
  private readonly buckets: TtlLruCache<Bucket>;
  private readonly refillPerMs: number;

  constructor(
    private readonly perHour: number,
    private readonly now: Clock,
  ) {
    this.refillPerMs = perHour / HOUR_MS;
    // An idle bucket is full again after an hour, so it can be dropped then.
    this.buckets = new TtlLruCache(MAX_DEVICES, HOUR_MS, now);
  }

  take(deviceId: string): TakeResult {
    const now = this.now();
    const bucket = this.buckets.get(deviceId) ?? { tokens: this.perHour, updatedAt: now };
    const tokens = Math.min(
      this.perHour,
      bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs,
    );
    // The epsilon absorbs float drift from fractional refills.
    if (tokens < 1 - 1e-9) {
      this.buckets.set(deviceId, { tokens, updatedAt: now });
      return {
        ok: false,
        // Whole milliseconds first, so float noise cannot add a second.
        retryAfterSec: Math.max(1, Math.ceil(Math.round((1 - tokens) / this.refillPerMs) / 1000)),
      };
    }
    this.buckets.set(deviceId, { tokens: Math.max(0, tokens - 1), updatedAt: now });
    return { ok: true };
  }
}

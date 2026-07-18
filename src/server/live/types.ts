import type { MarketSynchronization, MarketTransport, Venue } from '@shared/contracts.js';
import type { CanonicalBook } from '@server/domain/types.js';

export type LiveBookKey = {
  venue: Venue;
  marketSegment: string;
  venueSymbol: string;
};

export type LiveBookHealth = 'LIVE' | 'STALE' | 'UNSYNCED' | 'UNAVAILABLE';

export type LiveBookRecord = Readonly<{
  key: LiveBookKey;
  revision: number;
  connectionEpoch: number;
  transport: MarketTransport;
  synchronization: MarketSynchronization;
  health: LiveBookHealth;
  healthReason?: string;
  sourceSequence?: string;
  serverEpoch?: string;
  receivedAt: string;
  processedAt: string;
  book?: CanonicalBook;
}>;

export interface LiveClock {
  now(): number;
  monotonicNow(): number;
}

export const systemClock: LiveClock = {
  now: () => Date.now(),
  monotonicNow: () => performance.now(),
};

export type Cancel = () => void;

export interface LiveScheduler {
  setTimeout(callback: () => void, delayMs: number): Cancel;
  setInterval(callback: () => void, intervalMs: number): Cancel;
}

export const systemScheduler: LiveScheduler = {
  setTimeout(callback, delayMs) {
    const handle = globalThis.setTimeout(callback, delayMs);
    return () => globalThis.clearTimeout(handle);
  },
  setInterval(callback, intervalMs) {
    const handle = globalThis.setInterval(callback, intervalMs);
    return () => globalThis.clearInterval(handle);
  },
};

export function liveBookKey(key: LiveBookKey): string {
  return `${key.venue}:${key.marketSegment}:${key.venueSymbol}`;
}

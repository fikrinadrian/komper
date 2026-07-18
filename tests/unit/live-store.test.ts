import { describe, expect, it, vi } from 'vitest';
import { LiveBookStore } from '@server/live/store.js';
import type { CanonicalBook } from '@server/domain/types.js';

const key = { venue: 'INDODAX', marketSegment: 'spot', venueSymbol: 'btcidr' } as const;

function book(receivedAt = '2026-07-18T00:00:00.000Z'): CanonicalBook {
  return {
    schemaVersion: '1',
    venue: 'INDODAX',
    marketSegment: 'spot',
    venueSymbol: 'btcidr',
    canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
    bids: [{ price: '999', quantity: '1' }],
    asks: [{ price: '1001', quantity: '1' }],
    receivedAt,
    processedAt: receivedAt,
    freshnessIndependentlyVerified: false,
    synchronization: 'SNAPSHOT',
  };
}

describe('LiveBookStore', () => {
  it('publishes immutable complete records and rejects old-epoch writes', () => {
    const store = new LiveBookStore({
      now: () => Date.parse('2026-07-18T00:00:00Z'),
      monotonicNow: () => 0,
    });
    const listener = vi.fn();
    store.subscribe(listener);
    const firstEpoch = store.beginEpoch(key);
    const live = store.publish(key, firstEpoch, {
      transport: 'WS_FULL_SNAPSHOT',
      synchronization: 'SYNCHRONIZED',
      health: 'LIVE',
      book: book(),
    });
    const secondEpoch = store.beginEpoch(key);
    const rejected = store.publish(key, firstEpoch, {
      transport: 'WS_FULL_SNAPSHOT',
      synchronization: 'SYNCHRONIZED',
      health: 'LIVE',
      book: book(),
    });

    expect(live?.revision).toBeGreaterThan(0);
    expect(Object.isFrozen(live)).toBe(true);
    expect(rejected).toBeUndefined();
    expect(store.get(key)).toMatchObject({ connectionEpoch: secondEpoch, health: 'UNSYNCED' });
    expect(listener).toHaveBeenCalled();
  });

  it('never permits LIVE without synchronized complete state and stops idempotently', () => {
    const store = new LiveBookStore();
    const epoch = store.beginEpoch(key);
    expect(() =>
      store.publish(key, epoch, {
        transport: 'WS_FULL_SNAPSHOT',
        synchronization: 'SYNCHRONIZING',
        health: 'LIVE',
      }),
    ).toThrow('live_requires_synchronized_book');
    store.stop();
    store.stop();
    expect(() => store.beginEpoch(key)).toThrow('live_store_stopped');
  });
});

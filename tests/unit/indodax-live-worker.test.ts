import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { IndodaxAdapter } from '@server/adapters/indodax.js';
import { IndodaxBookWorker } from '@server/live/workers.js';
import { LiveBookStore } from '@server/live/store.js';
import type { SocketLike } from '@server/live/supervisor.js';
import type { CanonicalBook, VenueInstrument } from '@server/domain/types.js';

class SocketHarness extends EventEmitter implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  send(data: string): void {
    this.sent.push(data);
  }
  pong(): void {}
  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', code, Buffer.from(reason));
  }
  terminate(): void {
    this.close(1006, 'terminated');
  }
  open(): void {
    this.readyState = 1;
    this.emit('open');
  }
  message(payload: unknown): void {
    this.emit('message', Buffer.from(JSON.stringify(payload)));
  }
}

const instrument: VenueInstrument = {
  venue: 'INDODAX',
  marketSegment: 'spot',
  venueSymbol: 'btcidr',
  baseAsset: 'BTC',
  quoteAsset: 'IDR',
  active: true,
  directIdr: true,
  marketPriceIncrementRule: {
    state: 'VERIFIED',
    normalizedStep: '1',
    sourceField: 'test',
    sourceValue: '1',
    sourceSemantics: 'STEP_SIZE',
    metadataVersion: 'test',
    verifiedAt: '2026-07-18T00:00:00Z',
  },
  marketQuantityIncrementRule: {
    state: 'VERIFIED',
    normalizedStep: '0.1',
    sourceField: 'test',
    sourceValue: '0.1',
    sourceSemantics: 'STEP_SIZE',
    metadataVersion: 'test',
    verifiedAt: '2026-07-18T00:00:00Z',
  },
  metadataVersion: 'test',
};

function restBook(): CanonicalBook {
  return {
    schemaVersion: '1',
    venue: 'INDODAX',
    marketSegment: 'spot',
    venueSymbol: 'btcidr',
    canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
    bids: [{ price: '999', quantity: '0.3' }],
    asks: [{ price: '1001', quantity: '0.2' }],
    receivedAt: '2026-07-18T00:00:00Z',
    processedAt: '2026-07-18T00:00:00Z',
    freshnessIndependentlyVerified: false,
    synchronization: 'SNAPSHOT',
  };
}

describe('Indodax live order-book worker', () => {
  it('authenticates, subscribes, correlates a full snapshot and invalidates an offset gap', async () => {
    const socket = new SocketHarness();
    const store = new LiveBookStore({
      now: () => Date.parse('2026-07-18T00:00:00Z'),
      monotonicNow: () => 0,
    });
    const adapter = { getBook: async () => restBook() } as unknown as IndodaxAdapter;
    const worker = new IndodaxBookWorker({
      store,
      instrument,
      adapter,
      token: 'public-test-token',
      socketFactory: () => socket,
    });
    worker.start();
    socket.open();
    expect(JSON.parse(socket.sent[0])).toEqual({ params: { token: 'public-test-token' }, id: 1 });
    socket.message({ id: 1, result: { client: 'client-1', version: '2.8.6' } });
    socket.message({ id: 2, result: { recoverable: true, epoch: 'server-1', offset: 10 } });

    const live = new Promise<void>((resolve) => {
      const unsubscribe = store.subscribe((record) => {
        if (record.health === 'LIVE') {
          unsubscribe();
          resolve();
        }
      });
    });
    socket.message({
      result: {
        channel: 'market:order-book-btcidr',
        data: {
          data: {
            pair: 'btcidr',
            ask: [{ btc_volume: '0.2', idr_volume: '200.2', price: '1001' }],
            bid: [{ btc_volume: '0.3', idr_volume: '299.7', price: '999' }],
          },
          offset: 11,
        },
      },
    });
    await live;
    expect(store.get(instrument)).toMatchObject({
      health: 'LIVE',
      transport: 'WS_FULL_SNAPSHOT',
      sourceSequence: '11',
      serverEpoch: 'server-1',
    });

    const gapped = new Promise<void>((resolve) => {
      const unsubscribe = store.subscribe((record) => {
        if (record.synchronization === 'GAPPED') {
          unsubscribe();
          resolve();
        }
      });
    });
    socket.message({
      result: {
        channel: 'market:order-book-btcidr',
        data: {
          data: {
            pair: 'btcidr',
            ask: [{ btc_volume: '0.2', price: '1001' }],
            bid: [{ btc_volume: '0.3', price: '999' }],
          },
          offset: 13,
        },
      },
    });
    await gapped;
    expect(store.get(instrument)).toMatchObject({ health: 'UNSYNCED', synchronization: 'GAPPED' });
    worker.stop();
  });
});

import { EventEmitter } from 'node:events';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook } from '@server/domain/types.js';
import type { MarketSynchronization, MarketTransport } from '@shared/contracts.js';
import type { LiveBookKey, LiveBookRecord, LiveClock } from './types.js';
import { liveBookKey, systemClock } from './types.js';

type PublishInput = {
  transport: MarketTransport;
  synchronization: MarketSynchronization;
  health: LiveBookRecord['health'];
  healthReason?: string;
  sourceSequence?: string;
  serverEpoch?: string;
  book?: CanonicalBook;
};

export class LiveBookStore {
  private readonly records = new Map<string, LiveBookRecord>();
  private readonly epochs = new Map<string, number>();
  private readonly events = new EventEmitter();
  private revision = 0;
  private stopped = false;

  constructor(private readonly clock: LiveClock = systemClock) {
    this.events.setMaxListeners(0);
  }

  beginEpoch(key: LiveBookKey): number {
    if (this.stopped) throw new Error('live_store_stopped');
    const id = liveBookKey(key);
    const epoch = (this.epochs.get(id) ?? 0) + 1;
    this.epochs.set(id, epoch);
    this.publish(key, epoch, {
      transport: this.records.get(id)?.transport ?? 'REST_POLL',
      synchronization: 'RECONNECTING',
      health: 'UNSYNCED',
      healthReason: 'Koneksi baru sedang membangun ulang state.',
    });
    return epoch;
  }

  publish(key: LiveBookKey, epoch: number, input: PublishInput): LiveBookRecord | undefined {
    if (this.stopped || this.epochs.get(liveBookKey(key)) !== epoch) return undefined;
    const book = input.book ? freezeBook(validateBook(input.book)) : undefined;
    if (input.health === 'LIVE' && input.synchronization !== 'SYNCHRONIZED') {
      throw new Error('live_requires_synchronized_book');
    }
    if (input.health === 'LIVE' && !book) throw new Error('live_requires_book');
    const timestamp = new Date(this.clock.now()).toISOString();
    const record: LiveBookRecord = Object.freeze({
      key: Object.freeze({ ...key }),
      revision: ++this.revision,
      connectionEpoch: epoch,
      transport: input.transport,
      synchronization: input.synchronization,
      health: input.health,
      healthReason: input.healthReason,
      sourceSequence: input.sourceSequence,
      serverEpoch: input.serverEpoch,
      receivedAt: book?.receivedAt ?? timestamp,
      processedAt: book?.processedAt ?? timestamp,
      book,
    });
    this.records.set(liveBookKey(key), record);
    this.events.emit('revision', record);
    return record;
  }

  invalidate(
    key: LiveBookKey,
    epoch: number,
    synchronization: Exclude<MarketSynchronization, 'SYNCHRONIZED'>,
    reason: string,
    transport: MarketTransport,
  ): LiveBookRecord | undefined {
    return this.publish(key, epoch, {
      transport,
      synchronization,
      health: synchronization === 'STOPPED' ? 'UNAVAILABLE' : 'UNSYNCED',
      healthReason: reason.slice(0, 240),
    });
  }

  get(key: LiveBookKey): LiveBookRecord | undefined {
    return this.records.get(liveBookKey(key));
  }

  getByVenueSymbol(venue: LiveBookKey['venue'], venueSymbol: string): LiveBookRecord | undefined {
    for (const record of this.records.values()) {
      if (record.key.venue === venue && record.key.venueSymbol === venueSymbol) return record;
    }
    return undefined;
  }

  subscribe(listener: (record: LiveBookRecord) => void): () => void {
    this.events.on('revision', listener);
    return () => this.events.off('revision', listener);
  }

  currentRevision(): number {
    return this.revision;
  }

  stop(): void {
    if (this.stopped) return;
    for (const [id, record] of this.records) {
      this.publish(record.key, record.connectionEpoch, {
        transport: record.transport,
        synchronization: 'STOPPED',
        health: 'UNAVAILABLE',
        healthReason: 'Worker dihentikan.',
      });
      this.epochs.delete(id);
    }
    this.stopped = true;
    this.events.removeAllListeners();
  }
}

function freezeBook(book: CanonicalBook): CanonicalBook {
  const bids = Object.freeze(book.bids.map((level) => Object.freeze({ ...level })));
  const asks = Object.freeze(book.asks.map((level) => Object.freeze({ ...level })));
  return Object.freeze({
    ...book,
    canonicalInstrument: Object.freeze({ ...book.canonicalInstrument }),
    bids: bids as unknown as CanonicalBook['bids'],
    asks: asks as unknown as CanonicalBook['asks'],
  });
}

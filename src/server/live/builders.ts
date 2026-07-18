import Decimal from 'decimal.js';
import type { BookLevel, CanonicalBook } from '@server/domain/types.js';
import { validateBook } from '@server/domain/orderbook.js';
import type { TokocryptoDelta } from './protocols.js';

export type TokocryptoSnapshot = {
  lastUpdateId: string;
  bids: BookLevel[];
  asks: BookLevel[];
  receivedAt: string;
};

export type TokocryptoBuilderState =
  | { state: 'BUFFERING'; buffered: number }
  | { state: 'SYNCHRONIZED'; lastUpdateId: string; book: CanonicalBook }
  | { state: 'GAPPED'; reason: string };

export class TokocryptoBookBuilder {
  private readonly buffer: TokocryptoDelta[] = [];
  private bids = new Map<string, string>();
  private asks = new Map<string, string>();
  private lastUpdateId?: string;
  private awaitingFirst = false;
  private gappedReason?: string;

  constructor(
    private readonly asset: string,
    private readonly venueSymbol: string,
    private readonly maxBufferedEvents = 2_000,
    private readonly nowIso: () => string = () => new Date().toISOString(),
  ) {}

  push(delta: TokocryptoDelta): TokocryptoBuilderState {
    if (delta.s.toUpperCase() !== this.venueSymbol.replace('_', '').toUpperCase()) {
      return this.gap('symbol_mismatch');
    }
    if (this.gappedReason) return { state: 'GAPPED', reason: this.gappedReason };
    if (!this.lastUpdateId) {
      if (this.buffer.length >= this.maxBufferedEvents) return this.gap('buffer_overflow');
      this.buffer.push(delta);
      return { state: 'BUFFERING', buffered: this.buffer.length };
    }
    return this.applyAfterSynchronization(delta);
  }

  applySnapshot(snapshot: TokocryptoSnapshot): TokocryptoBuilderState {
    if (this.gappedReason) return { state: 'GAPPED', reason: this.gappedReason };
    this.bids = new Map(snapshot.bids.map((level) => [level.price, level.quantity]));
    this.asks = new Map(snapshot.asks.map((level) => [level.price, level.quantity]));
    this.lastUpdateId = snapshot.lastUpdateId;
    this.awaitingFirst = true;
    const pending = this.buffer
      .splice(0)
      .filter((delta) => new Decimal(delta.u).gt(snapshot.lastUpdateId));
    if (pending.length === 0) return { state: 'BUFFERING', buffered: 0 };
    const next = new Decimal(snapshot.lastUpdateId).plus(1);
    const first = pending[0];
    if (new Decimal(first.U).gt(next) || new Decimal(first.u).lt(next)) {
      return this.gap('first_event_not_overlapping_snapshot');
    }
    this.applyLevels(first);
    this.lastUpdateId = first.u;
    this.awaitingFirst = false;
    for (const delta of pending.slice(1)) {
      const state = this.applyAfterSynchronization(delta);
      if (state.state === 'GAPPED') return state;
    }
    return this.synchronized(snapshot.receivedAt, first.E);
  }

  current(receivedAt: string, sourceEventTime?: string): TokocryptoBuilderState {
    if (this.gappedReason) return { state: 'GAPPED', reason: this.gappedReason };
    if (!this.lastUpdateId || this.awaitingFirst) {
      return { state: 'BUFFERING', buffered: this.buffer.length };
    }
    return this.synchronized(receivedAt, sourceEventTime);
  }

  private applyAfterSynchronization(delta: TokocryptoDelta): TokocryptoBuilderState {
    if (!this.lastUpdateId) throw new Error('builder_not_synchronized');
    if (new Decimal(delta.u).lte(this.lastUpdateId)) {
      return this.awaitingFirst
        ? { state: 'BUFFERING', buffered: 0 }
        : this.synchronized(this.nowIso(), delta.E);
    }
    const expected = new Decimal(this.lastUpdateId).plus(1);
    const continuous = this.awaitingFirst
      ? new Decimal(delta.U).lte(expected) && new Decimal(delta.u).gte(expected)
      : new Decimal(delta.U).eq(expected);
    if (!continuous) return this.gap('sequence_gap_or_reorder');
    this.applyLevels(delta);
    this.lastUpdateId = delta.u;
    this.awaitingFirst = false;
    return this.synchronized(this.nowIso(), delta.E);
  }

  private applyLevels(delta: TokocryptoDelta): void {
    updateSide(this.bids, delta.b);
    updateSide(this.asks, delta.a);
  }

  private synchronized(receivedAt: string, sourceEventTime?: string): TokocryptoBuilderState {
    const bids = levels(this.bids, 'bid');
    const asks = levels(this.asks, 'ask');
    const book: CanonicalBook = {
      schemaVersion: '1',
      venue: 'TOKOCRYPTO',
      marketSegment: 'spot-type-1',
      venueSymbol: this.venueSymbol,
      canonicalInstrument: { baseAsset: this.asset, quoteAsset: 'IDR' },
      bids,
      asks,
      sourceEventAt: sourceEventTime
        ? new Date(new Decimal(sourceEventTime).toNumber()).toISOString()
        : undefined,
      receivedAt,
      processedAt: this.nowIso(),
      freshnessIndependentlyVerified: Boolean(sourceEventTime),
      synchronization: 'SNAPSHOT',
    };
    try {
      return {
        state: 'SYNCHRONIZED',
        lastUpdateId: this.lastUpdateId!,
        book: validateBook(book),
      };
    } catch {
      return this.gap('invalid_book');
    }
  }

  private gap(reason: string): TokocryptoBuilderState {
    this.gappedReason = reason;
    this.bids.clear();
    this.asks.clear();
    this.lastUpdateId = undefined;
    this.awaitingFirst = false;
    this.buffer.length = 0;
    return { state: 'GAPPED', reason };
  }
}

function updateSide(side: Map<string, string>, updates: Array<[string, string]>): void {
  for (const [price, quantity] of updates) {
    if (new Decimal(quantity).eq(0)) side.delete(price);
    else side.set(price, quantity);
  }
}

function levels(side: Map<string, string>, order: 'bid' | 'ask'): BookLevel[] {
  return [...side]
    .sort(([left], [right]) => {
      const compared = new Decimal(left).cmp(right);
      return order === 'bid' ? -compared : compared;
    })
    .map(([price, quantity]) => ({ price, quantity }));
}

import Decimal from 'decimal.js';
import { z } from 'zod';
import { IndodaxAdapter } from '@server/adapters/indodax.js';
import { RekuAdapter } from '@server/adapters/reku.js';
import { TokocryptoAdapter } from '@server/adapters/tokocrypto.js';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook, VenueInstrument } from '@server/domain/types.js';
import { TokocryptoBookBuilder } from './builders.js';
import {
  parseIndodaxFrame,
  parsePhoenixFrame,
  parseRekuBook,
  parseTokocryptoDelta,
} from './protocols.js';
import { ConnectionSupervisor, type SupervisorOptions } from './supervisor.js';
import type { LiveBookStore } from './store.js';
import type { LiveClock, LiveScheduler } from './types.js';
import { systemClock, systemScheduler } from './types.js';

type CommonWorkerOptions = Omit<SupervisorOptions, 'key' | 'transport' | 'url'>;

export class IndodaxBookWorker extends ConnectionSupervisor {
  private requestId = 0;
  private serverEpoch?: string;
  private lastOffset?: string;
  private subscribed = false;
  private needsRestCorrelation = true;
  private processing = Promise.resolve();

  constructor(
    options: CommonWorkerOptions & {
      instrument: VenueInstrument;
      adapter: IndodaxAdapter;
      token: string;
      url?: string;
    },
  ) {
    super({
      ...options,
      key: keyFor(options.instrument),
      transport: 'WS_FULL_SNAPSHOT',
      url: options.url ?? 'wss://ws3.indodax.com/ws/',
      silenceMs: 25_000,
    });
    this.instrument = options.instrument;
    this.adapter = options.adapter;
    this.token = options.token;
  }

  private readonly instrument: VenueInstrument;
  private readonly adapter: IndodaxAdapter;
  private readonly token: string;

  protected onOpen(): void {
    this.processing = Promise.resolve();
    this.subscribed = false;
    this.needsRestCorrelation = true;
    this.serverEpoch = undefined;
    this.lastOffset = undefined;
    this.send({ params: { token: this.token }, id: ++this.requestId });
    this.scheduleInterval(() => {
      this.send({ method: 7, id: ++this.requestId });
    }, 15_000);
  }

  protected onMessage(text: string): Promise<void> {
    const epoch = this.epoch;
    this.processing = this.processing.then(() => this.processFrame(text, epoch));
    return this.processing;
  }

  protected beforeClose(): void {
    if (this.subscribed) {
      this.send({
        method: 2,
        params: { channel: `market:order-book-${this.instrument.venueSymbol.toLowerCase()}` },
        id: ++this.requestId,
      });
    }
  }

  private async processFrame(text: string, epoch: number): Promise<void> {
    if (epoch !== this.epoch) return;
    const frame = parseIndodaxFrame(text);
    if (frame.kind === 'reply') {
      if (frame.value.error) throw new Error('indodax_protocol_error');
      if (!this.subscribed && frame.value.result?.client) {
        this.send({
          method: 1,
          params: { channel: `market:order-book-${this.instrument.venueSymbol.toLowerCase()}` },
          id: ++this.requestId,
        });
        return;
      }
      if (!this.subscribed && frame.value.result?.epoch) {
        this.serverEpoch = frame.value.result.epoch;
        this.lastOffset = frame.value.result.offset;
        this.subscribed = true;
        this.markProtocolReady();
      }
      this.markTransportActivity();
      return;
    }

    const value = frame.value;
    const expectedChannel = `market:order-book-${this.instrument.venueSymbol.toLowerCase()}`;
    if (
      value.channel !== expectedChannel ||
      value.pair !== this.instrument.venueSymbol.toLowerCase()
    ) {
      throw new Error('indodax_channel_mismatch');
    }
    if (this.lastOffset) {
      const compared = new Decimal(value.offset).cmp(this.lastOffset);
      if (compared <= 0) return;
      if (!new Decimal(value.offset).eq(new Decimal(this.lastOffset).plus(1))) {
        this.fail('Offset Indodax terputus; recovery order book belum terbukti.', 'GAPPED');
        return;
      }
    }
    const receivedAt = new Date(this.clock.now()).toISOString();
    const book = validateBook({
      schemaVersion: '1',
      venue: 'INDODAX',
      marketSegment: this.instrument.marketSegment,
      venueSymbol: this.instrument.venueSymbol,
      canonicalInstrument: { baseAsset: this.instrument.baseAsset, quoteAsset: 'IDR' },
      bids: value.bids,
      asks: value.asks,
      receivedAt,
      processedAt: new Date(this.clock.now()).toISOString(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    });
    if (this.needsRestCorrelation) {
      const rest = await this.adapter.getBook(this.instrument.baseAsset);
      if (epoch !== this.epoch) return;
      if (!topMatches(book, rest)) {
        this.fail('Snapshot WebSocket tidak berkorelasi dengan REST.', 'GAPPED');
        return;
      }
      this.needsRestCorrelation = false;
    }
    this.lastOffset = value.offset;
    this.store.publish(this.key, this.epoch, {
      transport: 'WS_FULL_SNAPSHOT',
      synchronization: 'SYNCHRONIZED',
      health: 'LIVE',
      sourceSequence: value.offset,
      serverEpoch: this.serverEpoch,
      book,
    });
    this.markMarketDataFrame();
  }
}

export class RekuBookWorker extends ConnectionSupervisor {
  private readonly topic: string;
  private ref = 0;
  private joinRef?: string;
  private joined = false;
  private firstSnapshot = true;
  private processing = Promise.resolve();

  constructor(
    options: CommonWorkerOptions & {
      instrument: VenueInstrument;
      adapter: RekuAdapter;
      coinId: string;
      url?: string;
      verificationMs?: number;
    },
  ) {
    super({
      ...options,
      key: keyFor(options.instrument),
      transport: 'WS_FULL_SNAPSHOT',
      url: options.url ?? 'wss://ws.reku.id/socket/websocket?vsn=2.0.0',
      silenceMs: 45_000,
    });
    this.instrument = options.instrument;
    this.adapter = options.adapter;
    this.coinId = options.coinId;
    this.topic = `order:${options.coinId}`;
    this.verificationMs = options.verificationMs ?? 60_000;
  }

  private readonly instrument: VenueInstrument;
  private readonly adapter: RekuAdapter;
  private readonly coinId: string;
  private readonly verificationMs: number;

  protected onOpen(): void {
    this.processing = Promise.resolve();
    this.joined = false;
    this.firstSnapshot = true;
    this.joinRef = String(++this.ref);
    this.send([this.joinRef, this.joinRef, this.topic, 'phx_join', {}]);
    this.scheduleInterval(() => {
      const ref = String(++this.ref);
      this.send([null, ref, 'phoenix', 'heartbeat', {}]);
    }, 20_000);
    this.scheduleInterval(() => void this.verifyRest(), this.verificationMs);
  }

  protected onMessage(text: string): Promise<void> {
    const epoch = this.epoch;
    this.processing = this.processing.then(() => this.processFrame(text, epoch));
    return this.processing;
  }

  protected beforeClose(): void {
    if (this.joined) {
      const ref = String(++this.ref);
      this.send([this.joinRef ?? null, ref, this.topic, 'phx_leave', {}]);
    }
  }

  private async processFrame(text: string, epoch: number): Promise<void> {
    if (epoch !== this.epoch) return;
    const frame = parsePhoenixFrame(text);
    if (frame.event === 'phx_error' || frame.event === 'phx_close') {
      this.fail('Channel Reku error atau tertutup.');
      return;
    }
    if (frame.event === 'phx_reply') {
      const reply = z.object({ status: z.string() }).passthrough().parse(frame.payload);
      if (reply.status !== 'ok') throw new Error('reku_join_or_heartbeat_rejected');
      if (frame.topic === this.topic && frame.ref === this.joinRef) {
        this.joined = true;
        this.markProtocolReady();
      }
      this.markTransportActivity();
      return;
    }
    if (frame.topic !== this.topic || frame.event !== 'data' || !this.joined) return;
    const levels = parseRekuBook(frame.payload, this.coinId);
    const receivedAt = new Date(this.clock.now()).toISOString();
    const book = validateBook({
      schemaVersion: '1',
      venue: 'REKU',
      marketSegment: this.instrument.marketSegment,
      venueSymbol: this.instrument.venueSymbol,
      canonicalInstrument: { baseAsset: this.instrument.baseAsset, quoteAsset: 'IDR' },
      ...levels,
      receivedAt,
      processedAt: new Date(this.clock.now()).toISOString(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    });
    if (this.firstSnapshot) {
      const rest = await this.adapter.getBook(this.instrument.baseAsset);
      if (epoch !== this.epoch) return;
      if (!topMatches(book, rest)) {
        this.fail('Snapshot Reku tidak berkorelasi dengan REST.', 'GAPPED');
        return;
      }
      this.firstSnapshot = false;
    }
    this.store.publish(this.key, this.epoch, {
      transport: 'WS_FULL_SNAPSHOT',
      synchronization: 'SYNCHRONIZED',
      health: 'LIVE',
      book,
    });
    this.markMarketDataFrame();
  }

  private async verifyRest(): Promise<void> {
    const current = this.store.get(this.key);
    if (!current?.book || current.health !== 'LIVE' || current.connectionEpoch !== this.epoch) {
      return;
    }
    try {
      const rest = await this.adapter.getBook(this.instrument.baseAsset);
      if (!topMatches(current.book, rest)) {
        this.fail('Verifikasi REST Reku tidak cocok dengan live book.', 'GAPPED');
      }
    } catch {
      this.fail('Verifikasi REST Reku gagal.', 'GAPPED');
    }
  }
}

export class TokocryptoType1BookWorker extends ConnectionSupervisor {
  private builder?: TokocryptoBookBuilder;
  private processing = Promise.resolve();

  constructor(
    options: CommonWorkerOptions & {
      instrument: VenueInstrument;
      adapter: TokocryptoAdapter;
      url?: string;
      maxBufferedEvents?: number;
      renewalMs?: number;
    },
  ) {
    const stream = `${options.instrument.venueSymbol.replace('_', '').toLowerCase()}@depth`;
    super({
      ...options,
      key: keyFor(options.instrument),
      transport: 'WS_SEQUENCED_DELTA',
      url: options.url ?? `wss://stream-cloud.tokocrypto.site/ws/${stream}`,
      silenceMs: 15_000,
    });
    this.instrument = options.instrument;
    this.adapter = options.adapter;
    this.maxBufferedEvents = options.maxBufferedEvents ?? 2_000;
    this.renewalMs = options.renewalMs ?? 23 * 60 * 60_000 + 50 * 60_000;
  }

  private readonly instrument: VenueInstrument;
  private readonly adapter: TokocryptoAdapter;
  private readonly maxBufferedEvents: number;
  private readonly renewalMs: number;

  protected onOpen(): void {
    this.processing = Promise.resolve();
    const builder = new TokocryptoBookBuilder(
      this.instrument.baseAsset,
      this.instrument.venueSymbol,
      this.maxBufferedEvents,
    );
    this.builder = builder;
    this.store.invalidate(
      this.key,
      this.epoch,
      'SYNCHRONIZING',
      'Menunggu REST snapshot dan delta berurutan.',
      'WS_SEQUENCED_DELTA',
    );
    this.markProtocolReady();
    void this.loadSnapshot(builder, this.epoch);
    this.scheduleTimeout(
      () => this.fail('Koneksi Tokocrypto dijadwalkan untuk renewal.'),
      this.renewalMs,
    );
  }

  protected onMessage(text: string): Promise<void> {
    this.processing = this.processing.then(() => this.processDelta(text));
    return this.processing;
  }

  private async loadSnapshot(builder: TokocryptoBookBuilder, epoch: number): Promise<void> {
    try {
      const snapshot = await this.adapter.getDepthSnapshot(this.instrument.baseAsset);
      if (epoch !== this.epoch || builder !== this.builder) return;
      const state = builder.applySnapshot({
        lastUpdateId: snapshot.lastUpdateId,
        bids: snapshot.book.bids,
        asks: snapshot.book.asks,
        receivedAt: snapshot.book.receivedAt,
      });
      this.publishState(state);
    } catch {
      if (epoch !== this.epoch) return;
      this.fail('Bootstrap REST Tokocrypto gagal.', 'GAPPED');
    }
  }

  private processDelta(text: string): void {
    const delta = parseTokocryptoDelta(text);
    const state = this.builder?.push(delta);
    if (!state) throw new Error('tokocrypto_builder_missing');
    this.publishState(state);
    this.markMarketDataFrame();
  }

  private publishState(state: ReturnType<TokocryptoBookBuilder['push']>): void {
    if (state.state === 'GAPPED') {
      this.fail(`Delta Tokocrypto tidak kontinu: ${state.reason}.`, 'GAPPED');
      return;
    }
    if (state.state !== 'SYNCHRONIZED') return;
    this.store.publish(this.key, this.epoch, {
      transport: 'WS_SEQUENCED_DELTA',
      synchronization: 'SYNCHRONIZED',
      health: 'LIVE',
      sourceSequence: state.lastUpdateId,
      book: state.book,
    });
  }
}

export class RestPollBookWorker {
  private epoch = 0;
  private cancel?: () => void;
  private running = false;

  constructor(
    private readonly store: LiveBookStore,
    private readonly instrument: VenueInstrument,
    private readonly adapter: TokocryptoAdapter,
    private readonly scheduler: LiveScheduler = systemScheduler,
    private readonly clock: LiveClock = systemClock,
    private readonly intervalMs = 10_000,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.epoch = this.store.beginEpoch(keyFor(this.instrument));
    void this.poll();
    this.cancel = this.scheduler.setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancel?.();
    this.store.invalidate(
      keyFor(this.instrument),
      this.epoch,
      'STOPPED',
      'REST poll dihentikan.',
      'REST_POLL',
    );
  }

  private async poll(): Promise<void> {
    try {
      const book = await this.adapter.getBook(this.instrument.baseAsset);
      if (!this.running) return;
      const age = this.clock.now() - Date.parse(book.receivedAt);
      this.store.publish(keyFor(this.instrument), this.epoch, {
        transport: 'REST_POLL',
        synchronization: 'SYNCHRONIZED',
        health: age <= this.intervalMs * 2 ? 'LIVE' : 'STALE',
        healthReason:
          age <= this.intervalMs * 2 ? undefined : 'REST poll melewati ambang kesegaran.',
        book,
      });
    } catch {
      this.store.invalidate(
        keyFor(this.instrument),
        this.epoch,
        'SYNCHRONIZING',
        'REST poll gagal dan state lama dikeluarkan.',
        'REST_POLL',
      );
    }
  }
}

function keyFor(instrument: VenueInstrument) {
  return {
    venue: instrument.venue,
    marketSegment: instrument.marketSegment,
    venueSymbol: instrument.venueSymbol,
  } as const;
}

function topMatches(left: CanonicalBook, right: CanonicalBook): boolean {
  return (
    left.bids[0]?.price === right.bids[0]?.price && left.asks[0]?.price === right.asks[0]?.price
  );
}

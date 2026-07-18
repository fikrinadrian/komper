import { IndodaxAdapter } from '@server/adapters/indodax.js';
import { RekuAdapter } from '@server/adapters/reku.js';
import { TokocryptoAdapter } from '@server/adapters/tokocrypto.js';
import type { VenueAdapter } from '@server/domain/types.js';
import type { Venue } from '@shared/contracts.js';
import type { CatalogService } from '@server/services/catalog-service.js';
import type {
  ComparisonBookResolution,
  ComparisonBookResolver,
} from '@server/services/comparison-service.js';
import { LiveBookStore } from './store.js';
import { liveBookKey } from './types.js';
import {
  IndodaxBookWorker,
  RekuBookWorker,
  RestPollBookWorker,
  TokocryptoType1BookWorker,
} from './workers.js';

export type LiveWorker = { start(): void; stop(): void };
export type LiveWorkerFactory = (
  adapter: VenueAdapter,
  instrument: NonNullable<ReturnType<CatalogService['getVenueInstrument']>>,
) => Promise<LiveWorker | undefined>;

export type LiveFeatureConfig = {
  ingestEnabled: boolean;
  rankingEnabled: boolean;
  sseEnabled: boolean;
  assets: ReadonlySet<string>;
  venues: ReadonlySet<Venue>;
  indodaxToken?: string;
  staleAfterMs: number;
  sseCadenceMs: number;
  sseSlowConsumerMs: number;
  restPollMs: number;
  rekuMaxConnections: number;
};

export function liveFeatureConfig(env: NodeJS.ProcessEnv = process.env): LiveFeatureConfig {
  const ingestEnabled = env.MARKET_LIVE_INGEST_ENABLED === 'true';
  const rankingEnabled = ingestEnabled && env.MARKET_LIVE_RANKING_ENABLED === 'true';
  return {
    ingestEnabled,
    rankingEnabled,
    sseEnabled: rankingEnabled && env.MARKET_LIVE_SSE_ENABLED === 'true',
    assets: new Set(splitCsv(env.MARKET_LIVE_ASSETS).map((asset) => asset.toUpperCase())),
    venues: new Set(
      splitCsv(env.MARKET_LIVE_VENUES ?? 'INDODAX,REKU,TOKOCRYPTO').filter(
        (venue): venue is Venue => ['INDODAX', 'REKU', 'TOKOCRYPTO'].includes(venue),
      ),
    ),
    indodaxToken: env.INDODAX_PUBLIC_WS_TOKEN,
    staleAfterMs: positiveInteger(env.MARKET_LIVE_STALE_MS, 15_000),
    sseCadenceMs: positiveInteger(env.MARKET_LIVE_SSE_CADENCE_MS, 1_000),
    sseSlowConsumerMs: positiveInteger(env.MARKET_LIVE_SSE_SLOW_MS, 5_000),
    restPollMs: positiveInteger(env.MARKET_TYPE3_REST_POLL_MS, 10_000),
    rekuMaxConnections: boundedInteger(env.MARKET_REKU_MAX_CONNECTIONS, 8, 10),
  };
}

export class ConnectionBudget {
  private active = 0;

  constructor(private readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('invalid_connection_budget');
  }

  tryAcquire(): (() => void) | undefined {
    if (this.active >= this.limit) return undefined;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }

  activeCount(): number {
    return this.active;
  }
}

export class LiveMarketCoordinator {
  readonly store: LiveBookStore;
  readonly config: LiveFeatureConfig;
  readonly resolveBook: ComparisonBookResolver;
  private readonly workers = new Map<string, { worker: LiveWorker; references: number }>();
  private readonly workerCreations = new Map<string, Promise<LiveWorker | undefined>>();
  private readonly rekuBudget: ConnectionBudget;
  private stopped = false;

  constructor(
    private readonly adapters: VenueAdapter[],
    private readonly catalog: CatalogService,
    config: LiveFeatureConfig = liveFeatureConfig(),
    store = new LiveBookStore(),
    private readonly injectedWorkerFactory?: LiveWorkerFactory,
  ) {
    this.config = config;
    this.store = store;
    this.rekuBudget = new ConnectionBudget(config.rekuMaxConnections);
    this.resolveBook = async (adapter, asset) => this.resolve(adapter, asset);
  }

  async retainAsset(asset: string): Promise<() => void> {
    const normalized = asset.toUpperCase();
    if (this.stopped || !this.config.ingestEnabled || !this.config.assets.has(normalized)) {
      return () => {};
    }
    await this.catalog.getCatalog();
    const retained: string[] = [];
    try {
      for (const adapter of this.adapters) {
        if (!this.config.venues.has(adapter.venue)) continue;
        const instrument = this.catalog.getVenueInstrument(adapter.venue, normalized);
        if (!instrument) continue;
        const id = liveBookKey(instrument);
        const existing = this.workers.get(id);
        if (existing) {
          existing.references += 1;
          retained.push(id);
          continue;
        }
        const worker = await this.getOrCreateWorker(id, adapter, instrument);
        if (!worker || this.stopped) continue;
        const created = this.workers.get(id);
        if (!created) continue;
        created.references += 1;
        retained.push(id);
      }
    } catch (error) {
      this.releaseRetained(retained);
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseRetained(retained);
    };
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const entry of this.workers.values()) entry.worker.stop();
    this.workers.clear();
    this.store.stop();
  }

  private async createWorker(
    adapter: VenueAdapter,
    instrument: NonNullable<ReturnType<CatalogService['getVenueInstrument']>>,
  ): Promise<LiveWorker | undefined> {
    if (adapter instanceof IndodaxAdapter) {
      if (!this.config.indodaxToken) return undefined;
      return new IndodaxBookWorker({
        store: this.store,
        instrument,
        adapter,
        token: this.config.indodaxToken,
      });
    }
    if (adapter instanceof RekuAdapter) {
      const releaseBudget = this.rekuBudget.tryAcquire();
      if (!releaseBudget) {
        return new UnavailableWorker(
          this.store,
          instrument,
          'Batas koneksi Reku proses ini tercapai; feed tidak dibuka.',
        );
      }
      try {
        const coinId = await adapter.getCoinId(instrument.baseAsset);
        return new BudgetedWorker(
          new RekuBookWorker({ store: this.store, instrument, adapter, coinId }),
          releaseBudget,
        );
      } catch (error) {
        releaseBudget();
        throw error;
      }
    }
    if (adapter instanceof TokocryptoAdapter) {
      if (instrument.marketSegment === 'spot-type-1') {
        return new TokocryptoType1BookWorker({ store: this.store, instrument, adapter });
      }
      if (instrument.marketSegment === 'spot-type-3') {
        return new RestPollBookWorker(
          this.store,
          instrument,
          adapter,
          undefined,
          undefined,
          this.config.restPollMs,
        );
      }
    }
    return undefined;
  }

  private getOrCreateWorker(
    id: string,
    adapter: VenueAdapter,
    instrument: NonNullable<ReturnType<CatalogService['getVenueInstrument']>>,
  ): Promise<LiveWorker | undefined> {
    const pending = this.workerCreations.get(id);
    if (pending) return pending;
    const factory =
      this.injectedWorkerFactory ?? ((source, item) => this.createWorker(source, item));
    const creation = factory(adapter, instrument)
      .then((worker) => {
        if (!worker) return undefined;
        if (this.stopped) {
          worker.stop();
          return undefined;
        }
        this.workers.set(id, { worker, references: 0 });
        worker.start();
        return worker;
      })
      .catch(() => undefined)
      .finally(() => {
        this.workerCreations.delete(id);
      });
    this.workerCreations.set(id, creation);
    return creation;
  }

  private releaseRetained(ids: string[]): void {
    for (const id of ids) {
      const entry = this.workers.get(id);
      if (!entry) continue;
      entry.references -= 1;
      if (entry.references <= 0) {
        entry.worker.stop();
        this.workers.delete(id);
      }
    }
  }

  private async resolve(
    adapter: VenueAdapter,
    asset: string,
  ): Promise<ComparisonBookResolution | undefined> {
    const normalized = asset.toUpperCase();
    if (
      !this.config.rankingEnabled ||
      !this.config.assets.has(normalized) ||
      !this.config.venues.has(adapter.venue)
    ) {
      return undefined;
    }
    const instrument = this.catalog.getVenueInstrument(adapter.venue, normalized);
    if (!instrument) return undefined;
    const record = this.store.get(instrument);
    if (!record) {
      return {
        status: 'UNSYNCED',
        reason: 'Live worker belum menerbitkan canonical book.',
      };
    }
    const common = {
      transport: record.transport,
      synchronization: record.synchronization,
      connectionEpoch: record.connectionEpoch,
      liveRevision: record.revision,
    };
    const age = Date.now() - Date.parse(record.receivedAt);
    if (record.health === 'LIVE' && record.book && age <= this.config.staleAfterMs) {
      return { ...common, book: record.book };
    }
    const status =
      record.health === 'STALE' || age > this.config.staleAfterMs
        ? 'STALE'
        : record.health === 'UNAVAILABLE'
          ? 'UNAVAILABLE'
          : 'UNSYNCED';
    return {
      ...common,
      status,
      reason: record.healthReason ?? 'Canonical live book tidak sehat.',
    };
  }
}

function splitCsv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  return Math.min(positiveInteger(value, fallback), maximum);
}

class BudgetedWorker implements LiveWorker {
  private stopped = false;

  constructor(
    private readonly worker: LiveWorker,
    private readonly releaseBudget: () => void,
  ) {}

  start(): void {
    this.worker.start();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.worker.stop();
    this.releaseBudget();
  }
}

class UnavailableWorker implements LiveWorker {
  private epoch?: number;

  constructor(
    private readonly store: LiveBookStore,
    private readonly instrument: NonNullable<ReturnType<CatalogService['getVenueInstrument']>>,
    private readonly reason: string,
  ) {}

  start(): void {
    if (this.epoch) return;
    this.epoch = this.store.beginEpoch(this.instrument);
    this.store.invalidate(this.instrument, this.epoch, 'STOPPED', this.reason, 'WS_FULL_SNAPSHOT');
  }

  stop(): void {
    if (!this.epoch) return;
    this.store.invalidate(this.instrument, this.epoch, 'STOPPED', this.reason, 'WS_FULL_SNAPSHOT');
  }
}

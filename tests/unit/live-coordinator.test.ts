import { describe, expect, it, vi } from 'vitest';
import type { VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import type { CatalogService } from '@server/services/catalog-service.js';
import {
  LiveMarketCoordinator,
  type LiveFeatureConfig,
  type LiveWorker,
} from '@server/live/coordinator.js';

const instrument: VenueInstrument = {
  venue: 'REKU',
  marketSegment: 'spot',
  venueSymbol: 'BTC_IDR',
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
  },
  marketQuantityIncrementRule: {
    state: 'VERIFIED',
    normalizedStep: '0.1',
    sourceField: 'test',
    sourceValue: '0.1',
    sourceSemantics: 'STEP_SIZE',
    metadataVersion: 'test',
  },
  metadataVersion: 'test',
};

const adapter = { venue: 'REKU' } as VenueAdapter;
const catalog = {
  getCatalog: async () => ({ instruments: [] }),
  getVenueInstrument: () => instrument,
} as unknown as CatalogService;
const config: LiveFeatureConfig = {
  ingestEnabled: true,
  rankingEnabled: true,
  sseEnabled: true,
  assets: new Set(['BTC']),
  venues: new Set(['REKU']),
  staleAfterMs: 15_000,
  sseCadenceMs: 1_000,
  sseSlowConsumerMs: 5_000,
  restPollMs: 10_000,
  rekuMaxConnections: 8,
};

describe('LiveMarketCoordinator concurrent retention', () => {
  it('single-flights first worker creation and releases one shared ref-counted worker', async () => {
    let finishCreation!: () => void;
    const creationGate = new Promise<void>((resolve) => {
      finishCreation = resolve;
    });
    const worker: LiveWorker = { start: vi.fn(), stop: vi.fn() };
    const factory = vi.fn(async () => {
      await creationGate;
      return worker;
    });
    const coordinator = new LiveMarketCoordinator([adapter], catalog, config, undefined, factory);

    const first = coordinator.retainAsset('BTC');
    const second = coordinator.retainAsset('BTC');
    await Promise.resolve();
    expect(factory).toHaveBeenCalledOnce();
    finishCreation();
    const [releaseFirst, releaseSecond] = await Promise.all([first, second]);
    expect(worker.start).toHaveBeenCalledOnce();

    releaseFirst();
    expect(worker.stop).not.toHaveBeenCalled();
    releaseSecond();
    expect(worker.stop).toHaveBeenCalledOnce();
    coordinator.stop();
  });

  it('clears a failed creation reservation so a later retain can retry', async () => {
    const worker: LiveWorker = { start: vi.fn(), stop: vi.fn() };
    const factory = vi
      .fn<() => Promise<LiveWorker>>()
      .mockRejectedValueOnce(new Error('creation_failed'))
      .mockResolvedValueOnce(worker);
    const coordinator = new LiveMarketCoordinator([adapter], catalog, config, undefined, factory);

    const [releaseOne, releaseTwo] = await Promise.all([
      coordinator.retainAsset('BTC'),
      coordinator.retainAsset('BTC'),
    ]);
    releaseOne();
    releaseTwo();
    expect(factory).toHaveBeenCalledOnce();

    const releaseRetry = await coordinator.retainAsset('BTC');
    expect(factory).toHaveBeenCalledTimes(2);
    expect(worker.start).toHaveBeenCalledOnce();
    releaseRetry();
    expect(worker.stop).toHaveBeenCalledOnce();
    coordinator.stop();
  });

  it('isolates one venue creation failure and releases healthy shared workers', async () => {
    const healthyAdapter = { venue: 'INDODAX' } as VenueAdapter;
    const failedAdapter = { venue: 'REKU' } as VenueAdapter;
    const healthyInstrument = { ...instrument, venue: 'INDODAX' as const, venueSymbol: 'btcidr' };
    const mixedCatalog = {
      getCatalog: async () => ({ instruments: [] }),
      getVenueInstrument: (venue: string) => (venue === 'INDODAX' ? healthyInstrument : instrument),
    } as unknown as CatalogService;
    const mixedConfig = {
      ...config,
      venues: new Set(['INDODAX', 'REKU'] as const),
    } satisfies LiveFeatureConfig;
    const healthyWorker: LiveWorker = { start: vi.fn(), stop: vi.fn() };
    const factory = vi.fn(async (source: VenueAdapter) => {
      if (source.venue === 'REKU') throw new Error('coin_id_failed');
      return healthyWorker;
    });
    const coordinator = new LiveMarketCoordinator(
      [healthyAdapter, failedAdapter],
      mixedCatalog,
      mixedConfig,
      undefined,
      factory,
    );

    const [releaseFirst, releaseSecond] = await Promise.all([
      coordinator.retainAsset('BTC'),
      coordinator.retainAsset('BTC'),
    ]);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(healthyWorker.start).toHaveBeenCalledOnce();
    releaseFirst();
    expect(healthyWorker.stop).not.toHaveBeenCalled();
    releaseSecond();
    expect(healthyWorker.stop).toHaveBeenCalledOnce();
    coordinator.stop();
  });
});

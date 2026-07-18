import { describe, expect, it } from 'vitest';
import { MarketsService } from '@server/services/markets-service.js';
import { CatalogService } from '@server/services/catalog-service.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import type { MarketCandle, MarketTicker, Venue } from '@shared/contracts.js';
import { stepRule } from '@server/domain/increments.js';

class MarketsAdapter implements VenueAdapter {
  constructor(
    readonly venue: Venue,
    private readonly assets: string[],
  ) {}

  async discover(): Promise<VenueInstrument[]> {
    return this.assets.map((asset) => ({
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol: `${asset}_IDR`,
      baseAsset: asset,
      quoteAsset: 'IDR',
      active: true,
      directIdr: true,
      marketPriceIncrementRule: stepRule('fixture', '1', 'fixture-v1'),
      marketQuantityIncrementRule: stepRule('fixture', '0.01', 'fixture-v1'),
      metadataVersion: 'fixture-v1',
    }));
  }

  async listTickers(): Promise<MarketTicker[]> {
    return this.assets.map((asset, index) => ({
      venue: this.venue,
      venueSymbol: `${asset}_IDR`,
      lastPrice: String(100 + index),
      receivedAt: '2026-07-18T00:00:00.000Z',
    }));
  }

  async getBook(asset: string): Promise<CanonicalBook> {
    return {
      schemaVersion: '1',
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol: `${asset}_IDR`,
      canonicalInstrument: { baseAsset: asset, quoteAsset: 'IDR' },
      bids: [{ price: '99', quantity: '1' }],
      asks: [{ price: '101', quantity: '1' }],
      receivedAt: '2026-07-18T00:00:00.000Z',
      processedAt: '2026-07-18T00:00:00.000Z',
      freshnessIndependentlyVerified: true,
      synchronization: 'SNAPSHOT',
    };
  }

  async getTrades() {
    return undefined;
  }

  async getCandles(): Promise<MarketCandle[]> {
    return [
      {
        openedAt: '2026-07-18T00:00:00.000Z',
        open: '100',
        high: '101',
        low: '99',
        close: '100',
      },
    ];
  }
}

describe('Markets union and partial venue coverage', () => {
  const adapters: VenueAdapter[] = [
    new MarketsAdapter('INDODAX', ['BTC', 'SOL']),
    new MarketsAdapter('REKU', ['BTC']),
    new MarketsAdapter('TOKOCRYPTO', ['BTC', 'ETH']),
  ];
  const catalog = new CatalogService(adapters);
  const markets = new MarketsService(adapters, catalog, () =>
    Date.parse('2026-07-18T00:00:30.000Z'),
  );

  it('keeps the union of active IDR pairs and marks missing venue cells', async () => {
    const response = await markets.getOverview();
    expect(response.rows.map((row) => row.pair)).toEqual(['BTC-IDR', 'ETH-IDR', 'SOL-IDR']);
    const sol = response.rows.find((row) => row.asset === 'SOL')!;
    expect(sol.venues).toEqual([
      expect.objectContaining({ venue: 'INDODAX', status: 'AVAILABLE' }),
      expect.objectContaining({ venue: 'REKU', status: 'UNSUPPORTED' }),
      expect.objectContaining({ venue: 'TOKOCRYPTO', status: 'UNSUPPORTED' }),
    ]);
  });

  it('retains healthy detail components when a pair is absent from sibling venues', async () => {
    const response = await markets.getDetail('SOL');
    expect(response.venues.find((venue) => venue.venue === 'INDODAX')).toMatchObject({
      status: 'AVAILABLE',
      tradeSampleStatus: 'UNSUPPORTED',
    });
    expect(response.venues.find((venue) => venue.venue === 'REKU')).toMatchObject({
      status: 'UNSUPPORTED',
      reason: 'Pair IDR aktif tidak tersedia di exchange ini.',
    });
  });

  it.each([
    [89_999, 'AVAILABLE'],
    [90_000, 'AVAILABLE'],
    [90_001, 'STALE'],
  ] as const)('applies the ticker freshness boundary at %sms', async (ageMs, status) => {
    const boundaryMarkets = new MarketsService(
      adapters,
      catalog,
      () => Date.parse('2026-07-18T00:00:00.000Z') + ageMs,
      90_000,
    );
    const response = await boundaryMarkets.getOverview();
    expect(response.rows.find((row) => row.asset === 'BTC')?.venues[0].status).toBe(status);
  });
});

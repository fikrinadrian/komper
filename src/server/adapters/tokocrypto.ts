import { z } from 'zod';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import { stepRule, unverifiedRule } from '@server/domain/increments.js';
import { fetchPublicJson, nowIso } from './http.js';

const CATALOG_HOSTS = ['www.tokocrypto.com'] as const;
const DEPTH_HOSTS = ['www.tokocrypto.site'] as const;
const TYPE_3_DEPTH_HOSTS = ['cloudme-toko.2meta.app'] as const;

const filterSchema = z
  .object({
    filterType: z.string(),
    minNotional: z.string().optional(),
    minQty: z.string().optional(),
    tickSize: z.string().optional(),
    stepSize: z.string().optional(),
  })
  .passthrough();

const symbolSchema = z.object({
  type: z.string(),
  symbol: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  spotTradingEnable: z.string(),
  filters: z.array(filterSchema),
});

const catalogSchema = z.object({
  code: z.string(),
  data: z.object({ list: z.array(symbolSchema) }),
});

const depthPayloadSchema = z.object({
  lastUpdateId: z.string(),
  E: z.string().optional(),
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
});
const wrappedDepthSchema = z.union([
  depthPayloadSchema,
  z.object({ code: z.string(), data: depthPayloadSchema }),
]);

export class TokocryptoAdapter implements VenueAdapter {
  readonly venue = 'TOKOCRYPTO' as const;
  private readonly segmentByAsset = new Map<string, string>();

  async discover(signal?: AbortSignal): Promise<VenueInstrument[]> {
    const raw = await fetchPublicJson(
      new URL('https://www.tokocrypto.com/open/v1/common/symbols'),
      CATALOG_HOSTS,
      signal,
    );
    const catalog = catalogSchema.parse(raw);
    const instruments = catalog.data.list.map((symbol) => {
      const minimum = symbol.filters.find((item) => item.filterType === 'NOTIONAL')?.minNotional;
      const priceIncrement = symbol.filters.find(
        (item) => item.filterType === 'PRICE_FILTER',
      )?.tickSize;
      const marketLot = symbol.filters.find((item) => item.filterType === 'MARKET_LOT_SIZE');
      const generalLot = symbol.filters.find((item) => item.filterType === 'LOT_SIZE');
      const metadataVersion = `tokocrypto-symbols-type-${symbol.type}-v1`;
      const marketStep = marketLot?.stepSize;
      const usesMarketStep = Boolean(marketStep && !/^0+(?:\.0+)?$/.test(marketStep));
      const quantityRule = usesMarketStep
        ? stepRule('filters.MARKET_LOT_SIZE.stepSize', marketStep, metadataVersion)
        : generalLot?.stepSize
          ? stepRule('filters.LOT_SIZE.stepSize', generalLot.stepSize, metadataVersion)
          : unverifiedRule(
              'filters.MARKET_LOT_SIZE.stepSize',
              marketStep,
              'STEP_SIZE',
              metadataVersion,
            );
      return {
        venue: this.venue,
        marketSegment: `spot-type-${symbol.type}`,
        venueSymbol: symbol.symbol,
        baseAsset: symbol.baseAsset.toUpperCase(),
        quoteAsset: symbol.quoteAsset.toUpperCase(),
        active: symbol.spotTradingEnable === '1',
        directIdr: symbol.quoteAsset.toUpperCase() === 'IDR',
        minimumNotional: minimum,
        minimumQuantity: usesMarketStep ? marketLot?.minQty : generalLot?.minQty,
        marketPriceIncrementRule: stepRule(
          'filters.PRICE_FILTER.tickSize',
          priceIncrement,
          metadataVersion,
        ),
        marketQuantityIncrementRule: quantityRule,
        metadataVersion,
      };
    });
    for (const instrument of instruments) {
      if (
        instrument.active &&
        instrument.directIdr &&
        !this.segmentByAsset.has(instrument.baseAsset)
      ) {
        this.segmentByAsset.set(instrument.baseAsset, instrument.marketSegment);
      }
    }
    return instruments;
  }

  async getBook(asset: string, signal?: AbortSignal): Promise<CanonicalBook> {
    const venueSymbol = `${asset.toUpperCase()}_IDR`;
    const marketSegment = this.segmentByAsset.get(asset) ?? 'spot-type-1';
    const isType3 = marketSegment === 'spot-type-3';
    const url = new URL(
      isType3
        ? 'https://cloudme-toko.2meta.app/api/v1/depth'
        : 'https://www.tokocrypto.site/api/v3/depth',
    );
    url.searchParams.set('symbol', venueSymbol.replace('_', ''));
    url.searchParams.set('limit', '100');
    const parsed = wrappedDepthSchema.parse(
      await fetchPublicJson(url, isType3 ? TYPE_3_DEPTH_HOSTS : DEPTH_HOSTS, signal),
    );
    const raw = 'data' in parsed ? parsed.data : parsed;
    const receivedAt = nowIso();
    return validateBook({
      schemaVersion: '1',
      venue: this.venue,
      marketSegment,
      venueSymbol,
      canonicalInstrument: { baseAsset: asset, quoteAsset: 'IDR' },
      bids: raw.bids.map(([price, quantity]) => ({ price, quantity })),
      asks: raw.asks.map(([price, quantity]) => ({ price, quantity })),
      receivedAt,
      processedAt: nowIso(),
      sourceEventAt: raw.E ? new Date(Number(raw.E)).toISOString() : undefined,
      // Type 3 currently supplies source event time. Type 1 freshness is based on BFF receive
      // time until the future sequenced WebSocket state builder is implemented.
      freshnessIndependentlyVerified: Boolean(raw.E),
      synchronization: 'SNAPSHOT',
    });
  }
}

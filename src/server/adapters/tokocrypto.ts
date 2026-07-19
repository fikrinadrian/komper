import { z } from 'zod';
import Decimal from 'decimal.js';
import { validateBook } from '@server/domain/orderbook.js';
import type {
  CanonicalBook,
  MarketCandleRequest,
  VenueAdapter,
  VenueInstrument,
} from '@server/domain/types.js';
import type { MarketCandle, MarketTicker, MarketTrade } from '@shared/contracts.js';
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

const tickerSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  bidPrice: z.string().optional(),
  askPrice: z.string().optional(),
  openPrice: z.string().optional(),
  highPrice: z.string().optional(),
  lowPrice: z.string().optional(),
  priceChangePercent: z.string().optional(),
  volume: z.string().optional(),
  quoteVolume: z.string().optional(),
  closeTime: z.string().optional(),
});
const tickersSchema = z.array(tickerSchema);

const tradeSchema = z.object({
  id: z.string(),
  price: z.string(),
  qty: z.string(),
  time: z.string(),
  isBuyerMaker: z.boolean(),
});
const aggregateTradeSchema = z.object({
  a: z.string(),
  p: z.string(),
  q: z.string(),
  T: z.string(),
  m: z.boolean(),
});
const tradesSchema = z.union([
  z.array(tradeSchema),
  z.object({ data: z.array(tradeSchema) }).transform((item) => item.data),
]);
const aggregateTradesSchema = z.union([
  z.array(aggregateTradeSchema),
  z.object({ data: z.array(aggregateTradeSchema) }).transform((item) => item.data),
]);

const candleTupleSchema = z.tuple([
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
]);
const candleEntrySchema = z.union([
  candleTupleSchema,
  z
    .object({ value: candleTupleSchema, Count: z.string().optional() })
    .transform((item) => item.value),
]);
const candlesSchema = z.union([
  z.array(candleEntrySchema),
  z.object({ data: z.array(candleEntrySchema) }).transform((item) => item.data),
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
    return (await this.getDepthSnapshot(asset, signal)).book;
  }

  getMarketSegment(asset: string): string {
    return this.segmentByAsset.get(asset.toUpperCase()) ?? 'spot-type-1';
  }

  async getDepthSnapshot(
    asset: string,
    signal?: AbortSignal,
  ): Promise<{ lastUpdateId: string; book: CanonicalBook }> {
    const venueSymbol = `${asset.toUpperCase()}_IDR`;
    const marketSegment = this.getMarketSegment(asset);
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
    const book = validateBook({
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
    return { lastUpdateId: raw.lastUpdateId, book };
  }

  async listTickers(signal?: AbortSignal): Promise<MarketTicker[]> {
    const raw = tickersSchema.parse(
      await fetchPublicJson(
        new URL('https://www.tokocrypto.site/api/v3/ticker/24hr'),
        DEPTH_HOSTS,
        signal,
      ),
    );
    const receivedAt = nowIso();
    return raw
      .filter((ticker) => ticker.symbol.endsWith('IDR'))
      .map((ticker) => ({
        venue: this.venue,
        venueSymbol: ticker.symbol,
        lastPrice: ticker.lastPrice,
        bestBid: ticker.bidPrice,
        bestAsk: ticker.askPrice,
        high24h: ticker.highPrice,
        low24h: ticker.lowPrice,
        open24h: ticker.openPrice,
        priceChangePercent24h: ticker.priceChangePercent,
        baseVolume24h: ticker.volume,
        quoteVolume24h: ticker.quoteVolume,
        sourceEventAt: ticker.closeTime
          ? new Date(new Decimal(ticker.closeTime).toNumber()).toISOString()
          : undefined,
        receivedAt,
      }));
  }

  async getTrades(asset: string, signal?: AbortSignal): Promise<MarketTrade[]> {
    const marketSegment = this.segmentByAsset.get(asset) ?? 'spot-type-1';
    const isType3 = marketSegment === 'spot-type-3';
    const url = new URL(
      isType3
        ? 'https://cloudme-toko.2meta.app/api/v1/aggTrades'
        : 'https://www.tokocrypto.site/api/v3/trades',
    );
    url.searchParams.set('symbol', `${asset.toUpperCase()}IDR`);
    url.searchParams.set('limit', '50');
    const raw = await fetchPublicJson(url, isType3 ? TYPE_3_DEPTH_HOSTS : DEPTH_HOSTS, signal);
    if (isType3) {
      return aggregateTradesSchema.parse(raw).map((trade) => ({
        id: trade.a,
        price: trade.p,
        quantity: trade.q,
        occurredAt: new Date(new Decimal(trade.T).toNumber()).toISOString(),
      }));
    }
    return tradesSchema.parse(raw).map((trade) => ({
      id: trade.id,
      price: trade.price,
      quantity: trade.qty,
      occurredAt: new Date(new Decimal(trade.time).toNumber()).toISOString(),
    }));
  }

  async getCandles(
    asset: string,
    request?: MarketCandleRequest,
    signal?: AbortSignal,
  ): Promise<MarketCandle[]> {
    const marketSegment = this.segmentByAsset.get(asset) ?? 'spot-type-1';
    const isType3 = marketSegment === 'spot-type-3';
    const url = new URL(
      isType3
        ? 'https://cloudme-toko.2meta.app/api/v1/klines'
        : 'https://www.tokocrypto.site/api/v3/klines',
    );
    const interval = request?.interval ?? '1h';
    const limit = request?.limit ?? 24;
    url.searchParams.set('symbol', `${asset.toUpperCase()}IDR`);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', String(limit));
    if (request) {
      url.searchParams.set('startTime', String(request.fromMs));
      url.searchParams.set('endTime', String(request.toMs));
    }
    const raw = candlesSchema.parse(
      await fetchPublicJson(url, isType3 ? TYPE_3_DEPTH_HOSTS : DEPTH_HOSTS, signal),
    );
    return raw.slice(-limit).map((candle) => ({
      openedAt: new Date(new Decimal(candle[0]).toNumber()).toISOString(),
      closedAt: new Date(new Decimal(candle[6]).toNumber()).toISOString(),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      baseVolume: candle[5],
      quoteVolume: candle[7],
      tradeCount: new Decimal(candle[8]).toNumber(),
    }));
  }
}

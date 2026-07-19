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
import { decimalPlacesRule, stepRule } from '@server/domain/increments.js';
import { fetchPublicJson, nowIso } from './http.js';

const HOSTS = ['indodax.com'] as const;

const pairSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  base_currency: z.string(),
  traded_currency: z.string(),
  ticker_id: z.string(),
  price_precision: z.string().optional(),
  volume_precision: z.string().optional(),
  price_round: z.string().optional(),
  trade_min_base_currency: z.string().optional(),
  trade_min_traded_currency: z.string().optional(),
  is_maintenance: z.string().optional(),
  is_market_suspended: z.string().optional(),
});

const depthSchema = z.object({
  buy: z.array(z.tuple([z.string(), z.string()])),
  sell: z.array(z.tuple([z.string(), z.string()])),
});

const tickerSchema = z
  .object({
    high: z.string(),
    low: z.string(),
    last: z.string(),
    buy: z.string(),
    sell: z.string(),
    server_time: z.string(),
    vol_idr: z.string().optional(),
  })
  .passthrough();
const tickerAllSchema = z.object({ tickers: z.record(tickerSchema) });
const tradesSchema = z.array(
  z.object({
    tid: z.string(),
    type: z.enum(['buy', 'sell']),
    price: z.string(),
    amount: z.string(),
    date: z.string(),
  }),
);
const candlesSchema = z.array(
  z.object({
    Time: z.string(),
    Open: z.string(),
    High: z.string(),
    Low: z.string(),
    Close: z.string(),
    Volume: z.string().optional(),
  }),
);
type IndodaxCandle = z.infer<typeof candlesSchema>[number];

function mapCandle(candle: IndodaxCandle, intervalMs: number): MarketCandle {
  const openedAt = new Decimal(candle.Time).mul(1000).toNumber();
  return {
    openedAt: new Date(openedAt).toISOString(),
    closedAt: new Date(openedAt + intervalMs - 1).toISOString(),
    open: candle.Open,
    high: candle.High,
    low: candle.Low,
    close: candle.Close,
    baseVolume: candle.Volume,
  };
}

function aggregateDailyWeeks(candles: IndodaxCandle[]): MarketCandle[] {
  const byWeek = new Map<number, IndodaxCandle[]>();
  for (const candle of candles) {
    const openedAt = new Decimal(candle.Time).mul(1000).toNumber();
    const date = new Date(openedAt);
    const monday =
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      ((date.getUTCDay() + 6) % 7) * 86_400_000;
    const group = byWeek.get(monday) ?? [];
    group.push(candle);
    byWeek.set(monday, group);
  }

  return [...byWeek.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([monday, group]) => {
      const sorted = group.sort((left, right) =>
        new Decimal(left.Time).cmp(new Decimal(right.Time)),
      );
      const complete =
        sorted.length === 7 &&
        sorted.every(
          (candle, index) =>
            new Decimal(candle.Time).mul(1000).toNumber() === monday + index * 86_400_000,
        );
      if (!complete) return [];
      const volumes = sorted.map((candle) => candle.Volume).filter((value) => value !== undefined);
      return [
        {
          openedAt: new Date(monday).toISOString(),
          closedAt: new Date(monday + 7 * 86_400_000 - 1).toISOString(),
          open: sorted[0].Open,
          high: Decimal.max(...sorted.map((candle) => new Decimal(candle.High))).toFixed(),
          low: Decimal.min(...sorted.map((candle) => new Decimal(candle.Low))).toFixed(),
          close: sorted.at(-1)!.Close,
          baseVolume:
            volumes.length === sorted.length
              ? Decimal.sum(...volumes.map((value) => new Decimal(value!))).toFixed()
              : undefined,
        },
      ];
    });
}

export class IndodaxAdapter implements VenueAdapter {
  readonly venue = 'INDODAX' as const;

  async discover(signal?: AbortSignal): Promise<VenueInstrument[]> {
    const raw = await fetchPublicJson(new URL('https://indodax.com/api/pairs'), HOSTS, signal);
    const pairs = z.array(pairSchema).parse(raw);
    const metadataVersion = 'indodax-pairs-v1';
    return pairs.map((pair) => ({
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol: pair.id,
      baseAsset: pair.traded_currency.toUpperCase(),
      quoteAsset: pair.base_currency.toUpperCase(),
      active: pair.is_maintenance === '0' && pair.is_market_suspended === '0',
      directIdr: pair.base_currency.toUpperCase() === 'IDR',
      minimumNotional: pair.trade_min_base_currency,
      minimumQuantity: pair.trade_min_traded_currency,
      marketPriceIncrementRule: stepRule('price_precision', pair.price_precision, metadataVersion),
      marketQuantityIncrementRule: decimalPlacesRule(
        'price_round',
        pair.price_round,
        metadataVersion,
      ),
      metadataVersion,
    }));
  }

  async getBook(asset: string, signal?: AbortSignal): Promise<CanonicalBook> {
    const venueSymbol = `${asset.toLowerCase()}idr`;
    const url = new URL(`/api/depth/${venueSymbol}`, 'https://indodax.com');
    const raw = depthSchema.parse(await fetchPublicJson(url, HOSTS, signal));
    const receivedAt = nowIso();
    return validateBook({
      schemaVersion: '1',
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol,
      canonicalInstrument: { baseAsset: asset, quoteAsset: 'IDR' },
      bids: raw.buy.map(([price, quantity]) => ({ price, quantity })),
      asks: raw.sell.map(([price, quantity]) => ({ price, quantity })),
      receivedAt,
      processedAt: nowIso(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    });
  }

  async listTickers(signal?: AbortSignal): Promise<MarketTicker[]> {
    const raw = tickerAllSchema.parse(
      await fetchPublicJson(new URL('https://indodax.com/api/ticker_all'), HOSTS, signal),
    );
    const receivedAt = nowIso();
    return Object.entries(raw.tickers)
      .filter(([symbol]) => symbol.toLowerCase().endsWith('_idr'))
      .map(([symbol, ticker]) => ({
        venue: this.venue,
        venueSymbol: symbol,
        lastPrice: ticker.last,
        bestBid: ticker.buy,
        bestAsk: ticker.sell,
        high24h: ticker.high,
        low24h: ticker.low,
        baseVolume24h: ticker[`vol_${symbol.slice(0, -4).toLowerCase()}`] as string | undefined,
        quoteVolume24h: ticker.vol_idr,
        sourceEventAt: new Date(new Decimal(ticker.server_time).mul(1000).toNumber()).toISOString(),
        receivedAt,
      }));
  }

  async getTrades(asset: string, signal?: AbortSignal): Promise<MarketTrade[]> {
    const venueSymbol = `${asset.toLowerCase()}idr`;
    const raw = tradesSchema.parse(
      await fetchPublicJson(
        new URL(`/api/trades/${venueSymbol}`, 'https://indodax.com'),
        HOSTS,
        signal,
      ),
    );
    return raw.slice(0, 50).map((trade) => ({
      id: trade.tid,
      price: trade.price,
      quantity: trade.amount,
      side: trade.type,
      occurredAt: new Date(new Decimal(trade.date).mul(1000).toNumber()).toISOString(),
    }));
  }

  async getCandles(
    asset: string,
    request?: MarketCandleRequest,
    signal?: AbortSignal,
  ): Promise<MarketCandle[]> {
    const intervalMs = request?.intervalMs ?? 3_600_000;
    const limit = request?.limit ?? 24;
    const toMs = request?.toMs ?? Date.now();
    const fromMs = request?.fromMs ?? toMs - 25 * 3_600_000;
    const url = new URL('https://indodax.com/tradingview/history_v2');
    url.searchParams.set('from', String(Math.floor(fromMs / 1000)));
    url.searchParams.set('to', String(Math.floor(toMs / 1000)));
    const aggregateWeeks = request?.interval === '1w';
    const timeframe = aggregateWeeks
      ? '1D'
      : request?.interval === '1d'
        ? '1D'
        : String(intervalMs / 60_000);
    url.searchParams.set('tf', timeframe);
    url.searchParams.set('symbol', `${asset.toUpperCase()}IDR`);
    const raw = candlesSchema.parse(await fetchPublicJson(url, HOSTS, signal));
    return aggregateWeeks
      ? aggregateDailyWeeks(raw).slice(-limit)
      : raw.slice(-limit).map((candle) => mapCandle(candle, intervalMs));
  }
}

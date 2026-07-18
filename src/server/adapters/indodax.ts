import { z } from 'zod';
import Decimal from 'decimal.js';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
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

  async getCandles(asset: string, signal?: AbortSignal): Promise<MarketCandle[]> {
    const now = Math.floor(Date.now() / 1000);
    const url = new URL('https://indodax.com/tradingview/history_v2');
    url.searchParams.set('from', String(now - 25 * 60 * 60));
    url.searchParams.set('to', String(now));
    url.searchParams.set('tf', '60');
    url.searchParams.set('symbol', `${asset.toUpperCase()}IDR`);
    const raw = candlesSchema.parse(await fetchPublicJson(url, HOSTS, signal));
    return raw.slice(-24).map((candle) => ({
      openedAt: new Date(new Decimal(candle.Time).mul(1000).toNumber()).toISOString(),
      closedAt: new Date(
        new Decimal(candle.Time).mul(1000).plus(3_599_999).toNumber(),
      ).toISOString(),
      open: candle.Open,
      high: candle.High,
      low: candle.Low,
      close: candle.Close,
      baseVolume: candle.Volume,
    }));
  }
}

import { z } from 'zod';
import Decimal from 'decimal.js';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import type { MarketCandle, MarketTicker, MarketTrade } from '@shared/contracts.js';
import { decimalPlacesRule } from '@server/domain/increments.js';
import { fetchPublicJson, nowIso } from './http.js';

const HOSTS = ['api.reku.id'] as const;

const marketSchema = z.array(
  z.object({
    id: z.string().optional(),
    cd: z.string(),
    status: z.string(),
    price_decimals: z.string().optional(),
    volume_decimals: z.string().optional(),
  }),
);

const entrySchema = z.tuple([z.string(), z.string(), z.string()]);
const bookSchema = z.object({ b: z.array(entrySchema), s: z.array(entrySchema) });

const tickerSchema = z.object({
  id: z.string(),
  cd: z.string(),
  c: z.string(),
  h: z.string(),
  l: z.string(),
  o: z.string(),
  v: z.string(),
  bp: z.string().optional(),
  sp: z.string().optional(),
  cp24h: z.string().optional(),
});
const tickersSchema = z.array(tickerSchema);
const candleTupleSchema = z.tuple([
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
const candlesSchema = z.array(candleEntrySchema);

function rekuTime(value: string): string {
  const milliseconds = value.length >= 13 ? new Decimal(value) : new Decimal(value).mul(1000);
  return new Date(milliseconds.toNumber()).toISOString();
}

export class RekuAdapter implements VenueAdapter {
  readonly venue = 'REKU' as const;
  private readonly idByAsset = new Map<string, string>();

  async discover(signal?: AbortSignal): Promise<VenueInstrument[]> {
    const raw = await fetchPublicJson(new URL('https://api.reku.id/v3/market'), HOSTS, signal);
    const metadataVersion = 'reku-market-v3';
    return marketSchema.parse(raw).map((market) => {
      const asset = market.cd.toUpperCase();
      if (market.id) this.idByAsset.set(asset, market.id);
      return {
        venue: this.venue,
        marketSegment: 'spot',
        venueSymbol: `${asset}_IDR`,
        baseAsset: asset,
        quoteAsset: 'IDR',
        active: market.status === '1',
        directIdr: true,
        marketPriceIncrementRule: decimalPlacesRule(
          'price_decimals',
          market.price_decimals,
          metadataVersion,
        ),
        marketQuantityIncrementRule: decimalPlacesRule(
          'volume_decimals',
          market.volume_decimals,
          metadataVersion,
        ),
        metadataVersion,
      };
    });
  }

  async getBook(asset: string, signal?: AbortSignal): Promise<CanonicalBook> {
    const venueSymbol = `${asset.toUpperCase()}_IDR`;
    const url = new URL('https://api.reku.id/v2/orderbook');
    url.searchParams.set('symbol', venueSymbol);
    const raw = bookSchema.parse(await fetchPublicJson(url, HOSTS, signal));
    const receivedAt = nowIso();
    return validateBook({
      schemaVersion: '1',
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol,
      canonicalInstrument: { baseAsset: asset, quoteAsset: 'IDR' },
      bids: raw.b.map(([, price, quantity]) => ({ price, quantity })),
      asks: raw.s.map(([, price, quantity]) => ({ price, quantity })),
      receivedAt,
      processedAt: nowIso(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    });
  }

  async getCoinId(asset: string, signal?: AbortSignal): Promise<string> {
    let id = this.idByAsset.get(asset.toUpperCase());
    if (!id) {
      await this.discover(signal);
      id = this.idByAsset.get(asset.toUpperCase());
    }
    if (!id) throw new Error('reku_instrument_id_missing');
    return id;
  }

  async listTickers(signal?: AbortSignal): Promise<MarketTicker[]> {
    const raw = tickersSchema.parse(
      await fetchPublicJson(new URL('https://api.reku.id/v3/market'), HOSTS, signal),
    );
    const receivedAt = nowIso();
    return raw.map((ticker) => {
      const asset = ticker.cd.toUpperCase();
      this.idByAsset.set(asset, ticker.id);
      return {
        venue: this.venue,
        venueSymbol: `${asset}_IDR`,
        lastPrice: ticker.c,
        // Reku labels these from the user's action: `sp` is the sell-to-book price
        // (canonical bid) and `bp` is the buy-from-book price (canonical ask).
        bestBid: ticker.sp,
        bestAsk: ticker.bp,
        high24h: ticker.h,
        low24h: ticker.l,
        open24h: ticker.o,
        priceChangePercent24h: ticker.cp24h,
        quoteVolume24h: ticker.v,
        receivedAt,
      };
    });
  }

  async getTrades(): Promise<MarketTrade[] | undefined> {
    return undefined;
  }

  async getCandles(asset: string, signal?: AbortSignal): Promise<MarketCandle[]> {
    let id = this.idByAsset.get(asset.toUpperCase());
    if (!id) {
      await this.listTickers(signal);
      id = this.idByAsset.get(asset.toUpperCase());
    }
    if (!id) throw new Error('reku_instrument_id_missing');
    const url = new URL('https://api.reku.id/v2/chart');
    url.searchParams.set('id', id);
    url.searchParams.set('f', '60');
    const raw = candlesSchema.parse(await fetchPublicJson(url, HOSTS, signal));
    return raw.slice(-24).map(([time, open, close, low, high, baseVolume, quoteVolume]) => ({
      openedAt: rekuTime(time),
      closedAt: new Date(Date.parse(rekuTime(time)) + 3_599_999).toISOString(),
      open,
      high,
      low,
      close,
      baseVolume,
      quoteVolume,
    }));
  }
}

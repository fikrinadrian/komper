import { z } from 'zod';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import { decimalPlacesRule } from '@server/domain/increments.js';
import { fetchPublicJson, nowIso } from './http.js';

const HOSTS = ['api.reku.id'] as const;

const marketSchema = z.array(
  z.object({
    cd: z.string(),
    status: z.string(),
    price_decimals: z.string().optional(),
    volume_decimals: z.string().optional(),
  }),
);

const entrySchema = z.tuple([z.string(), z.string(), z.string()]);
const bookSchema = z.object({ b: z.array(entrySchema), s: z.array(entrySchema) });

export class RekuAdapter implements VenueAdapter {
  readonly venue = 'REKU' as const;

  async discover(signal?: AbortSignal): Promise<VenueInstrument[]> {
    const raw = await fetchPublicJson(new URL('https://api.reku.id/v3/market'), HOSTS, signal);
    const metadataVersion = 'reku-market-v3';
    return marketSchema.parse(raw).map((market) => ({
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol: `${market.cd.toUpperCase()}_IDR`,
      baseAsset: market.cd.toUpperCase(),
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
    }));
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
}

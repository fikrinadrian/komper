import { z } from 'zod';
import { validateBook } from '@server/domain/orderbook.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
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
}

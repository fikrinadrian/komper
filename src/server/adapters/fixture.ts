import Decimal from 'decimal.js';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import type { Venue } from '@shared/contracts.js';
import { stepRule } from '@server/domain/increments.js';

export const FIXTURE_ASSETS = [
  'ADA',
  'ARB',
  'AVAX',
  'BNB',
  'BTC',
  'DOGE',
  'DRX',
  'ETH',
  'HBAR',
  'POL',
  'RENDER',
  'SOL',
  'SUI',
  'USDC',
  'USDT',
  'WIF',
  'WLD',
  'XRP',
] as const;

const BASE_PRICES: Record<string, string> = {
  BTC: '1000000000',
  ETH: '50000000',
  SOL: '2500000',
  BNB: '10000000',
  USDT: '16500',
  USDC: '16480',
};

const VENUE_FACTOR: Record<Venue, string> = {
  INDODAX: '1',
  REKU: '0.998',
  TOKOCRYPTO: '1.003',
};

export class FixtureAdapter implements VenueAdapter {
  constructor(readonly venue: Venue) {}

  async discover(): Promise<VenueInstrument[]> {
    const metadataVersion = `fixture-${this.venue.toLowerCase()}-v1`;
    return FIXTURE_ASSETS.map((asset) => ({
      venue: this.venue,
      marketSegment: this.venue === 'TOKOCRYPTO' ? 'spot-type-1' : 'spot',
      venueSymbol: this.symbol(asset),
      baseAsset: asset,
      quoteAsset: 'IDR',
      active: true,
      directIdr: true,
      minimumNotional: '10000',
      minimumQuantity: '0.00000001',
      marketPriceIncrementRule: stepRule('fixture.priceStep', '0.01', metadataVersion),
      marketQuantityIncrementRule: stepRule('fixture.quantityStep', '0.00000001', metadataVersion),
      metadataVersion,
    }));
  }

  async getBook(asset: string): Promise<CanonicalBook> {
    if (asset === 'DRX' && this.venue !== 'INDODAX') throw new Error('fixture_venue_outage');
    const reference = new Decimal(BASE_PRICES[asset] ?? '10000').mul(VENUE_FACTOR[this.venue]);
    const bid = reference.mul('0.999').toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const ask = reference.mul('1.001').toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const secondBid = bid.mul('0.997').toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const secondAsk = ask.mul('1.003').toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const quantity = asset === 'HBAR' && this.venue === 'TOKOCRYPTO' ? '2' : '100000';
    const receivedAt = new Date().toISOString();
    const book: CanonicalBook = {
      schemaVersion: '1',
      venue: this.venue,
      marketSegment: this.venue === 'TOKOCRYPTO' ? 'spot-type-1' : 'spot',
      venueSymbol: this.symbol(asset),
      canonicalInstrument: { baseAsset: asset, quoteAsset: 'IDR' },
      bids: [
        { price: bid.toFixed(), quantity },
        { price: secondBid.toFixed(), quantity },
      ],
      asks: [
        { price: ask.toFixed(), quantity },
        { price: secondAsk.toFixed(), quantity },
      ],
      receivedAt,
      processedAt: receivedAt,
      freshnessIndependentlyVerified: this.venue === 'TOKOCRYPTO',
      synchronization: 'SNAPSHOT',
      minimumNotional: '10000',
    };
    if (asset === 'WIF' && this.venue === 'INDODAX') {
      book.bids[0].price = ask.mul('1.1').toFixed();
    }
    return book;
  }

  private symbol(asset: string): string {
    if (this.venue === 'INDODAX') return `${asset.toLowerCase()}idr`;
    return `${asset}_IDR`;
  }
}

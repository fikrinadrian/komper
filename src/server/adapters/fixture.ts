import Decimal from 'decimal.js';
import type {
  CanonicalBook,
  MarketCandleRequest,
  VenueAdapter,
  VenueInstrument,
} from '@server/domain/types.js';
import type { MarketCandle, MarketTicker, MarketTrade, Venue } from '@shared/contracts.js';
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

  async listTickers(): Promise<MarketTicker[]> {
    const receivedAt = new Date().toISOString();
    return FIXTURE_ASSETS.map((asset) => {
      const reference = new Decimal(BASE_PRICES[asset] ?? '10000').mul(VENUE_FACTOR[this.venue]);
      return {
        venue: this.venue,
        venueSymbol: this.symbol(asset),
        lastPrice: reference.toFixed(2),
        bestBid: reference.mul('0.999').toFixed(2),
        bestAsk: reference.mul('1.001').toFixed(2),
        high24h: reference.mul('1.025').toFixed(2),
        low24h: reference.mul('0.975').toFixed(2),
        open24h: reference.mul('0.992').toFixed(2),
        priceChangePercent24h: '0.81',
        baseVolume24h: '125.5',
        quoteVolume24h: reference.mul('125.5').toFixed(2),
        sourceEventAt: receivedAt,
        receivedAt,
      };
    });
  }

  async getTrades(asset: string): Promise<MarketTrade[]> {
    const reference = new Decimal(BASE_PRICES[asset] ?? '10000').mul(VENUE_FACTOR[this.venue]);
    const now = Date.now();
    return Array.from({ length: 12 }, (_, index) => ({
      id: `${this.venue}-${asset}-${index}`,
      price: reference.mul(new Decimal(1).plus(new Decimal(index - 6).mul('0.0004'))).toFixed(2),
      quantity: new Decimal('0.02').mul(index + 1).toFixed(4),
      side: index % 3 === 0 ? ('sell' as const) : ('buy' as const),
      occurredAt: new Date(now - index * 90_000).toISOString(),
    }));
  }

  async getCandles(asset: string, request?: MarketCandleRequest): Promise<MarketCandle[]> {
    const reference = new Decimal(BASE_PRICES[asset] ?? '10000').mul(VENUE_FACTOR[this.venue]);
    const venueOffset = this.venue === 'INDODAX' ? 0 : this.venue === 'REKU' ? 1 : 2;
    const intervalMs = request?.intervalMs ?? 3_600_000;
    const limit = request?.limit ?? 24;
    const mondayAnchorMs = 4 * 86_400_000;
    const currentBucket =
      request?.interval === '1w'
        ? Math.floor((Date.now() - mondayAnchorMs) / intervalMs) * intervalMs + mondayAnchorMs
        : Math.floor(Date.now() / intervalMs) * intervalMs;
    const latestClosedBucket = currentBucket - intervalMs;
    return Array.from({ length: limit }, (_, index) => {
      const openedAt = latestClosedBucket - (limit - 1 - index) * intervalMs;
      const movement = new Decimal(index - Math.floor(limit / 2))
        .mul(new Decimal('0.0168').div(Math.max(limit, 1)))
        .plus(new Decimal(((index + venueOffset) % 5) - 2).mul('0.0012'));
      const open = reference.mul(new Decimal(1).plus(movement));
      const close = open.mul(new Decimal(1).plus(new Decimal((index % 3) - 1).mul('0.0008')));
      return {
        openedAt: new Date(openedAt).toISOString(),
        closedAt: new Date(openedAt + intervalMs - 1).toISOString(),
        open: open.toFixed(2),
        high: Decimal.max(open, close).mul('1.0015').toFixed(2),
        low: Decimal.min(open, close).mul('0.9985').toFixed(2),
        close: close.toFixed(2),
        baseVolume: new Decimal(10 + index).toFixed(),
        quoteVolume: reference.mul(10 + index).toFixed(2),
        tradeCount: 20 + index,
      };
    });
  }

  private symbol(asset: string): string {
    if (this.venue === 'INDODAX') return `${asset.toLowerCase()}idr`;
    return `${asset}_IDR`;
  }
}

import type {
  IncrementRule,
  MarketCandle,
  MarketCandleInterval,
  MarketChartPeriod,
  MarketTicker,
  MarketTrade,
  Venue,
} from '@shared/contracts.js';

export type BookLevel = { price: string; quantity: string };

export type CanonicalBook = {
  schemaVersion: '1';
  venue: Venue;
  marketSegment: string;
  venueSymbol: string;
  canonicalInstrument: { baseAsset: string; quoteAsset: 'IDR' };
  bids: BookLevel[];
  asks: BookLevel[];
  sourceEventAt?: string;
  receivedAt: string;
  processedAt: string;
  freshnessIndependentlyVerified: boolean;
  synchronization: 'SNAPSHOT';
  quantityLevelSemantics?: 'EXECUTABLE_INCREMENT' | 'DERIVED_FROM_NOTIONAL';
  minimumNotional?: string;
};

export type VenueInstrument = {
  venue: Venue;
  marketSegment: string;
  venueSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  active: boolean;
  directIdr: boolean;
  minimumNotional?: string;
  minimumQuantity?: string;
  marketPriceIncrementRule: IncrementRule;
  marketQuantityIncrementRule: IncrementRule;
  buyQuoteIncrementRule?: IncrementRule;
  buyOutcomeIncrementRule?: IncrementRule;
  metadataVersion: string;
};

export type MarketCandleRequest = {
  period: MarketChartPeriod;
  interval: MarketCandleInterval;
  intervalMs: number;
  limit: number;
  fromMs: number;
  toMs: number;
};

export interface VenueAdapter {
  readonly venue: Venue;
  discover(signal?: AbortSignal): Promise<VenueInstrument[]>;
  getBook(asset: string, signal?: AbortSignal): Promise<CanonicalBook>;
  listTickers?(signal?: AbortSignal): Promise<MarketTicker[]>;
  getTrades?(asset: string, signal?: AbortSignal): Promise<MarketTrade[] | undefined>;
  getCandles?(
    asset: string,
    request?: MarketCandleRequest,
    signal?: AbortSignal,
  ): Promise<MarketCandle[]>;
}

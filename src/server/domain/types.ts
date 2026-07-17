import type { IncrementRule, Venue } from '@shared/contracts.js';

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
  metadataVersion: string;
};

export interface VenueAdapter {
  readonly venue: Venue;
  discover(signal?: AbortSignal): Promise<VenueInstrument[]>;
  getBook(asset: string, signal?: AbortSignal): Promise<CanonicalBook>;
}

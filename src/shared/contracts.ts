import { z } from 'zod';

export const venueSchema = z.enum(['INDODAX', 'REKU', 'TOKOCRYPTO']);
export const sideSchema = z.enum(['buy', 'sell']);
export const decimalInputSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?$/, 'Gunakan angka positif tanpa pemisah ribuan.')
  .refine((value) => !/^0+(?:\.0+)?$/.test(value), 'Nilai harus lebih besar dari nol.');

export const comparisonRequestSchema = z.object({
  asset: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/),
  side: sideSchema,
  amount: decimalInputSchema,
});

export type Venue = z.infer<typeof venueSchema>;
export type Side = z.infer<typeof sideSchema>;

export type CoverageVenueState = {
  venue: Venue;
  available: boolean;
  venueSymbol?: string;
  marketSegment?: string;
  reason?: string;
};

export type CatalogInstrument = {
  asset: string;
  quote: 'IDR';
  selectable: boolean;
  coverage: CoverageVenueState[];
};

export type CatalogResponse = {
  schemaVersion: '1';
  generatedAt: string;
  instruments: CatalogInstrument[];
  requiredVenueCount: 3;
  sourceStatus: Array<{ venue: Venue; ok: boolean; reason?: string }>;
};

export type EstimateStatus =
  | 'ELIGIBLE'
  | 'INSUFFICIENT_DEPTH'
  | 'BELOW_MINIMUM'
  | 'STALE'
  | 'UNSYNCED'
  | 'SCHEMA_ERROR'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'UNVERIFIED_RULES';

export type MarketTransport =
  'REST_SNAPSHOT' | 'REST_POLL' | 'WS_FULL_SNAPSHOT' | 'WS_SEQUENCED_DELTA';

export type MarketSynchronization =
  'SYNCHRONIZED' | 'SYNCHRONIZING' | 'GAPPED' | 'RECONNECTING' | 'STOPPED';

export type IncrementRule = {
  state: 'VERIFIED' | 'DISABLED' | 'UNVERIFIED';
  normalizedStep?: string;
  sourceField: string;
  sourceValue?: string;
  sourceSemantics: 'STEP_SIZE' | 'DECIMAL_PLACES' | 'EXPLICITLY_DISABLED';
  metadataVersion: string;
  verifiedAt?: string;
  evidenceClass?: 'VENUE_API_DOCUMENTED' | 'OFFICIAL_WEB_CLIENT_OBSERVED';
  sourceUrl?: string;
  capturedAt?: string;
  contentSha256?: string;
};

export type FeeAssumption = {
  status: 'VERIFIED' | 'UNVERIFIED';
  rate?: string;
  source?: string;
  asOf?: string;
  version?: string;
};

export type VenueEstimate = {
  venue: Venue;
  marketSegment: string;
  venueSymbol: string;
  status: EstimateStatus;
  statusReason?: string;
  grossOutcome?: string;
  outcomeAsset: string;
  grossAveragePrice?: string;
  topOfBookPrice?: string;
  slippageBps?: string;
  requestedAmount: string;
  filledInput?: string;
  unfilledInput?: string;
  requestedQuoteBudget?: string;
  requestedBaseQuantity?: string;
  executableBaseQuantity?: string;
  filledNotional?: string;
  unspentQuoteAmount?: string;
  unsoldBaseAmount?: string;
  quantizationAdjustment?: string;
  roundingMode?: 'FLOOR';
  levelsConsumed?: number;
  priceIncrementRule: IncrementRule;
  quantityIncrementRule: IncrementRule;
  inputIncrementRule?: IncrementRule;
  inputDenomination?: 'BASE' | 'QUOTE';
  ruleMetadataVersion: string;
  fee: FeeAssumption;
  estimatedFee?: string;
  netOutcome?: string;
  sourceEventAt?: string;
  receivedAt?: string;
  ageMs?: number;
  freshnessIndependentlyVerified: boolean;
  externalUrl: string;
  transport?: MarketTransport;
  synchronization?: MarketSynchronization;
  connectionEpoch?: number;
  liveRevision?: number;
  healthReason?: string;
};

export type ComparisonResponse = {
  schemaVersion: '1';
  request: { asset: string; quote: 'IDR'; side: Side; amount: string };
  generatedAt: string;
  rankingBasis: 'GROSS' | 'NET' | 'NONE';
  winner?: Venue;
  winnerLabel?: string;
  eligibleVenueCount: number;
  results: VenueEstimate[];
  disclosure: string;
  exclusions: string[];
  streamRevision?: number;
};

export type MarketDataStatus = 'AVAILABLE' | 'STALE' | 'UNAVAILABLE' | 'UNSUPPORTED';

export type MarketComponentState = {
  status: MarketDataStatus;
  reason?: string;
};

export type MarketTicker = {
  venue: Venue;
  venueSymbol: string;
  lastPrice: string;
  bestBid?: string;
  bestAsk?: string;
  high24h?: string;
  low24h?: string;
  open24h?: string;
  priceChangePercent24h?: string;
  baseVolume24h?: string;
  quoteVolume24h?: string;
  sourceEventAt?: string;
  receivedAt: string;
};

export type MarketOverviewVenue = {
  venue: Venue;
  status: MarketDataStatus;
  ticker?: MarketTicker;
  reason?: string;
};

export type MarketOverviewRow = {
  pair: string;
  asset: string;
  quote: 'IDR';
  venues: MarketOverviewVenue[];
};

export type MarketsResponse = {
  schemaVersion: '1';
  generatedAt: string;
  rows: MarketOverviewRow[];
  disclosure: string;
};

export type MarketTrade = {
  id: string;
  price: string;
  quantity: string;
  side?: Side;
  occurredAt: string;
};

export type MarketCandle = {
  openedAt: string;
  closedAt?: string;
  open: string;
  high: string;
  low: string;
  close: string;
  baseVolume?: string;
  quoteVolume?: string;
  tradeCount?: number;
};

export const marketChartPeriodSchema = z.enum(['1d', '1w', '1y', 'all']);
export type MarketChartPeriod = z.infer<typeof marketChartPeriodSchema>;
export type MarketCandleInterval = '1h' | '4h' | '1d' | '1w';

export type MarketOrderBook = {
  bids: Array<{ price: string; quantity: string }>;
  asks: Array<{ price: string; quantity: string }>;
  sourceEventAt?: string;
  receivedAt: string;
  freshnessIndependentlyVerified: boolean;
};

export type MarketDetailVenue = {
  venue: Venue;
  marketSegment: string;
  venueSymbol: string;
  status: MarketDataStatus;
  reason?: string;
  ticker?: MarketTicker;
  orderBook?: MarketOrderBook;
  trades?: MarketTrade[];
  tradeSampleStatus: MarketDataStatus;
  candles?: MarketCandle[];
  components: {
    ticker: MarketComponentState;
    orderBook: MarketComponentState;
    trades: MarketComponentState;
    candles: MarketComponentState;
  };
};

export type MarketDetailResponse = {
  schemaVersion: '1';
  pair: string;
  asset: string;
  quote: 'IDR';
  interval: '1h';
  generatedAt: string;
  venues: MarketDetailVenue[];
  disclosure: string;
};

export type MarketChartVenue = {
  venue: Venue;
  marketSegment: string;
  venueSymbol: string;
  status: MarketDataStatus;
  reason?: string;
  expectedBuckets?: number;
  coverageStartAt?: string;
  coverageEndAt?: string;
  candles: MarketCandle[];
};

export type MarketChartResponse = {
  schemaVersion: '1';
  pair: string;
  asset: string;
  quote: 'IDR';
  period: MarketChartPeriod;
  interval: MarketCandleInterval;
  requestedFromAt: string;
  requestedToAt: string;
  maxBucketsPerVenue: number;
  generatedAt: string;
  venues: MarketChartVenue[];
  disclosure: string;
};

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

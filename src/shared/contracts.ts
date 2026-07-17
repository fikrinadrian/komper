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

export type IncrementRule = {
  state: 'VERIFIED' | 'DISABLED' | 'UNVERIFIED';
  normalizedStep?: string;
  sourceField: string;
  sourceValue?: string;
  sourceSemantics: 'STEP_SIZE' | 'DECIMAL_PLACES' | 'EXPLICITLY_DISABLED';
  metadataVersion: string;
  verifiedAt?: string;
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
  ruleMetadataVersion: string;
  fee: FeeAssumption;
  estimatedFee?: string;
  netOutcome?: string;
  sourceEventAt?: string;
  receivedAt?: string;
  ageMs?: number;
  freshnessIndependentlyVerified: boolean;
  externalUrl: string;
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
};

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

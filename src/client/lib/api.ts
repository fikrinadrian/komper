import type {
  ApiError,
  CatalogResponse,
  ComparisonResponse,
  MarketDetailResponse,
  MarketsResponse,
  Side,
  Venue,
} from '@shared/contracts.js';
import { z } from 'zod';

const liveComparisonSchema = z
  .object({
    schemaVersion: z.literal('1'),
    request: z.object({
      asset: z.string(),
      quote: z.literal('IDR'),
      side: z.enum(['buy', 'sell']),
      amount: z.string(),
    }),
    generatedAt: z.string(),
    rankingBasis: z.enum(['GROSS', 'NET', 'NONE']),
    eligibleVenueCount: z.number().int().min(0).max(3),
    results: z.array(z.object({ venue: z.string(), status: z.string() }).passthrough()),
    disclosure: z.string(),
    exclusions: z.array(z.string()),
    streamRevision: z.number().int().nonnegative().optional(),
  })
  .passthrough();

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ApiError;
  if (!response.ok) {
    const message =
      'error' in (payload as ApiError) ? (payload as ApiError).error.message : 'Gagal memuat data.';
    throw new Error(message);
  }
  return payload as T;
}

export async function getCatalog(): Promise<CatalogResponse> {
  return readJson<CatalogResponse>(
    await fetch('/api/catalog', { headers: { accept: 'application/json' } }),
  );
}

export async function getComparison(input: {
  asset: string;
  side: Side;
  amount: string;
}): Promise<ComparisonResponse> {
  const params = new URLSearchParams(input);
  return readJson<ComparisonResponse>(
    await fetch(`/api/comparisons?${params}`, { headers: { accept: 'application/json' } }),
  );
}

export type LiveConnectionState = 'connecting' | 'live' | 'reconnecting';

export function subscribeLiveComparison(
  input: { asset: string; side: Side; amount: string },
  onComparison: (comparison: ComparisonResponse) => void,
  onState: (state: LiveConnectionState) => void,
): () => void {
  const params = new URLSearchParams(input);
  const source = new EventSource(`/api/live/comparisons?${params}`);
  onState('connecting');
  source.onopen = () => onState('live');
  source.onerror = () => onState('reconnecting');
  source.addEventListener('comparison', (event) => {
    try {
      const payload = liveComparisonSchema.parse(JSON.parse((event as MessageEvent<string>).data));
      onComparison(payload as unknown as ComparisonResponse);
    } catch {
      onState('reconnecting');
    }
  });
  return () => source.close();
}

export async function getMarkets(): Promise<MarketsResponse> {
  return readJson<MarketsResponse>(
    await fetch('/api/markets', { headers: { accept: 'application/json' } }),
  );
}

export async function getMarketDetail(pair: string): Promise<MarketDetailResponse> {
  return readJson<MarketDetailResponse>(
    await fetch(`/api/markets/${encodeURIComponent(pair)}`, {
      headers: { accept: 'application/json' },
    }),
  );
}

type ProductEvent = {
  event:
    'comparison_requested' | 'comparison_succeeded' | 'comparison_failed' | 'exchange_link_opened';
  pair: string;
  side: Side;
  sizeBucket: 'small' | 'medium' | 'large';
  venue?: Venue;
  eligibleVenueCount?: number;
};

export function track(event: ProductEvent): void {
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  });
}

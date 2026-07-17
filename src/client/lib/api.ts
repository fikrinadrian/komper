import type {
  ApiError,
  CatalogResponse,
  ComparisonResponse,
  Side,
  Venue,
} from '@shared/contracts.js';

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

import JSONbig from 'json-bigint';

// Parse every JSON number token as a string. This prevents exchange prices, quantities,
// identifiers, and notional filters from crossing a binary floating-point boundary.
const parser = JSONbig({ storeAsString: true, alwaysParseAsBig: true, strict: true });
const MAX_RESPONSE_BYTES = 2_000_000;

function normalizeJsonNumbers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJsonNumbers);
  if (value && typeof value === 'object') {
    if (value.constructor?.name === 'BigNumber') return String(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        normalizeJsonNumbers(child),
      ]),
    );
  }
  return value;
}

export async function fetchPublicJson(
  url: URL,
  allowedHosts: readonly string[],
  signal?: AbortSignal,
): Promise<unknown> {
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) {
    throw new Error('endpoint_not_allowed');
  }

  const timeout = AbortSignal.timeout(6_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(url, {
    signal: combined,
    redirect: 'error',
    headers: { accept: 'application/json', 'user-agent': 'komper-market-lens/0.1' },
  });
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('upstream_response_too_large');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('upstream_response_too_large');
  }
  try {
    return normalizeJsonNumbers(parser.parse(text));
  } catch {
    throw new Error('upstream_invalid_json');
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

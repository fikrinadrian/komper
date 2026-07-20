import type { IncrementRule } from '@shared/contracts.js';
import { decimalPlacesRule, stepRule } from '@server/domain/increments.js';

// Internal-evaluation evidence captured from Reku's official advanced-trade client.
// Source: https://reku.id/_next/static/chunks/pages/trade/%5Bsymbol%5D-734b58cded9e0058.js
// Captured: 2026-07-19
// SHA-256: f70980ea71240a3c9abeb080fb8707fd065714a24b8986a73fc04094634a943b
// The client accepts whole-IDR buy input, 8dp base sell input, and floors buy
// outcome estimates to 8dp. This is observed client compatibility evidence,
// not a guarantee from Reku's matching-engine API.
export const REKU_CLIENT_RULE_VERSION = 'reku-web-trade-734b58cded9e0058+sha256-f70980ea71240a3c';

const evidence = {
  evidenceClass: 'OFFICIAL_WEB_CLIENT_OBSERVED' as const,
  sourceUrl: 'https://reku.id/_next/static/chunks/pages/trade/%5Bsymbol%5D-734b58cded9e0058.js',
  capturedAt: '2026-07-19',
};

function withEvidence(rule: IncrementRule): IncrementRule {
  return { ...rule, ...evidence, verifiedAt: evidence.capturedAt };
}

export function rekuPriceRule(
  sourceValue: string | undefined,
  metadataVersion: string,
): IncrementRule {
  return withEvidence(stepRule('digits', sourceValue, metadataVersion));
}

export function rekuBuyQuoteRule(metadataVersion: string): IncrementRule {
  return withEvidence(stepRule('officialWebClient.buy.amount.scale', '1', metadataVersion));
}

export function rekuSellBaseRule(metadataVersion: string): IncrementRule {
  return withEvidence(
    decimalPlacesRule('officialWebClient.sell.amount.scale', '8', metadataVersion),
  );
}

export function rekuBuyOutcomeRule(metadataVersion: string): IncrementRule {
  return withEvidence(
    decimalPlacesRule('officialWebClient.buy.estimation.scale', '8', metadataVersion),
  );
}

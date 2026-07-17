import { describe, expect, it } from 'vitest';
import {
  decimalPlacesRule,
  quantizeDown,
  stepRule,
  unverifiedRule,
  validateBookIncrements,
} from '@server/domain/increments.js';
import type { CanonicalBook } from '@server/domain/types.js';

const metadataVersion = 'test-v1';

describe('provenance-bearing increment rules', () => {
  it('maps only an explicitly decimal-count field to an exact 10^-n step', () => {
    expect(decimalPlacesRule('price_round', '8', metadataVersion)).toEqual({
      state: 'VERIFIED',
      normalizedStep: '0.00000001',
      sourceField: 'price_round',
      sourceValue: '8',
      sourceSemantics: 'DECIMAL_PLACES',
      metadataVersion,
      verifiedAt: '2026-07-17',
    });
    expect(stepRule('stepSize', '8', metadataVersion).normalizedStep).toBe('8');
  });

  it('floors quantities on the exact decimal lattice', () => {
    const rule = stepRule('stepSize', '0.00000001', metadataVersion);
    expect(quantizeDown('1.000000019999999999', rule)).toBe('1.00000001');
  });

  it('rejects book values that do not align with verified rules', () => {
    const book: CanonicalBook = {
      schemaVersion: '1',
      venue: 'REKU',
      marketSegment: 'spot',
      venueSymbol: 'BTC_IDR',
      canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
      bids: [{ price: '999.001', quantity: '1' }],
      asks: [{ price: '1000.001', quantity: '1' }],
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    };
    expect(() =>
      validateBookIncrements(
        book,
        stepRule('tick', '0.01', metadataVersion),
        stepRule('step', '0.00000001', metadataVersion),
      ),
    ).toThrow('misaligned_rules');
  });

  it('fails closed when a required quantity rule is unverified', () => {
    const book: CanonicalBook = {
      schemaVersion: '1',
      venue: 'REKU',
      marketSegment: 'spot',
      venueSymbol: 'BTC_IDR',
      canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
      bids: [{ price: '999', quantity: '1' }],
      asks: [{ price: '1000', quantity: '1' }],
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    };
    expect(() =>
      validateBookIncrements(
        book,
        stepRule('tick', '1', metadataVersion),
        unverifiedRule('missing', undefined, 'STEP_SIZE', metadataVersion),
      ),
    ).toThrow('unverified_rules');
  });
});

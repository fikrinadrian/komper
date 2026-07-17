import { describe, expect, it } from 'vitest';
import { formatAsset, formatIdr, sizeBucket } from '@client/lib/format.js';

describe('decimal-string-safe financial formatting', () => {
  it('preserves IDR integers beyond JavaScript safe integer precision', () => {
    expect(formatIdr('10000000000000001')).toBe('Rp10.000.000.000.000.001');
  });

  it('preserves asset fractions beyond binary floating-point precision', () => {
    expect(formatAsset('1.000000000000000001', 'BTC', 18)).toBe('1,000000000000000001 BTC');
  });

  it('buckets decimal strings without Number coercion', () => {
    expect(sizeBucket('buy', '50000000.000000000000000001')).toBe('large');
    expect(sizeBucket('sell', '0.999999999999999999')).toBe('small');
  });
});

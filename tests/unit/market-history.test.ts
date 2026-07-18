import { describe, expect, it } from 'vitest';
import { validateMarketCandles } from '@server/domain/market-history.js';
import type { MarketCandle } from '@shared/contracts.js';

function valid(overrides: Partial<MarketCandle> = {}): MarketCandle {
  return {
    openedAt: '2026-07-18T00:00:00.000Z',
    closedAt: '2026-07-18T00:59:59.999Z',
    open: '100',
    high: '110',
    low: '90',
    close: '105',
    ...overrides,
  };
}

describe('market candle validation', () => {
  const afterClose = Date.parse('2026-07-18T01:00:00.000Z');

  it('accepts aligned closed OHLC and excludes an open current bucket', () => {
    expect(validateMarketCandles([valid()], afterClose)).toHaveLength(1);
    expect(
      validateMarketCandles(
        [valid({ openedAt: '2026-07-18T01:00:00.000Z', closedAt: undefined })],
        afterClose,
      ),
    ).toEqual([]);
  });

  it.each([
    valid({ openedAt: '2026-07-18T00:15:00.000Z' }),
    valid({ low: '106' }),
    valid({ high: '99' }),
  ])('quarantines misaligned or invalid OHLC', (candle) => {
    expect(validateMarketCandles([candle], afterClose)).toEqual([]);
  });

  it('turns conflicting duplicate buckets into an explicit gap', () => {
    expect(validateMarketCandles([valid(), valid({ close: '104' })], afterClose)).toEqual([]);
  });
});

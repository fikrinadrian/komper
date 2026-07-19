import { describe, expect, it } from 'vitest';
import { buildAbsoluteChartSeries } from '@client/lib/market-chart.js';
import type { MarketCandle, MarketChartVenue, Venue } from '@shared/contracts.js';

const start = Date.parse('2026-07-18T00:00:00.000Z');

function candle(hour: number, close: string): MarketCandle {
  return {
    openedAt: new Date(start + hour * 3_600_000).toISOString(),
    open: close,
    high: close,
    low: close,
    close,
  };
}

function venue(name: Venue, candles: MarketCandle[]): MarketChartVenue {
  return {
    venue: name,
    marketSegment: 'spot',
    venueSymbol: `BTC_${name}`,
    status: 'AVAILABLE',
    candles,
  };
}

describe('absolute comparative market chart', () => {
  it('keeps absolute close prices and inserts null gaps without connecting them', () => {
    const result = buildAbsoluteChartSeries(
      [
        venue('INDODAX', [candle(0, '100'), candle(1, '110'), candle(3, '121')]),
        venue('REKU', [candle(0, '200'), candle(1, '220'), candle(2, '230'), candle(3, '242')]),
      ],
      '1h',
    );

    expect(result.timestamps).toEqual([
      start,
      start + 3_600_000,
      start + 7_200_000,
      start + 10_800_000,
    ]);
    expect(result.series.map((series) => series.venue)).toEqual(['INDODAX', 'REKU', 'TOKOCRYPTO']);
    expect(result.series[0].points).toEqual([
      [start, 100],
      [start + 3_600_000, 110],
      [start + 7_200_000, null],
      [start + 10_800_000, 121],
    ]);
    expect(result.series[2].points.every((point) => point[1] === null)).toBe(true);
    expect(result.maxOverlappingVenues).toBe(2);
  });

  it('quarantines invalid candles while preserving healthy venue data', () => {
    const invalid = { ...candle(0, '100'), high: '90' };
    const result = buildAbsoluteChartSeries(
      [venue('INDODAX', [invalid]), venue('REKU', [candle(0, '200')])],
      '1h',
    );

    expect(result.series[0].points).toEqual([[start, null]]);
    expect(result.series[1].points).toEqual([[start, 200]]);
    expect(result.maxOverlappingVenues).toBe(1);
  });
});

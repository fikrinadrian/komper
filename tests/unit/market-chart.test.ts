import { describe, expect, it } from 'vitest';
import { buildChartSeries } from '@client/lib/market-chart.js';
import type { MarketCandle, MarketDetailVenue, Venue } from '@shared/contracts.js';

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

function venue(name: Venue, candles: MarketCandle[]): MarketDetailVenue {
  return {
    venue: name,
    marketSegment: 'spot',
    venueSymbol: `BTC_${name}`,
    status: 'AVAILABLE',
    tradeSampleStatus: 'UNAVAILABLE',
    candles,
    components: {
      ticker: { status: 'UNAVAILABLE' },
      orderBook: { status: 'UNAVAILABLE' },
      trades: { status: 'UNAVAILABLE' },
      candles: { status: 'AVAILABLE' },
    },
  };
}

describe('comparative market chart normalization', () => {
  it('uses one shared zero-percent baseline and breaks lines across missing hours', () => {
    const result = buildChartSeries([
      venue('INDODAX', [candle(0, '100'), candle(1, '110'), candle(3, '121')]),
      venue('REKU', [candle(0, '200'), candle(1, '220'), candle(2, '230'), candle(3, '242')]),
    ]);

    expect(result.baseline).toBe(start);
    expect(result.series.map((series) => series.points[0].value)).toEqual([0, 0]);
    expect(result.series[0].points.map((point) => point.value)).toEqual([0, 10, 21]);
    expect(result.series[0].segments).toHaveLength(2);
    expect(result.series[1].segments).toHaveLength(1);
  });

  it('requires at least two venues with a common bucket', () => {
    expect(buildChartSeries([venue('INDODAX', [candle(0, '100')])]).series).toEqual([]);
    expect(
      buildChartSeries([venue('INDODAX', [candle(0, '100')]), venue('REKU', [candle(2, '200')])])
        .series,
    ).toEqual([]);
  });
});

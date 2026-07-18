import Decimal from 'decimal.js';
import type { MarketCandle, MarketDetailVenue, Venue } from '@shared/contracts.js';

export type ChartPoint = { bucket: number; value: number; candle: MarketCandle };
export type ChartSeries = {
  venue: Venue;
  points: ChartPoint[];
  segments: ChartPoint[][];
};

function candleMap(candles: MarketCandle[]): Map<number, MarketCandle> {
  const result = new Map<number, MarketCandle>();
  for (const candle of candles) {
    const time = Date.parse(candle.openedAt);
    try {
      const open = new Decimal(candle.open);
      const high = new Decimal(candle.high);
      const low = new Decimal(candle.low);
      const close = new Decimal(candle.close);
      if (
        !Number.isFinite(time) ||
        time % 3_600_000 !== 0 ||
        result.has(time) ||
        !open.isPositive() ||
        !high.isPositive() ||
        !low.isPositive() ||
        !close.isPositive() ||
        low.greaterThan(open) ||
        low.greaterThan(close) ||
        high.lessThan(open) ||
        high.lessThan(close)
      ) {
        return new Map();
      }
      result.set(time, candle);
    } catch {
      return new Map();
    }
  }
  return result;
}

export function buildChartSeries(venues: MarketDetailVenue[]): {
  series: ChartSeries[];
  baseline?: number;
} {
  const available = venues
    .filter((venue) => venue.status === 'AVAILABLE' && venue.candles?.length)
    .map((venue) => ({ venue: venue.venue, candles: candleMap(venue.candles ?? []) }))
    .filter((venue) => venue.candles.size > 0);
  if (available.length < 2) return { series: [] };

  const commonBuckets = [...available[0].candles.keys()].filter((bucket) =>
    available.every((venue) => venue.candles.has(bucket)),
  );
  const baseline = commonBuckets.sort((a, b) => a - b)[0];
  if (baseline === undefined) return { series: [] };

  const series = available.map((item) => {
    const baselineClose = item.candles.get(baseline)!.close;
    const points = [...item.candles.entries()]
      .filter(([bucket]) => bucket >= baseline)
      .sort(([left], [right]) => left - right)
      .map(([bucket, candle]) => ({
        bucket,
        candle,
        value: new Decimal(candle.close).div(baselineClose).minus(1).mul(100).toNumber(),
      }));
    const segments: ChartPoint[][] = [];
    for (const point of points) {
      const current = segments.at(-1);
      if (!current || point.bucket - current.at(-1)!.bucket !== 3_600_000) segments.push([point]);
      else current.push(point);
    }
    return { venue: item.venue, points, segments };
  });
  return { series, baseline };
}

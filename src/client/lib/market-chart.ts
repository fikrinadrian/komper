import Decimal from 'decimal.js';
import type {
  MarketCandle,
  MarketCandleInterval,
  MarketChartVenue,
  Venue,
} from '@shared/contracts.js';

const VENUES: Venue[] = ['INDODAX', 'REKU', 'TOKOCRYPTO'];

const INTERVAL_MS: Record<MarketCandleInterval, number> = {
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};

export type AbsoluteChartPoint = [timestamp: number, close: number | null];
export type AbsoluteChartSeries = {
  venue: Venue;
  status: MarketChartVenue['status'];
  reason?: string;
  candles: MarketCandle[];
  points: AbsoluteChartPoint[];
};

export type AbsoluteChartModel = {
  series: AbsoluteChartSeries[];
  timestamps: number[];
  maxOverlappingVenues: number;
};

function validCandles(candles: MarketCandle[]): Map<number, MarketCandle> {
  const result = new Map<number, MarketCandle>();
  for (const candle of candles) {
    const timestamp = Date.parse(candle.openedAt);
    try {
      const open = new Decimal(candle.open);
      const high = new Decimal(candle.high);
      const low = new Decimal(candle.low);
      const close = new Decimal(candle.close);
      if (
        !Number.isFinite(timestamp) ||
        result.has(timestamp) ||
        !open.isPositive() ||
        !high.isPositive() ||
        !low.isPositive() ||
        !close.isPositive() ||
        low.greaterThan(open) ||
        low.greaterThan(close) ||
        high.lessThan(open) ||
        high.lessThan(close)
      ) {
        continue;
      }
      result.set(timestamp, candle);
    } catch {
      continue;
    }
  }
  return result;
}

export function buildAbsoluteChartSeries(
  venues: MarketChartVenue[],
  interval: MarketCandleInterval,
): AbsoluteChartModel {
  const intervalMs = INTERVAL_MS[interval];
  const sourceByVenue = new Map(venues.map((venue) => [venue.venue, venue]));
  const candleMaps = new Map(
    VENUES.map((venue) => [venue, validCandles(sourceByVenue.get(venue)?.candles ?? [])]),
  );
  const observed = [...new Set([...candleMaps.values()].flatMap((map) => [...map.keys()]))].sort(
    (left, right) => left - right,
  );

  if (observed.length === 0) {
    return {
      timestamps: [],
      maxOverlappingVenues: 0,
      series: VENUES.map((venue) => ({
        venue,
        status: sourceByVenue.get(venue)?.status ?? 'UNAVAILABLE',
        reason: sourceByVenue.get(venue)?.reason,
        candles: [],
        points: [],
      })),
    };
  }

  const timestamps: number[] = [];
  for (let timestamp = observed[0]; timestamp <= observed.at(-1)!; timestamp += intervalMs) {
    timestamps.push(timestamp);
  }

  const series = VENUES.map((venue) => {
    const source = sourceByVenue.get(venue);
    const candles = candleMaps.get(venue)!;
    return {
      venue,
      status: source?.status ?? 'UNAVAILABLE',
      reason: source?.reason,
      candles: [...candles.values()].sort(
        (left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt),
      ),
      points: timestamps.map((timestamp): AbsoluteChartPoint => [
        timestamp,
        candles.has(timestamp) ? new Decimal(candles.get(timestamp)!.close).toNumber() : null,
      ]),
    };
  });
  return {
    timestamps,
    series,
    maxOverlappingVenues: Math.max(
      ...timestamps.map((_, index) =>
        series.reduce((count, item) => count + (item.points[index]?.[1] === null ? 0 : 1), 0),
      ),
    ),
  };
}

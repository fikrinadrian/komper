import Decimal from 'decimal.js';
import type { MarketCandle } from '@shared/contracts.js';

export const MARKET_CANDLE_INTERVAL_MS = 3_600_000;

export function validateMarketCandles(candles: MarketCandle[], nowMs = Date.now()): MarketCandle[] {
  const validByBucket = new Map<number, MarketCandle>();
  const conflictingBuckets = new Set<number>();
  for (const candle of candles) {
    const openedAt = Date.parse(candle.openedAt);
    if (!Number.isFinite(openedAt) || openedAt % MARKET_CANDLE_INTERVAL_MS !== 0) {
      continue;
    }
    try {
      const open = new Decimal(candle.open);
      const high = new Decimal(candle.high);
      const low = new Decimal(candle.low);
      const close = new Decimal(candle.close);
      if (
        !open.isFinite() ||
        !high.isFinite() ||
        !low.isFinite() ||
        !close.isFinite() ||
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
    } catch {
      continue;
    }

    if (candle.closedAt) {
      const closedAt = Date.parse(candle.closedAt);
      if (
        !Number.isFinite(closedAt) ||
        closedAt < openedAt ||
        closedAt >= openedAt + MARKET_CANDLE_INTERVAL_MS
      ) {
        continue;
      }
    }
    if (openedAt + MARKET_CANDLE_INTERVAL_MS > nowMs) continue;
    if (validByBucket.has(openedAt) || conflictingBuckets.has(openedAt)) {
      validByBucket.delete(openedAt);
      conflictingBuckets.add(openedAt);
      continue;
    }
    validByBucket.set(openedAt, candle);
  }

  return [...validByBucket.values()].sort(
    (left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt),
  );
}

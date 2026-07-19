import Decimal from 'decimal.js';
import type { MarketCandle } from '@shared/contracts.js';

export const MARKET_CANDLE_INTERVAL_MS = 3_600_000;
export const MARKET_DAY_MS = 86_400_000;
export const MARKET_WEEK_MS = 7 * MARKET_DAY_MS;
const MONDAY_UTC_ANCHOR_MS = 4 * MARKET_DAY_MS;

function isAligned(openedAt: number, intervalMs: number): boolean {
  if (intervalMs === MARKET_WEEK_MS) {
    return (openedAt - MONDAY_UTC_ANCHOR_MS) % MARKET_WEEK_MS === 0;
  }
  return openedAt % intervalMs === 0;
}

export function validateMarketCandles(
  candles: MarketCandle[],
  nowMs = Date.now(),
  intervalMs = MARKET_CANDLE_INTERVAL_MS,
): MarketCandle[] {
  const validByBucket = new Map<number, MarketCandle>();
  const conflictingBuckets = new Set<number>();
  for (const candle of candles) {
    const openedAt = Date.parse(candle.openedAt);
    if (!Number.isFinite(openedAt) || !isAligned(openedAt, intervalMs)) {
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
      if (!Number.isFinite(closedAt) || closedAt < openedAt || closedAt >= openedAt + intervalMs) {
        continue;
      }
    }
    if (openedAt + intervalMs > nowMs) continue;
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

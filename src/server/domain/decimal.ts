import Decimal from 'decimal.js';

Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN, toExpNeg: -30, toExpPos: 40 });

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function decimal(value: string, field = 'value'): Decimal {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new Error(`invalid_decimal:${field}`);
  }
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.isNegative()) {
    throw new Error(`invalid_decimal:${field}`);
  }
  return parsed;
}

export function plain(value: Decimal, decimalPlaces = 18): string {
  const fixed = value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_DOWN).toFixed();
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

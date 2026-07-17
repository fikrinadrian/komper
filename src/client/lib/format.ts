import type { Side } from '@shared/contracts.js';

const DECIMAL_STRING = /^(\d+)(?:\.(\d+))?$/;

function parts(value: string): { integer: string; fraction: string } | undefined {
  const match = DECIMAL_STRING.exec(value);
  if (!match) return undefined;
  return { integer: match[1].replace(/^0+(?=\d)/, ''), fraction: match[2] ?? '' };
}

function grouped(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function localized(value: string, maximumFractionDigits: number): string | undefined {
  const parsed = parts(value);
  if (!parsed) return undefined;
  const fraction = parsed.fraction.slice(0, maximumFractionDigits).replace(/0+$/, '');
  return `${grouped(parsed.integer)}${fraction ? `,${fraction}` : ''}`;
}

function compactIdr(value: string): string | undefined {
  const parsed = parts(value);
  if (!parsed) return undefined;
  const scales = [
    { digits: 15, suffix: 'kuadriliun' },
    { digits: 12, suffix: 'T' },
    { digits: 9, suffix: 'M' },
    { digits: 6, suffix: 'jt' },
    { digits: 3, suffix: 'rb' },
  ];
  const scale = scales.find((candidate) => parsed.integer.length > candidate.digits);
  if (!scale) return `Rp${localized(value, 2)}`;
  const wholeLength = parsed.integer.length - scale.digits;
  const whole = parsed.integer.slice(0, wholeLength);
  const fraction = `${parsed.integer.slice(wholeLength)}${parsed.fraction}`
    .slice(0, 2)
    .replace(/0+$/, '');
  return `Rp${whole}${fraction ? `,${fraction}` : ''} ${scale.suffix}`;
}

export function formatIdr(value?: string, compact = false): string {
  if (!value) return '—';
  const formatted = compact ? compactIdr(value) : localized(value, 2);
  return formatted ? (compact ? formatted : `Rp${formatted}`) : `${value} IDR`;
}

export function formatAsset(value: string | undefined, asset: string, digits = 8): string {
  if (!value) return '—';
  const formatted = localized(value, digits);
  return `${formatted ?? value} ${asset}`;
}

export function formatOutcome(value: string | undefined, asset: string): string {
  return asset === 'IDR' ? formatIdr(value) : formatAsset(value, asset);
}

export function formatTime(value?: string): string {
  if (!value) return 'Tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

export function sizeBucket(side: Side, amount: string): 'small' | 'medium' | 'large' {
  const medium = side === 'buy' ? '5000000' : '1';
  const large = side === 'buy' ? '50000000' : '10';
  if (compareDecimalStrings(amount, large) >= 0) return 'large';
  if (compareDecimalStrings(amount, medium) >= 0) return 'medium';
  return 'small';
}

function compareDecimalStrings(left: string, right: string): number {
  const a = parts(left);
  const b = parts(right);
  if (!a || !b) return -1;
  if (a.integer.length !== b.integer.length) return a.integer.length > b.integer.length ? 1 : -1;
  if (a.integer !== b.integer) return a.integer > b.integer ? 1 : -1;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const aFraction = a.fraction.padEnd(width, '0');
  const bFraction = b.fraction.padEnd(width, '0');
  return aFraction === bFraction ? 0 : aFraction > bFraction ? 1 : -1;
}

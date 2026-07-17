import type { IncrementRule } from '@shared/contracts.js';
import { decimal, plain } from './decimal.js';
import type { CanonicalBook } from './types.js';

const VERIFIED_AT = '2026-07-17';

export function stepRule(
  sourceField: string,
  sourceValue: string | undefined,
  metadataVersion: string,
): IncrementRule {
  if (!sourceValue) return unverifiedRule(sourceField, sourceValue, 'STEP_SIZE', metadataVersion);
  try {
    const step = decimal(sourceValue, sourceField);
    if (step.lte(0)) return unverifiedRule(sourceField, sourceValue, 'STEP_SIZE', metadataVersion);
    return {
      state: 'VERIFIED',
      normalizedStep: plain(step, 30),
      sourceField,
      sourceValue,
      sourceSemantics: 'STEP_SIZE',
      metadataVersion,
      verifiedAt: VERIFIED_AT,
    };
  } catch {
    return unverifiedRule(sourceField, sourceValue, 'STEP_SIZE', metadataVersion);
  }
}

export function decimalPlacesRule(
  sourceField: string,
  sourceValue: string | undefined,
  metadataVersion: string,
): IncrementRule {
  if (!sourceValue || !/^\d+$/.test(sourceValue)) {
    return unverifiedRule(sourceField, sourceValue, 'DECIMAL_PLACES', metadataVersion);
  }
  const places = Number(sourceValue);
  if (!Number.isSafeInteger(places) || places < 0 || places > 30) {
    return unverifiedRule(sourceField, sourceValue, 'DECIMAL_PLACES', metadataVersion);
  }
  return {
    state: 'VERIFIED',
    normalizedStep: places === 0 ? '1' : `0.${'0'.repeat(places - 1)}1`,
    sourceField,
    sourceValue,
    sourceSemantics: 'DECIMAL_PLACES',
    metadataVersion,
    verifiedAt: VERIFIED_AT,
  };
}

export function unverifiedRule(
  sourceField: string,
  sourceValue: string | undefined,
  sourceSemantics: IncrementRule['sourceSemantics'],
  metadataVersion: string,
): IncrementRule {
  return { state: 'UNVERIFIED', sourceField, sourceValue, sourceSemantics, metadataVersion };
}

export function quantizeDown(value: string, rule: IncrementRule): string {
  if (rule.state !== 'VERIFIED' || !rule.normalizedStep) throw new Error('unverified_rules');
  const quantity = decimal(value, 'quantity');
  const step = decimal(rule.normalizedStep, 'quantityStep');
  return plain(quantity.div(step).floor().mul(step), 30);
}

export function validateBookIncrements(
  book: CanonicalBook,
  priceRule: IncrementRule,
  quantityRule: IncrementRule,
): void {
  if (priceRule.state === 'UNVERIFIED' || quantityRule.state !== 'VERIFIED') {
    throw new Error('unverified_rules');
  }
  const priceStep =
    priceRule.state === 'VERIFIED' && priceRule.normalizedStep
      ? decimal(priceRule.normalizedStep, 'priceStep')
      : undefined;
  const quantityStep = decimal(quantityRule.normalizedStep!, 'quantityStep');
  for (const level of [...book.bids, ...book.asks]) {
    if (priceStep && !decimal(level.price).mod(priceStep).eq(0))
      throw new Error('misaligned_rules');
    if (!decimal(level.quantity).mod(quantityStep).eq(0)) throw new Error('misaligned_rules');
  }
}

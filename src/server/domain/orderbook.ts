import Decimal from 'decimal.js';
import { decimal, plain } from './decimal.js';
import type { BookLevel, CanonicalBook } from './types.js';

export type WalkResult = {
  grossOutcome: string;
  grossAveragePrice: string;
  topOfBookPrice: string;
  slippageBps: string;
  filledInput: string;
  unfilledInput: string;
  levelsConsumed: number;
  sufficient: boolean;
};

function validateLevels(levels: BookLevel[], side: 'bid' | 'ask'): void {
  if (levels.length === 0) throw new Error('empty_book');
  let prior: Decimal | undefined;
  for (const [index, level] of levels.entries()) {
    const price = decimal(level.price, `${side}[${index}].price`);
    const quantity = decimal(level.quantity, `${side}[${index}].quantity`);
    if (price.lte(0) || quantity.lte(0)) throw new Error('non_positive_book_level');
    if (prior && (side === 'ask' ? price.lt(prior) : price.gt(prior))) {
      throw new Error('unsorted_book');
    }
    prior = price;
  }
}

export function validateBook(book: CanonicalBook): CanonicalBook {
  validateLevels(book.bids, 'bid');
  validateLevels(book.asks, 'ask');
  if (decimal(book.bids[0].price).gte(decimal(book.asks[0].price))) {
    throw new Error('crossed_book');
  }
  return book;
}

export function walkBuy(asks: BookLevel[], budgetValue: string): WalkResult {
  const budget = decimal(budgetValue, 'budget');
  if (budget.lte(0)) throw new Error('invalid_budget');
  let remaining = budget;
  let received = new Decimal(0);
  let spent = new Decimal(0);
  let levelsConsumed = 0;

  for (const level of asks) {
    if (remaining.eq(0)) break;
    const price = decimal(level.price, 'ask.price');
    const available = decimal(level.quantity, 'ask.quantity');
    const levelCost = price.mul(available);
    const spend = Decimal.min(remaining, levelCost);
    const quantity = spend.div(price);
    if (quantity.gt(0)) {
      spent = spent.plus(spend);
      received = received.plus(quantity);
      remaining = remaining.minus(spend);
      levelsConsumed += 1;
    }
  }

  const top = decimal(asks[0].price, 'topAsk');
  const average = received.gt(0) ? spent.div(received) : new Decimal(0);
  const slippage = average.gt(0) ? average.div(top).minus(1).mul(10_000) : new Decimal(0);
  return {
    grossOutcome: plain(received),
    grossAveragePrice: plain(average, 8),
    topOfBookPrice: plain(top),
    slippageBps: plain(slippage, 4),
    filledInput: plain(spent),
    unfilledInput: plain(remaining),
    levelsConsumed,
    sufficient: remaining.eq(0),
  };
}

export function walkBuyQuantity(asks: BookLevel[], quantityValue: string): WalkResult {
  const requested = decimal(quantityValue, 'quantity');
  if (requested.lte(0)) throw new Error('invalid_quantity');
  let remaining = requested;
  let received = new Decimal(0);
  let spent = new Decimal(0);
  let levelsConsumed = 0;

  for (const level of asks) {
    if (remaining.eq(0)) break;
    const price = decimal(level.price, 'ask.price');
    const available = decimal(level.quantity, 'ask.quantity');
    const quantity = Decimal.min(remaining, available);
    if (quantity.gt(0)) {
      received = received.plus(quantity);
      spent = spent.plus(quantity.mul(price));
      remaining = remaining.minus(quantity);
      levelsConsumed += 1;
    }
  }

  const top = decimal(asks[0].price, 'topAsk');
  const average = received.gt(0) ? spent.div(received) : new Decimal(0);
  const slippage = average.gt(0) ? average.div(top).minus(1).mul(10_000) : new Decimal(0);
  return {
    grossOutcome: plain(received),
    grossAveragePrice: plain(average, 8),
    topOfBookPrice: plain(top),
    slippageBps: plain(slippage, 4),
    filledInput: plain(spent),
    unfilledInput: plain(remaining),
    levelsConsumed,
    sufficient: remaining.eq(0),
  };
}

export function walkSell(bids: BookLevel[], quantityValue: string): WalkResult {
  const requested = decimal(quantityValue, 'quantity');
  if (requested.lte(0)) throw new Error('invalid_quantity');
  let remaining = requested;
  let sold = new Decimal(0);
  let proceeds = new Decimal(0);
  let levelsConsumed = 0;

  for (const level of bids) {
    if (remaining.eq(0)) break;
    const price = decimal(level.price, 'bid.price');
    const available = decimal(level.quantity, 'bid.quantity');
    const quantity = Decimal.min(remaining, available);
    if (quantity.gt(0)) {
      sold = sold.plus(quantity);
      proceeds = proceeds.plus(quantity.mul(price));
      remaining = remaining.minus(quantity);
      levelsConsumed += 1;
    }
  }

  const top = decimal(bids[0].price, 'topBid');
  const average = sold.gt(0) ? proceeds.div(sold) : new Decimal(0);
  const slippage = average.gt(0)
    ? new Decimal(1).minus(average.div(top)).mul(10_000)
    : new Decimal(0);
  return {
    grossOutcome: plain(proceeds, 8),
    grossAveragePrice: plain(average, 8),
    topOfBookPrice: plain(top),
    slippageBps: plain(slippage, 4),
    filledInput: plain(sold),
    unfilledInput: plain(remaining),
    levelsConsumed,
    sufficient: remaining.eq(0),
  };
}

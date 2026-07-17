import { describe, expect, it } from 'vitest';
import { validateBook, walkBuy, walkSell } from '@server/domain/orderbook.js';
import type { CanonicalBook } from '@server/domain/types.js';

describe('decimal-safe order book walking', () => {
  it('walks multiple ask levels for an IDR buy budget', () => {
    const result = walkBuy(
      [
        { price: '100', quantity: '2' },
        { price: '110', quantity: '1' },
      ],
      '250',
    );

    expect(result).toEqual({
      grossOutcome: '2.454545454545454545',
      grossAveragePrice: '101.85185185',
      topOfBookPrice: '100',
      slippageBps: '185.1851',
      filledInput: '250',
      unfilledInput: '0',
      levelsConsumed: 2,
      sufficient: true,
    });
  });

  it('walks multiple bid levels for an asset sell quantity', () => {
    const result = walkSell(
      [
        { price: '100', quantity: '2' },
        { price: '90', quantity: '2' },
      ],
      '3',
    );

    expect(result.grossOutcome).toBe('290');
    expect(result.grossAveragePrice).toBe('96.66666666');
    expect(result.slippageBps).toBe('333.3333');
    expect(result.filledInput).toBe('3');
    expect(result.unfilledInput).toBe('0');
    expect(result.levelsConsumed).toBe(2);
  });

  it('reports visible unfilled amount instead of pretending a fill', () => {
    const buy = walkBuy([{ price: '100', quantity: '1' }], '150');
    const sell = walkSell([{ price: '100', quantity: '1' }], '1.5');
    expect(buy.sufficient).toBe(false);
    expect(buy.unfilledInput).toBe('50');
    expect(sell.sufficient).toBe(false);
    expect(sell.unfilledInput).toBe('0.5');
  });

  it('preserves values beyond JavaScript safe integer precision', () => {
    const result = walkBuy(
      [{ price: '10000000000000001', quantity: '1.000000000000000001' }],
      '10000000000000001',
    );
    expect(result.grossOutcome).toBe('1');
    expect(result.filledInput).toBe('10000000000000001');
  });

  it('rejects a crossed book before it can rank', () => {
    const book: CanonicalBook = {
      schemaVersion: '1',
      venue: 'INDODAX',
      marketSegment: 'spot',
      venueSymbol: 'btcidr',
      canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
      bids: [{ price: '101', quantity: '1' }],
      asks: [{ price: '100', quantity: '1' }],
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
    };
    expect(() => validateBook(book)).toThrow('crossed_book');
  });
});

import { describe, expect, it } from 'vitest';
import { TokocryptoBookBuilder } from '@server/live/builders.js';
import type { TokocryptoDelta } from '@server/live/protocols.js';

function delta(
  U: string,
  u: string,
  b: Array<[string, string]> = [],
  a: Array<[string, string]> = [],
): TokocryptoDelta {
  return { e: 'depthUpdate', E: '1720000000000', s: 'BTCIDR', U, u, b, a };
}

const snapshot = {
  lastUpdateId: '100',
  bids: [{ price: '999', quantity: '1' }],
  asks: [
    { price: '1001', quantity: '1' },
    { price: '1002', quantity: '1' },
  ],
  receivedAt: '2026-07-18T00:00:00.000Z',
};

describe('Tokocrypto type-1 local book builder', () => {
  it('buffers, discards stale deltas, accepts first overlap, applies absolute values and zero deletion', () => {
    const builder = new TokocryptoBookBuilder(
      'BTC',
      'BTC_IDR',
      10,
      () => '2026-07-18T00:00:01.000Z',
    );
    builder.push(delta('98', '100', [['998', '3']]));
    builder.push(delta('99', '102', [['999', '2']], [['1001', '0']]));
    const state = builder.applySnapshot(snapshot);
    expect(state.state).toBe('SYNCHRONIZED');
    if (state.state !== 'SYNCHRONIZED') return;
    expect(state.lastUpdateId).toBe('102');
    expect(state.book.bids).toEqual([{ price: '999', quantity: '2' }]);
    expect(state.book.asks).toEqual([{ price: '1002', quantity: '1' }]);
  });

  it('supports snapshot-before-first-frame without publishing early', () => {
    const builder = new TokocryptoBookBuilder('BTC', 'BTC_IDR');
    expect(builder.applySnapshot(snapshot)).toEqual({ state: 'BUFFERING', buffered: 0 });
    expect(builder.push(delta('100', '101'))).toMatchObject({
      state: 'SYNCHRONIZED',
      lastUpdateId: '101',
    });
  });

  it('invalidates on gaps, symbol mismatch, and bounded-buffer overflow', () => {
    const gap = new TokocryptoBookBuilder('BTC', 'BTC_IDR');
    gap.push(delta('101', '101'));
    expect(gap.applySnapshot(snapshot).state).toBe('SYNCHRONIZED');
    expect(gap.push(delta('103', '103'))).toEqual({
      state: 'GAPPED',
      reason: 'sequence_gap_or_reorder',
    });

    const overflow = new TokocryptoBookBuilder('BTC', 'BTC_IDR', 1);
    overflow.push(delta('101', '101'));
    expect(overflow.push(delta('102', '102'))).toEqual({
      state: 'GAPPED',
      reason: 'buffer_overflow',
    });

    const mismatch = new TokocryptoBookBuilder('BTC', 'BTC_IDR');
    expect(mismatch.push({ ...delta('1', '1'), s: 'ETHIDR' })).toEqual({
      state: 'GAPPED',
      reason: 'symbol_mismatch',
    });
  });
});

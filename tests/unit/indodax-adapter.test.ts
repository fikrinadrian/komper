import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndodaxAdapter } from '@server/adapters/indodax.js';

describe('Indodax catalog status normalization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails closed for maintenance, suspended, or unknown-status markets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                id: 'btcidr',
                symbol: 'BTCIDR',
                base_currency: 'idr',
                traded_currency: 'btc',
                ticker_id: 'btc_idr',
                price_precision: 1000,
                volume_precision: 8,
                price_round: 8,
                trade_min_base_currency: 50000,
                is_maintenance: 0,
                is_market_suspended: 0,
              },
              {
                id: 'ethidr',
                symbol: 'ETHIDR',
                base_currency: 'idr',
                traded_currency: 'eth',
                ticker_id: 'eth_idr',
                price_precision: 1000,
                volume_precision: 8,
                price_round: 8,
                trade_min_base_currency: 50000,
                is_maintenance: 1,
                is_market_suspended: 0,
              },
              {
                id: 'solidr',
                symbol: 'SOLIDR',
                base_currency: 'idr',
                traded_currency: 'sol',
                ticker_id: 'sol_idr',
                price_precision: 1000,
                volume_precision: 8,
                price_round: 8,
                trade_min_base_currency: 50000,
                is_maintenance: 0,
                is_market_suspended: 1,
              },
              {
                id: 'xrpidr',
                symbol: 'XRPIDR',
                base_currency: 'idr',
                traded_currency: 'xrp',
                ticker_id: 'xrp_idr',
                price_precision: 1,
                volume_precision: 8,
                price_round: 8,
                trade_min_base_currency: 50000,
              },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const instruments = await new IndodaxAdapter().discover();
    expect(instruments.map(({ baseAsset, active }) => ({ baseAsset, active }))).toEqual([
      { baseAsset: 'BTC', active: true },
      { baseAsset: 'ETH', active: false },
      { baseAsset: 'SOL', active: false },
      { baseAsset: 'XRP', active: false },
    ]);
    expect(instruments[0].marketQuantityIncrementRule).toMatchObject({
      state: 'VERIFIED',
      normalizedStep: '0.00000001',
      sourceField: 'price_round',
      sourceValue: '8',
      sourceSemantics: 'DECIMAL_PLACES',
    });
  });
});

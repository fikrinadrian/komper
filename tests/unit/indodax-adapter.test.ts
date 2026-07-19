import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndodaxAdapter } from '@server/adapters/indodax.js';
import { marketCandleRequest } from '@server/services/markets-service.js';

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

  it('builds Monday-aligned weekly candles from complete daily constituents', async () => {
    const monday = Date.parse('2026-07-06T00:00:00.000Z');
    const fetchMock = vi.fn(async (_input: string | URL | Request) => {
      void _input;
      const candles = Array.from({ length: 7 }, (_, index) => ({
        Time: String((monday + index * 86_400_000) / 1000),
        Open: String(100 + index),
        High: String(110 + index),
        Low: String(90 + index),
        Close: String(105 + index),
        Volume: '2',
      }));
      return new Response(JSON.stringify(candles), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = marketCandleRequest('all', Date.parse('2026-07-13T01:00:00.000Z'));
    const candles = await new IndodaxAdapter().getCandles('BTC', request);

    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('tf')).toBe('1D');
    expect(candles).toEqual([
      expect.objectContaining({
        openedAt: '2026-07-06T00:00:00.000Z',
        closedAt: '2026-07-12T23:59:59.999Z',
        open: '100',
        high: '116',
        low: '90',
        close: '111',
        baseVolume: '14',
      }),
    ]);
  });
});

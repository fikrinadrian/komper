import { afterEach, describe, expect, it, vi } from 'vitest';
import { RekuAdapter } from '@server/adapters/reku.js';
import { TokocryptoAdapter } from '@server/adapters/tokocrypto.js';

describe('venue-specific increment contracts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps documented Reku decimal-count fields without integer-shape guessing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([{ cd: 'BTC', status: 1, price_decimals: 2, volume_decimals: 8 }]),
            { status: 200 },
          ),
      ),
    );
    const [instrument] = await new RekuAdapter().discover();
    expect(instrument.marketPriceIncrementRule).toMatchObject({
      normalizedStep: '0.01',
      sourceField: 'price_decimals',
      sourceSemantics: 'DECIMAL_PLACES',
    });
    expect(instrument.marketQuantityIncrementRule).toMatchObject({
      normalizedStep: '0.00000001',
      sourceField: 'volume_decimals',
      sourceSemantics: 'DECIMAL_PLACES',
    });
  });

  it.each([1, 3])(
    'keeps Tokocrypto type %s provenance and uses the tested general-lot fallback',
    async (type) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                code: 0,
                data: {
                  list: [
                    {
                      type,
                      symbol: 'BTC_IDR',
                      baseAsset: 'BTC',
                      quoteAsset: 'IDR',
                      spotTradingEnable: 1,
                      filters: [
                        { filterType: 'PRICE_FILTER', tickSize: '1000.00' },
                        { filterType: 'MARKET_LOT_SIZE', minQty: '0', stepSize: '0' },
                        { filterType: 'LOT_SIZE', minQty: '0.00001', stepSize: '0.00001' },
                        { filterType: 'NOTIONAL', minNotional: '20000' },
                      ],
                    },
                  ],
                },
              }),
              { status: 200 },
            ),
        ),
      );
      const [instrument] = await new TokocryptoAdapter().discover();
      expect(instrument.marketSegment).toBe(`spot-type-${type}`);
      expect(instrument.marketPriceIncrementRule).toMatchObject({
        normalizedStep: '1000',
        sourceField: 'filters.PRICE_FILTER.tickSize',
        sourceSemantics: 'STEP_SIZE',
      });
      expect(instrument.marketQuantityIncrementRule).toMatchObject({
        normalizedStep: '0.00001',
        sourceField: 'filters.LOT_SIZE.stepSize',
        sourceSemantics: 'STEP_SIZE',
      });
      expect(instrument.metadataVersion).toBe(`tokocrypto-symbols-type-${type}-v1`);
    },
  );
});

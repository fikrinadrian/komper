import { afterEach, describe, expect, it, vi } from 'vitest';
import { RekuAdapter } from '@server/adapters/reku.js';
import { TokocryptoAdapter } from '@server/adapters/tokocrypto.js';

describe('venue-specific increment contracts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the reviewed Reku client contract instead of volume display decimals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                cd: 'BTC',
                status: 1,
                digits: 10000,
                price_decimals: 0,
                volume_decimals: 0,
              },
            ]),
            { status: 200 },
          ),
      ),
    );
    const [instrument] = await new RekuAdapter().discover();
    expect(instrument.marketPriceIncrementRule).toMatchObject({
      normalizedStep: '10000',
      sourceField: 'digits',
      sourceSemantics: 'STEP_SIZE',
      evidenceClass: 'OFFICIAL_WEB_CLIENT_OBSERVED',
    });
    expect(instrument.marketQuantityIncrementRule).toMatchObject({
      normalizedStep: '0.00000001',
      sourceField: 'officialWebClient.sell.amount.scale',
      sourceSemantics: 'DECIMAL_PLACES',
      evidenceClass: 'OFFICIAL_WEB_CLIENT_OBSERVED',
      contentSha256: 'f70980ea71240a3c9abeb080fb8707fd065714a24b8986a73fc04094634a943b',
    });
    expect(instrument.buyQuoteIncrementRule).toMatchObject({
      normalizedStep: '1',
      sourceField: 'officialWebClient.buy.amount.scale',
    });
    expect(instrument.buyOutcomeIncrementRule).toMatchObject({
      normalizedStep: '0.00000001',
      sourceField: 'officialWebClient.buy.estimation.scale',
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

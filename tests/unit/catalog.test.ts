import { describe, expect, it } from 'vitest';
import type { CanonicalBook, VenueAdapter, VenueInstrument } from '@server/domain/types.js';
import type { Venue } from '@shared/contracts.js';
import { CatalogService } from '@server/services/catalog-service.js';
import { stepRule } from '@server/domain/increments.js';

class CatalogAdapter implements VenueAdapter {
  constructor(
    readonly venue: Venue,
    private readonly instruments: VenueInstrument[],
  ) {}
  async discover() {
    return this.instruments;
  }
  async getBook(): Promise<CanonicalBook> {
    throw new Error('not used');
  }
}

class RecoveringCatalogAdapter implements VenueAdapter {
  private call = 0;

  constructor(
    readonly venue: Venue,
    private readonly instruments: VenueInstrument[],
  ) {}

  async discover() {
    this.call += 1;
    if (this.call === 2) throw new Error('metadata refresh failed');
    return this.instruments;
  }

  async getBook(): Promise<CanonicalBook> {
    throw new Error('not used');
  }
}

function instrument(
  venue: Venue,
  baseAsset: string,
  quoteAsset = 'IDR',
  active = true,
): VenueInstrument {
  const metadataVersion = `test-${venue.toLowerCase()}-v1`;
  return {
    venue,
    marketSegment: 'spot',
    venueSymbol: `${baseAsset}_${quoteAsset}`,
    baseAsset,
    quoteAsset,
    active,
    directIdr: quoteAsset === 'IDR',
    marketPriceIncrementRule: stepRule('test.priceStep', '1', metadataVersion),
    marketQuantityIncrementRule: stepRule('test.quantityStep', '0.00000001', metadataVersion),
    metadataVersion,
  };
}

describe('canonical intersection catalog', () => {
  it('selects only active direct-IDR instruments present on all three venues', async () => {
    const service = new CatalogService([
      new CatalogAdapter('INDODAX', [instrument('INDODAX', 'BTC'), instrument('INDODAX', 'ETH')]),
      new CatalogAdapter('REKU', [instrument('REKU', 'BTC'), instrument('REKU', 'ETH', 'USDT')]),
      new CatalogAdapter('TOKOCRYPTO', [
        instrument('TOKOCRYPTO', 'BTC'),
        instrument('TOKOCRYPTO', 'ETH', 'IDR', false),
      ]),
    ]);
    const catalog = await service.getCatalog();
    expect(catalog.instruments.find((item) => item.asset === 'BTC')?.selectable).toBe(true);
    expect(catalog.instruments.find((item) => item.asset === 'ETH')?.selectable).toBe(false);
  });

  it('quarantines stale venue metadata after refresh failure and restores it only after recovery', async () => {
    const tokocrypto = new RecoveringCatalogAdapter('TOKOCRYPTO', [
      instrument('TOKOCRYPTO', 'BTC'),
    ]);
    const service = new CatalogService([
      new CatalogAdapter('INDODAX', [instrument('INDODAX', 'BTC')]),
      new CatalogAdapter('REKU', [instrument('REKU', 'BTC')]),
      tokocrypto,
    ]);

    const initial = await service.getCatalog(true);
    expect(initial.instruments.find((item) => item.asset === 'BTC')?.selectable).toBe(true);
    expect(initial.sourceStatus.find((item) => item.venue === 'TOKOCRYPTO')?.ok).toBe(true);

    const failedRefresh = await service.getCatalog(true);
    const failedBtc = failedRefresh.instruments.find((item) => item.asset === 'BTC');
    expect(failedRefresh.sourceStatus.find((item) => item.venue === 'TOKOCRYPTO')).toEqual({
      venue: 'TOKOCRYPTO',
      ok: false,
      reason: 'Metadata tidak tersedia.',
    });
    expect(failedBtc?.selectable).toBe(false);
    expect(failedBtc?.coverage.find((item) => item.venue === 'TOKOCRYPTO')?.available).toBe(false);

    const recovered = await service.getCatalog(true);
    expect(recovered.sourceStatus.find((item) => item.venue === 'TOKOCRYPTO')?.ok).toBe(true);
    expect(recovered.instruments.find((item) => item.asset === 'BTC')?.selectable).toBe(true);
    expect(
      recovered.instruments
        .find((item) => item.asset === 'BTC')
        ?.coverage.find((item) => item.venue === 'TOKOCRYPTO')?.available,
    ).toBe(true);
  });
});

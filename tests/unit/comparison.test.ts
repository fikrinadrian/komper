import { describe, expect, it, vi } from 'vitest';
import { FixtureAdapter } from '@server/adapters/fixture.js';
import type { VenueAdapter } from '@server/domain/types.js';
import type { FeeAssumption, Venue } from '@shared/contracts.js';
import { CatalogService } from '@server/services/catalog-service.js';
import { ComparisonService } from '@server/services/comparison-service.js';
import type { CanonicalBook, VenueInstrument } from '@server/domain/types.js';
import { stepRule } from '@server/domain/increments.js';
import {
  rekuBuyOutcomeRule,
  rekuBuyQuoteRule,
  rekuSellBaseRule,
} from '@server/registry/reku-execution-rules.js';

const adapters = [
  new FixtureAdapter('INDODAX'),
  new FixtureAdapter('REKU'),
  new FixtureAdapter('TOKOCRYPTO'),
];

class RekuAggregateAdapter implements VenueAdapter {
  readonly venue = 'REKU' as const;
  private readonly metadataVersion = 'reku-test-client-contract';

  async discover(): Promise<VenueInstrument[]> {
    return [
      {
        venue: this.venue,
        marketSegment: 'spot',
        venueSymbol: 'BTC_IDR',
        baseAsset: 'BTC',
        quoteAsset: 'IDR',
        active: true,
        directIdr: true,
        marketPriceIncrementRule: stepRule('digits', '10000', this.metadataVersion),
        marketQuantityIncrementRule: rekuSellBaseRule(this.metadataVersion),
        buyQuoteIncrementRule: rekuBuyQuoteRule(this.metadataVersion),
        buyOutcomeIncrementRule: rekuBuyOutcomeRule(this.metadataVersion),
        metadataVersion: this.metadataVersion,
      },
    ];
  }

  async getBook(): Promise<CanonicalBook> {
    const now = new Date().toISOString();
    return {
      schemaVersion: '1',
      venue: this.venue,
      marketSegment: 'spot',
      venueSymbol: 'BTC_IDR',
      canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
      bids: [{ price: '1163000000', quantity: '0.00082723129836629' }],
      asks: [{ price: '1163900000', quantity: '0.054373532090386' }],
      receivedAt: now,
      processedAt: now,
      freshnessIndependentlyVerified: false,
      synchronization: 'SNAPSHOT',
      quantityLevelSemantics: 'DERIVED_FROM_NOTIONAL',
    };
  }
}

describe('health-gated venue comparison', () => {
  it('ranks at least two healthy venues and labels gross basis when fees are unknown', async () => {
    const catalog = new CatalogService(adapters);
    const result = await new ComparisonService(adapters, catalog).compare('BTC', 'buy', '5000000');
    expect(result.eligibleVenueCount).toBe(3);
    expect(result.winner).toBe('REKU');
    expect(result.rankingBasis).toBe('GROSS');
    expect(result.results.every((item) => item.fee.status === 'UNVERIFIED')).toBe(true);
    for (const estimate of result.results) {
      expect(estimate.roundingMode).toBe('FLOOR');
      expect(estimate.executableBaseQuantity).toBeDefined();
      expect(estimate.quantityIncrementRule.state).toBe('VERIFIED');
      expect(estimate.ruleMetadataVersion).toMatch(/^fixture-/);
    }
  });

  it('quantizes sell quantity before walking and discloses the exact remainder', async () => {
    const catalog = new CatalogService(adapters);
    const result = await new ComparisonService(adapters, catalog).compare(
      'BTC',
      'sell',
      '0.100000009',
    );
    for (const estimate of result.results) {
      expect(estimate.status).toBe('ELIGIBLE');
      expect(estimate.executableBaseQuantity).toBe('0.1');
      expect(estimate.quantizationAdjustment).toBe('0.000000009');
      expect(estimate.unsoldBaseAmount).toBe('0.000000009');
    }
  });

  it('keeps two healthy venues when one source fails schema validation', async () => {
    const catalog = new CatalogService(adapters);
    const result = await new ComparisonService(adapters, catalog).compare('WIF', 'buy', '1000000');
    expect(result.eligibleVenueCount).toBe(2);
    expect(result.results.find((item) => item.venue === 'INDODAX')?.status).toBe('SCHEMA_ERROR');
    expect(result.winnerLabel).toContain('2 dari 3');
  });

  it('suppresses a winner when fewer than two venues are eligible', async () => {
    const catalog = new CatalogService(adapters);
    const result = await new ComparisonService(adapters, catalog).compare('DRX', 'buy', '1000000');
    expect(result.eligibleVenueCount).toBe(1);
    expect(result.winner).toBeUndefined();
    expect(result.rankingBasis).toBe('NONE');
  });

  it('can calculate and rank verified configured fee estimates separately', async () => {
    const catalog = new CatalogService(adapters);
    const lookup = (venue: Venue): FeeAssumption => ({
      status: 'VERIFIED',
      rate: venue === 'REKU' ? '0.01' : '0.001',
      source: 'test fixture',
      asOf: '2026-07-17',
      version: 'test-v1',
    });
    const result = await new ComparisonService(adapters, catalog, 15_000, lookup).compare(
      'BTC',
      'buy',
      '5000000',
    );
    expect(result.rankingBasis).toBe('NET');
    expect(result.results.every((item) => item.netOutcome)).toBe(true);
    expect(result.winner).not.toBe('REKU');
  });

  it('excludes sell quantities whose derived top-of-book notional is below venue minimums', async () => {
    const catalog = new CatalogService(adapters);
    const result = await new ComparisonService(adapters, catalog).compare(
      'BTC',
      'sell',
      '0.000000001',
    );
    expect(result.results.every((item) => item.status === 'BELOW_MINIMUM')).toBe(true);
    expect(result.eligibleVenueCount).toBe(0);
    expect(result.winner).toBeUndefined();
    expect(result.rankingBasis).toBe('NONE');
  });

  it('classifies malformed canonical decimals as schema rejection, not connectivity failure', async () => {
    const healthyIndodax = new FixtureAdapter('INDODAX');
    const malformedIndodax: VenueAdapter = {
      venue: 'INDODAX',
      discover: () => healthyIndodax.discover(),
      getBook: async (asset) => {
        const book = await healthyIndodax.getBook(asset);
        book.bids[0].price = 'NaN';
        return book;
      },
    };
    const localAdapters: VenueAdapter[] = [
      malformedIndodax,
      new FixtureAdapter('REKU'),
      new FixtureAdapter('TOKOCRYPTO'),
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const catalog = new CatalogService(localAdapters);
    const result = await new ComparisonService(localAdapters, catalog).compare(
      'BTC',
      'buy',
      '1000000',
    );

    expect(result.results.find((item) => item.venue === 'INDODAX')?.status).toBe('SCHEMA_ERROR');
    expect(warn).toHaveBeenCalledWith('market_source_rejected', {
      venue: 'INDODAX',
      category: 'schema',
    });
    warn.mockRestore();
  });

  it('compares Reku buys using quote input without rejecting aggregate book quantities', async () => {
    const localAdapters: VenueAdapter[] = [
      new FixtureAdapter('INDODAX'),
      new RekuAggregateAdapter(),
      new FixtureAdapter('TOKOCRYPTO'),
    ];
    const result = await new ComparisonService(
      localAdapters,
      new CatalogService(localAdapters),
    ).compare('BTC', 'buy', '5000000');
    const reku = result.results.find((item) => item.venue === 'REKU')!;

    expect(reku.status).toBe('ELIGIBLE');
    expect(reku.grossOutcome).toBe('0.0042959');
    expect(reku.executableBaseQuantity).toBe('0.0042959');
    expect(reku.filledNotional).toBe('5000000');
    expect(reku.unspentQuoteAmount).toBe('0');
    expect(reku.inputDenomination).toBe('QUOTE');
  });

  it('floors Reku sell input independently from aggregate book precision', async () => {
    const localAdapters: VenueAdapter[] = [
      new FixtureAdapter('INDODAX'),
      new RekuAggregateAdapter(),
      new FixtureAdapter('TOKOCRYPTO'),
    ];
    const result = await new ComparisonService(
      localAdapters,
      new CatalogService(localAdapters),
    ).compare('BTC', 'sell', '0.00082723129836629');
    const reku = result.results.find((item) => item.venue === 'REKU')!;

    expect(reku.status).toBe('ELIGIBLE');
    expect(reku.executableBaseQuantity).toBe('0.00082723');
    expect(reku.unsoldBaseAmount).toBe('0.00000000129836629');
    expect(reku.grossOutcome).toBe('962068.49');
  });
});

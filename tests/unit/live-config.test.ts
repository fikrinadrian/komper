import { describe, expect, it } from 'vitest';
import { ConnectionBudget, liveFeatureConfig } from '@server/live/coordinator.js';

describe('live feature rollback configuration', () => {
  it('fails closed unless ingestion, ranking, SSE, venue and asset flags are explicit', () => {
    expect(liveFeatureConfig({})).toMatchObject({
      ingestEnabled: false,
      rankingEnabled: false,
      sseEnabled: false,
    });
    expect(
      liveFeatureConfig({
        MARKET_LIVE_INGEST_ENABLED: 'true',
        MARKET_LIVE_RANKING_ENABLED: 'true',
        MARKET_LIVE_SSE_ENABLED: 'true',
        MARKET_LIVE_ASSETS: 'btc, eth',
        MARKET_LIVE_VENUES: 'REKU,TOKOCRYPTO,UNKNOWN',
      }),
    ).toMatchObject({
      ingestEnabled: true,
      rankingEnabled: true,
      sseEnabled: true,
      assets: new Set(['BTC', 'ETH']),
      venues: new Set(['REKU', 'TOKOCRYPTO']),
    });
  });

  it('does not allow SSE to bypass a disabled live ranking path', () => {
    expect(
      liveFeatureConfig({
        MARKET_LIVE_SSE_ENABLED: 'true',
        MARKET_LIVE_RANKING_ENABLED: 'true',
      }).sseEnabled,
    ).toBe(false);
  });

  it('hard-caps Reku connections and releases capacity idempotently', () => {
    const budget = new ConnectionBudget(10);
    const releases = Array.from({ length: 10 }, () => budget.tryAcquire());
    expect(releases.every(Boolean)).toBe(true);
    expect(budget.activeCount()).toBe(10);
    expect(budget.tryAcquire()).toBeUndefined();
    releases[0]!();
    releases[0]!();
    expect(budget.activeCount()).toBe(9);
    expect(budget.tryAcquire()).toBeTypeOf('function');
    expect(budget.activeCount()).toBe(10);
  });

  it('never configures more than the documented Reku 10-connection ceiling', () => {
    expect(liveFeatureConfig({ MARKET_REKU_MAX_CONNECTIONS: '999' }).rekuMaxConnections).toBe(10);
  });
});

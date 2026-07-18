import { FixtureAdapter } from '@server/adapters/fixture.js';
import { IndodaxAdapter } from '@server/adapters/indodax.js';
import { RekuAdapter } from '@server/adapters/reku.js';
import { TokocryptoAdapter } from '@server/adapters/tokocrypto.js';
import type { VenueAdapter } from '@server/domain/types.js';
import { CatalogService } from './catalog-service.js';
import { ComparisonService } from './comparison-service.js';
import { MarketsService } from './markets-service.js';
import { LiveMarketCoordinator, type LiveFeatureConfig } from '@server/live/coordinator.js';

export function createServices(mode: 'live' | 'fixture' = 'live', liveConfig?: LiveFeatureConfig) {
  const adapters: VenueAdapter[] =
    mode === 'fixture'
      ? [
          new FixtureAdapter('INDODAX'),
          new FixtureAdapter('REKU'),
          new FixtureAdapter('TOKOCRYPTO'),
        ]
      : [new IndodaxAdapter(), new RekuAdapter(), new TokocryptoAdapter()];
  const catalog = new CatalogService(adapters);
  const live = new LiveMarketCoordinator(adapters, catalog, liveConfig);
  const comparison = new ComparisonService(adapters, catalog, 15_000, undefined, live.resolveBook);
  const markets = new MarketsService(adapters, catalog);
  return { adapters, catalog, comparison, markets, live };
}

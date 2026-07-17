import { FixtureAdapter } from '@server/adapters/fixture.js';
import { IndodaxAdapter } from '@server/adapters/indodax.js';
import { RekuAdapter } from '@server/adapters/reku.js';
import { TokocryptoAdapter } from '@server/adapters/tokocrypto.js';
import type { VenueAdapter } from '@server/domain/types.js';
import { CatalogService } from './catalog-service.js';
import { ComparisonService } from './comparison-service.js';

export function createServices(mode: 'live' | 'fixture' = 'live') {
  const adapters: VenueAdapter[] =
    mode === 'fixture'
      ? [
          new FixtureAdapter('INDODAX'),
          new FixtureAdapter('REKU'),
          new FixtureAdapter('TOKOCRYPTO'),
        ]
      : [new IndodaxAdapter(), new RekuAdapter(), new TokocryptoAdapter()];
  const catalog = new CatalogService(adapters);
  const comparison = new ComparisonService(adapters, catalog);
  return { adapters, catalog, comparison };
}

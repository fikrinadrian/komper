import type { CatalogResponse, Venue } from '@shared/contracts.js';
import type { VenueAdapter, VenueInstrument } from '@server/domain/types.js';

const VENUES: Venue[] = ['INDODAX', 'REKU', 'TOKOCRYPTO'];

export class CatalogService {
  private cached?: { expiresAt: number; response: CatalogResponse };
  private instrumentsByVenue = new Map<Venue, VenueInstrument[]>();

  constructor(
    private readonly adapters: VenueAdapter[],
    private readonly cacheMs = 5 * 60_000,
  ) {}

  async getCatalog(force = false): Promise<CatalogResponse> {
    if (!force && this.cached && this.cached.expiresAt > Date.now()) return this.cached.response;

    const settled = await Promise.allSettled(
      this.adapters.map(async (adapter) => ({ adapter, instruments: await adapter.discover() })),
    );
    const sourceStatus: CatalogResponse['sourceStatus'] = [];

    for (const [index, result] of settled.entries()) {
      const adapter = this.adapters[index];
      if (result.status === 'fulfilled') {
        this.instrumentsByVenue.set(adapter.venue, result.value.instruments);
        sourceStatus.push({ venue: adapter.venue, ok: true });
      } else {
        // A failed refresh invalidates the venue's previous catalog. Keeping a last-known-good
        // entry here would make unsupported or delisted pairs look currently comparable.
        this.instrumentsByVenue.delete(adapter.venue);
        sourceStatus.push({ venue: adapter.venue, ok: false, reason: 'Metadata tidak tersedia.' });
      }
    }

    const allAssets = new Set<string>();
    for (const instruments of this.instrumentsByVenue.values()) {
      for (const instrument of instruments) {
        if (instrument.quoteAsset === 'IDR') allAssets.add(instrument.baseAsset);
      }
    }

    const instruments = [...allAssets].sort().map((asset) => {
      const coverage = VENUES.map((venue) => {
        const match = this.instrumentsByVenue
          .get(venue)
          ?.find(
            (item) =>
              item.baseAsset === asset &&
              item.quoteAsset === 'IDR' &&
              item.directIdr &&
              item.active,
          );
        return match
          ? {
              venue,
              available: true,
              venueSymbol: match.venueSymbol,
              marketSegment: match.marketSegment,
            }
          : { venue, available: false, reason: 'Pair IDR aktif tidak ditemukan.' };
      });
      return {
        asset,
        quote: 'IDR' as const,
        selectable: coverage.every((item) => item.available),
        coverage,
      };
    });

    const response: CatalogResponse = {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      instruments,
      requiredVenueCount: 3,
      sourceStatus: sourceStatus.sort((a, b) => VENUES.indexOf(a.venue) - VENUES.indexOf(b.venue)),
    };
    this.cached = { expiresAt: Date.now() + this.cacheMs, response };
    return response;
  }

  getVenueInstrument(venue: Venue, asset: string): VenueInstrument | undefined {
    return this.instrumentsByVenue
      .get(venue)
      ?.find(
        (item) =>
          item.baseAsset === asset && item.quoteAsset === 'IDR' && item.active && item.directIdr,
      );
  }
}

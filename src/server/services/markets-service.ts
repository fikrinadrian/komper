import type {
  MarketDetailResponse,
  MarketDetailVenue,
  MarketChartPeriod,
  MarketChartResponse,
  MarketTicker,
  MarketsResponse,
  Venue,
} from '@shared/contracts.js';
import type { VenueAdapter } from '@server/domain/types.js';
import type { MarketCandleRequest } from '@server/domain/types.js';
import {
  MARKET_CANDLE_INTERVAL_MS,
  MARKET_DAY_MS,
  MARKET_WEEK_MS,
  validateMarketCandles,
} from '@server/domain/market-history.js';
import type { CatalogService } from './catalog-service.js';

const VENUES: Venue[] = ['INDODAX', 'REKU', 'TOKOCRYPTO'];
const DEFAULT_TICKER_STALE_MS = 90_000;
const ALL_HISTORY_FROM_MS = Date.UTC(2009, 0, 5);
const MONDAY_UTC_ANCHOR_MS = 4 * MARKET_DAY_MS;

function latestClosedBucketAt(request: MarketCandleRequest): number {
  const currentBucket =
    request.interval === '1w'
      ? Math.floor((request.toMs - MONDAY_UTC_ANCHOR_MS) / request.intervalMs) *
          request.intervalMs +
        MONDAY_UTC_ANCHOR_MS
      : Math.floor(request.toMs / request.intervalMs) * request.intervalMs;
  return currentBucket - 1;
}

export function marketCandleRequest(period: MarketChartPeriod, nowMs: number): MarketCandleRequest {
  const toMs = nowMs;
  const boundedFrom = (intervalMs: number, limit: number) => {
    const currentBucket = Math.floor(nowMs / intervalMs) * intervalMs;
    return currentBucket - limit * intervalMs;
  };
  switch (period) {
    case '1d':
      return {
        period,
        interval: '1h',
        intervalMs: MARKET_CANDLE_INTERVAL_MS,
        limit: 24,
        fromMs: boundedFrom(MARKET_CANDLE_INTERVAL_MS, 24),
        toMs,
      };
    case '1w':
      return {
        period,
        interval: '4h',
        intervalMs: 4 * MARKET_CANDLE_INTERVAL_MS,
        limit: 42,
        fromMs: boundedFrom(4 * MARKET_CANDLE_INTERVAL_MS, 42),
        toMs,
      };
    case '1y':
      return {
        period,
        interval: '1d',
        intervalMs: MARKET_DAY_MS,
        limit: 365,
        fromMs: boundedFrom(MARKET_DAY_MS, 365),
        toMs,
      };
    case 'all':
      return {
        period,
        interval: '1w',
        intervalMs: MARKET_WEEK_MS,
        limit: 1000,
        fromMs: ALL_HISTORY_FROM_MS,
        toMs,
      };
  }
}

function tickerAsset(ticker: MarketTicker): string {
  const symbol = ticker.venueSymbol.toUpperCase();
  if (ticker.venue === 'INDODAX') return symbol.replace(/_?IDR$/, '');
  if (ticker.venue === 'REKU') return symbol.replace(/_IDR$/, '');
  return symbol.replace(/_?IDR$/, '');
}

function tickerFor(tickers: MarketTicker[], asset: string): MarketTicker | undefined {
  return tickers.find((ticker) => tickerAsset(ticker) === asset);
}

export class MarketsService {
  constructor(
    private readonly adapters: VenueAdapter[],
    private readonly catalog: CatalogService,
    private readonly now: () => number = Date.now,
    private readonly tickerStaleMs = DEFAULT_TICKER_STALE_MS,
  ) {}

  private tickerStatus(ticker: MarketTicker): { status: 'AVAILABLE' | 'STALE'; reason?: string } {
    const observedAt = Date.parse(ticker.sourceEventAt ?? ticker.receivedAt);
    const ageMs = this.now() - observedAt;
    if (!Number.isFinite(ageMs) || ageMs > this.tickerStaleMs || ageMs < -30_000) {
      return { status: 'STALE', reason: 'Ticker melewati batas kesegaran 90 detik.' };
    }
    return { status: 'AVAILABLE' };
  }

  async getOverview(): Promise<MarketsResponse> {
    const catalog = await this.catalog.getCatalog();
    const settled = await Promise.allSettled(
      this.adapters.map(async (adapter) => ({
        venue: adapter.venue,
        tickers: adapter.listTickers ? await adapter.listTickers() : [],
      })),
    );
    const tickersByVenue = new Map<Venue, MarketTicker[]>();
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        tickersByVenue.set(result.value.venue, result.value.tickers);
      }
    }

    const generatedAt = new Date(this.now()).toISOString();
    return {
      schemaVersion: '1',
      generatedAt,
      rows: catalog.instruments.map((instrument) => ({
        pair: `${instrument.asset}-IDR`,
        asset: instrument.asset,
        quote: 'IDR' as const,
        venues: VENUES.map((venue) => {
          const coverage = instrument.coverage.find((item) => item.venue === venue);
          const ticker = tickerFor(tickersByVenue.get(venue) ?? [], instrument.asset);
          if (!coverage?.available) {
            return {
              venue,
              status: 'UNSUPPORTED' as const,
              reason: 'Pair IDR aktif tidak tersedia di exchange ini.',
            };
          }
          return ticker
            ? { venue, ...this.tickerStatus(ticker), ticker }
            : {
                venue,
                status: 'UNAVAILABLE' as const,
                reason: 'Last price publik sedang tidak tersedia.',
              };
        }),
      })),
      disclosure:
        'Last price adalah transaksi terakhir yang dilaporkan exchange, bukan harga eksekusi. Usia memakai waktu sumber bila tersedia, selain itu waktu penerimaan BFF; ini bukan usia transaksi terakhir.',
    };
  }

  async getDetail(asset: string): Promise<MarketDetailResponse> {
    const catalog = await this.catalog.getCatalog();
    const instrument = catalog.instruments.find((item) => item.asset === asset);
    if (!instrument) throw new Error('unsupported_market');

    const nowMs = this.now();
    const candleRequest = marketCandleRequest('1d', nowMs);
    const venues = await Promise.all(
      this.adapters.map(async (adapter): Promise<MarketDetailVenue> => {
        const venueInstrument = this.catalog.getVenueInstrument(adapter.venue, asset);
        if (!venueInstrument) {
          return {
            venue: adapter.venue,
            marketSegment: 'spot',
            venueSymbol: `${asset}-IDR`,
            status: 'UNSUPPORTED',
            reason: 'Pair IDR aktif tidak tersedia di exchange ini.',
            tradeSampleStatus: 'UNSUPPORTED',
            components: {
              ticker: { status: 'UNSUPPORTED', reason: 'Pair tidak didukung.' },
              orderBook: { status: 'UNSUPPORTED', reason: 'Pair tidak didukung.' },
              trades: { status: 'UNSUPPORTED', reason: 'Pair tidak didukung.' },
              candles: { status: 'UNSUPPORTED', reason: 'Pair tidak didukung.' },
            },
          };
        }

        const [tickers, book, trades, candles] = await Promise.allSettled([
          adapter.listTickers ? adapter.listTickers() : Promise.resolve([]),
          adapter.getBook(asset),
          adapter.getTrades ? adapter.getTrades(asset) : Promise.resolve(undefined),
          adapter.getCandles
            ? adapter
                .getCandles(asset, candleRequest)
                .then((value) => validateMarketCandles(value, nowMs, candleRequest.intervalMs))
            : Promise.reject(new Error('candles_capability_unavailable')),
        ]);
        const ticker = tickers.status === 'fulfilled' ? tickerFor(tickers.value, asset) : undefined;
        const tickerComponent = ticker
          ? this.tickerStatus(ticker)
          : { status: 'UNAVAILABLE' as const, reason: 'Pricing tidak tersedia.' };
        const bookComponent =
          book.status === 'fulfilled'
            ? { status: 'AVAILABLE' as const }
            : { status: 'UNAVAILABLE' as const, reason: 'Order book tidak tersedia.' };
        const tradesComponent =
          trades.status === 'fulfilled' && trades.value !== undefined
            ? { status: 'AVAILABLE' as const }
            : { status: 'UNSUPPORTED' as const, reason: 'Sampel public trades tidak tersedia.' };
        const candlesComponent =
          candles.status === 'fulfilled' && candles.value.length > 0
            ? { status: 'AVAILABLE' as const }
            : { status: 'UNAVAILABLE' as const, reason: 'OHLC tertutup tidak tersedia.' };
        const components = {
          ticker: tickerComponent,
          orderBook: bookComponent,
          trades: tradesComponent,
          candles: candlesComponent,
        };
        const healthyComponents = [tickerComponent, bookComponent, candlesComponent].filter(
          (component) => component.status === 'AVAILABLE',
        ).length;
        const reasons: string[] = [];
        if (tickerComponent.status !== 'AVAILABLE') reasons.push('pricing');
        if (bookComponent.status !== 'AVAILABLE') reasons.push('order book');
        if (candlesComponent.status !== 'AVAILABLE') reasons.push('OHLC');

        return {
          venue: adapter.venue,
          marketSegment: venueInstrument.marketSegment,
          venueSymbol: venueInstrument.venueSymbol,
          status:
            healthyComponents > 0
              ? 'AVAILABLE'
              : tickerComponent.status === 'STALE'
                ? 'STALE'
                : 'UNAVAILABLE',
          reason:
            reasons.length > 0 ? `Komponen tidak tersedia: ${reasons.join(', ')}.` : undefined,
          ticker,
          orderBook:
            book.status === 'fulfilled'
              ? {
                  bids: book.value.bids.slice(0, 15),
                  asks: book.value.asks.slice(0, 15),
                  sourceEventAt: book.value.sourceEventAt,
                  receivedAt: book.value.receivedAt,
                  freshnessIndependentlyVerified: book.value.freshnessIndependentlyVerified,
                }
              : undefined,
          trades: trades.status === 'fulfilled' ? trades.value : undefined,
          tradeSampleStatus: tradesComponent.status,
          candles: candles.status === 'fulfilled' ? candles.value : undefined,
          components,
        };
      }),
    );

    return {
      schemaVersion: '1',
      pair: `${asset}-IDR`,
      asset,
      quote: 'IDR',
      interval: '1h',
      generatedAt: new Date(nowMs).toISOString(),
      venues,
      disclosure:
        'Data publik observasional dapat berbeda waktu antar-exchange dan bukan kuotasi yang dapat dieksekusi.',
    };
  }

  async getChart(asset: string, period: MarketChartPeriod): Promise<MarketChartResponse> {
    const catalog = await this.catalog.getCatalog();
    const instrument = catalog.instruments.find((item) => item.asset === asset);
    if (!instrument) throw new Error('unsupported_market');

    const nowMs = this.now();
    const candleRequest = marketCandleRequest(period, nowMs);
    const venues = await Promise.all(
      this.adapters.map(async (adapter) => {
        const venueInstrument = this.catalog.getVenueInstrument(adapter.venue, asset);
        if (!venueInstrument) {
          return {
            venue: adapter.venue,
            marketSegment: 'spot',
            venueSymbol: `${asset}-IDR`,
            status: 'UNSUPPORTED' as const,
            reason: 'Pair IDR aktif tidak tersedia di exchange ini.',
            candles: [],
          };
        }
        if (!adapter.getCandles) {
          return {
            venue: adapter.venue,
            marketSegment: venueInstrument.marketSegment,
            venueSymbol: venueInstrument.venueSymbol,
            status: 'UNSUPPORTED' as const,
            reason: 'Riwayat OHLC tidak didukung exchange ini.',
            candles: [],
          };
        }
        try {
          const raw = await adapter.getCandles(asset, candleRequest);
          const candles = validateMarketCandles(raw, nowMs, candleRequest.intervalMs).filter(
            (candle) => Date.parse(candle.openedAt) >= candleRequest.fromMs,
          );
          const boundedCandles = candles.slice(-candleRequest.limit);
          const isPartial = period !== 'all' && boundedCandles.length < candleRequest.limit;
          return {
            venue: adapter.venue,
            marketSegment: venueInstrument.marketSegment,
            venueSymbol: venueInstrument.venueSymbol,
            status: boundedCandles.length > 0 ? ('AVAILABLE' as const) : ('UNAVAILABLE' as const),
            reason:
              boundedCandles.length === 0
                ? 'Candle tertutup tidak tersedia.'
                : isPartial
                  ? `Riwayat parsial: ${boundedCandles.length} dari ${candleRequest.limit} bucket.`
                  : undefined,
            expectedBuckets: period === 'all' ? undefined : candleRequest.limit,
            coverageStartAt: boundedCandles.at(0)?.openedAt,
            coverageEndAt: boundedCandles.at(-1)?.openedAt,
            candles: boundedCandles,
          };
        } catch {
          return {
            venue: adapter.venue,
            marketSegment: venueInstrument.marketSegment,
            venueSymbol: venueInstrument.venueSymbol,
            status: 'UNAVAILABLE' as const,
            reason: 'Riwayat OHLC sedang tidak tersedia.',
            candles: [],
          };
        }
      }),
    );

    return {
      schemaVersion: '1',
      pair: `${asset}-IDR`,
      asset,
      quote: 'IDR',
      period,
      interval: candleRequest.interval,
      requestedFromAt: new Date(candleRequest.fromMs).toISOString(),
      requestedToAt: new Date(latestClosedBucketAt(candleRequest)).toISOString(),
      maxBucketsPerVenue: candleRequest.limit,
      generatedAt: new Date(nowMs).toISOString(),
      venues,
      disclosure:
        'Setiap titik adalah harga close candle yang telah ditutup pada exchange tersebut. Gap dipertahankan dan tidak diinterpolasi.',
    };
  }
}

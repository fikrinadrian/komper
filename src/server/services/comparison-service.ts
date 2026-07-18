import { ZodError } from 'zod';
import type {
  ComparisonResponse,
  FeeAssumption,
  Side,
  Venue,
  VenueEstimate,
} from '@shared/contracts.js';
import { decimal, plain } from '@server/domain/decimal.js';
import { quantizeDown, unverifiedRule, validateBookIncrements } from '@server/domain/increments.js';
import { validateBook, walkBuy, walkBuyQuantity, walkSell } from '@server/domain/orderbook.js';
import type { VenueAdapter } from '@server/domain/types.js';
import type { CanonicalBook } from '@server/domain/types.js';
import { getFeeAssumption } from '@server/registry/fee-registry.js';
import { CatalogService } from './catalog-service.js';

const EXTERNAL_URLS: Record<Venue, string> = {
  INDODAX: 'https://indodax.com/market',
  REKU: 'https://reku.id/exchange',
  TOKOCRYPTO: 'https://www.tokocrypto.com/spot',
};

export type ComparisonBookResolution = {
  book?: CanonicalBook;
  status?: 'STALE' | 'UNSYNCED' | 'UNAVAILABLE';
  reason?: string;
  transport?: VenueEstimate['transport'];
  synchronization?: VenueEstimate['synchronization'];
  connectionEpoch?: number;
  liveRevision?: number;
};

export type ComparisonBookResolver = (
  adapter: VenueAdapter,
  asset: string,
) => Promise<ComparisonBookResolution | undefined>;

export class ComparisonService {
  constructor(
    private readonly adapters: VenueAdapter[],
    private readonly catalog: CatalogService,
    private readonly staleAfterMs = 15_000,
    private readonly feeLookup: (venue: Venue) => FeeAssumption = getFeeAssumption,
    private readonly bookResolver?: ComparisonBookResolver,
  ) {}

  async compare(asset: string, side: Side, amount: string): Promise<ComparisonResponse> {
    const catalog = await this.catalog.getCatalog();
    const instrument = catalog.instruments.find((item) => item.asset === asset);
    if (!instrument?.selectable) throw new Error('unsupported_instrument');

    const settled = await Promise.all(
      this.adapters.map(async (adapter): Promise<VenueEstimate> => {
        const venueInstrument = this.catalog.getVenueInstrument(adapter.venue, asset);
        const metadataVersion = venueInstrument?.metadataVersion ?? 'missing-metadata';
        const priceIncrementRule =
          venueInstrument?.marketPriceIncrementRule ??
          unverifiedRule('missing', undefined, 'STEP_SIZE', metadataVersion);
        const quantityIncrementRule =
          venueInstrument?.marketQuantityIncrementRule ??
          unverifiedRule('missing', undefined, 'STEP_SIZE', metadataVersion);
        const base: Pick<
          VenueEstimate,
          | 'venue'
          | 'marketSegment'
          | 'venueSymbol'
          | 'requestedAmount'
          | 'outcomeAsset'
          | 'fee'
          | 'freshnessIndependentlyVerified'
          | 'externalUrl'
          | 'priceIncrementRule'
          | 'quantityIncrementRule'
          | 'ruleMetadataVersion'
          | 'transport'
          | 'synchronization'
          | 'connectionEpoch'
          | 'liveRevision'
        > = {
          venue: adapter.venue,
          marketSegment: venueInstrument?.marketSegment ?? 'spot',
          venueSymbol: venueInstrument?.venueSymbol ?? asset,
          requestedAmount: amount,
          outcomeAsset: side === 'buy' ? asset : 'IDR',
          fee: this.feeLookup(adapter.venue),
          freshnessIndependentlyVerified: false,
          externalUrl: EXTERNAL_URLS[adapter.venue],
          priceIncrementRule,
          quantityIncrementRule,
          ruleMetadataVersion: metadataVersion,
          transport: 'REST_SNAPSHOT',
        };
        try {
          const resolution = await this.bookResolver?.(adapter, asset);
          if (resolution && !resolution.book) {
            return {
              ...base,
              status: resolution.status ?? 'UNSYNCED',
              statusReason: resolution.reason ?? 'Live book belum tersinkronisasi.',
              healthReason: resolution.reason,
              transport: resolution.transport,
              synchronization: resolution.synchronization,
              connectionEpoch: resolution.connectionEpoch,
              liveRevision: resolution.liveRevision,
            };
          }
          const book = validateBook(resolution?.book ?? (await adapter.getBook(asset)));
          const provenance = resolution
            ? {
                transport: resolution.transport,
                synchronization: resolution.synchronization,
                connectionEpoch: resolution.connectionEpoch,
                liveRevision: resolution.liveRevision,
              }
            : {};
          validateBookIncrements(book, priceIncrementRule, quantityIncrementRule);
          const ageMs = Math.max(0, Date.now() - Date.parse(book.receivedAt));
          if (!Number.isFinite(ageMs) || ageMs > this.staleAfterMs) {
            return {
              ...base,
              ...provenance,
              status: 'STALE',
              statusReason: 'Snapshot melewati ambang kesegaran dan tidak ikut diranking.',
              receivedAt: book.receivedAt,
              sourceEventAt: book.sourceEventAt,
              ageMs,
              freshnessIndependentlyVerified: book.freshnessIndependentlyVerified,
            };
          }

          const rawBuy = side === 'buy' ? walkBuy(book.asks, amount) : undefined;
          const rawBaseQuantity = rawBuy?.grossOutcome ?? amount;
          const executableBaseQuantity = quantizeDown(rawBaseQuantity, quantityIncrementRule);
          const quantizationAdjustment = plain(
            decimal(rawBaseQuantity).minus(decimal(executableBaseQuantity)),
            30,
          );
          if (decimal(executableBaseQuantity).eq(0)) {
            return {
              ...base,
              ...provenance,
              status: 'BELOW_MINIMUM',
              statusReason: 'Ukuran menjadi nol setelah dibulatkan turun ke increment venue.',
              requestedQuoteBudget: side === 'buy' ? amount : undefined,
              requestedBaseQuantity: side === 'sell' ? amount : undefined,
              executableBaseQuantity,
              quantizationAdjustment,
              roundingMode: 'FLOOR',
              receivedAt: book.receivedAt,
              sourceEventAt: book.sourceEventAt,
              ageMs,
              freshnessIndependentlyVerified: book.freshnessIndependentlyVerified,
            };
          }

          const walk =
            side === 'buy'
              ? walkBuyQuantity(book.asks, executableBaseQuantity)
              : walkSell(book.bids, executableBaseQuantity);
          const filledNotional = side === 'buy' ? walk.filledInput : walk.grossOutcome;
          const unspentQuoteAmount =
            side === 'buy'
              ? plain(decimal(amount).minus(decimal(walk.filledInput)), 30)
              : undefined;
          const unsoldBaseAmount =
            side === 'sell'
              ? plain(decimal(amount).minus(decimal(walk.filledInput)), 30)
              : undefined;
          const minimumNotional = venueInstrument?.minimumNotional ?? book.minimumNotional;
          const minimumQuantity = venueInstrument?.minimumQuantity;
          const ruleNotional =
            side === 'buy'
              ? decimal(walk.filledInput)
              : decimal(executableBaseQuantity).mul(decimal(book.bids[0].price));
          const belowMinimum =
            (minimumQuantity && decimal(executableBaseQuantity).lt(decimal(minimumQuantity))) ||
            (minimumNotional && ruleNotional.lt(decimal(minimumNotional)));
          if (belowMinimum) {
            return {
              ...base,
              ...provenance,
              status: 'BELOW_MINIMUM',
              statusReason: 'Ukuran pasca-kuantisasi berada di bawah aturan minimum venue.',
              requestedQuoteBudget: side === 'buy' ? amount : undefined,
              requestedBaseQuantity: side === 'sell' ? amount : undefined,
              executableBaseQuantity,
              filledNotional,
              unspentQuoteAmount,
              unsoldBaseAmount,
              quantizationAdjustment,
              roundingMode: 'FLOOR',
              receivedAt: book.receivedAt,
              sourceEventAt: book.sourceEventAt,
              ageMs,
              freshnessIndependentlyVerified: book.freshnessIndependentlyVerified,
            };
          }

          const sufficient =
            side === 'buy' ? Boolean(rawBuy?.sufficient && walk.sufficient) : walk.sufficient;
          const withFee = this.applyFee(walk.grossOutcome, side, base.fee);
          return {
            ...base,
            ...provenance,
            status: sufficient ? 'ELIGIBLE' : 'INSUFFICIENT_DEPTH',
            statusReason: sufficient
              ? 'Snapshot sehat dan kedalaman terlihat mencukupi.'
              : 'Kedalaman terlihat tidak cukup untuk memenuhi seluruh ukuran.',
            grossOutcome: walk.grossOutcome,
            grossAveragePrice: walk.grossAveragePrice,
            topOfBookPrice: walk.topOfBookPrice,
            slippageBps: walk.slippageBps,
            filledInput: walk.filledInput,
            unfilledInput: side === 'buy' ? unspentQuoteAmount : unsoldBaseAmount,
            requestedQuoteBudget: side === 'buy' ? amount : undefined,
            requestedBaseQuantity: side === 'sell' ? amount : undefined,
            executableBaseQuantity,
            filledNotional,
            unspentQuoteAmount,
            unsoldBaseAmount,
            quantizationAdjustment,
            roundingMode: 'FLOOR',
            levelsConsumed: walk.levelsConsumed,
            receivedAt: book.receivedAt,
            sourceEventAt: book.sourceEventAt,
            ageMs,
            freshnessIndependentlyVerified: book.freshnessIndependentlyVerified,
            ...withFee,
          };
        } catch (error) {
          const rulesFailure =
            error instanceof Error &&
            ['unverified_rules', 'misaligned_rules'].includes(error.message);
          const schemaFailure =
            error instanceof ZodError ||
            (error instanceof Error &&
              (error.message.startsWith('invalid_decimal:') ||
                ['crossed_book', 'unsorted_book', 'empty_book', 'non_positive_book_level'].includes(
                  error.message,
                )));
          console.warn('market_source_rejected', {
            venue: adapter.venue,
            category: rulesFailure ? 'rules' : schemaFailure ? 'schema' : 'unavailable',
          });
          return {
            ...base,
            status: rulesFailure
              ? 'UNVERIFIED_RULES'
              : schemaFailure
                ? 'SCHEMA_ERROR'
                : 'UNAVAILABLE',
            statusReason: rulesFailure
              ? 'Aturan increment belum terverifikasi atau book tidak selaras; venue dikeluarkan.'
              : schemaFailure
                ? 'Data sumber gagal validasi dan dikeluarkan dari ranking.'
                : 'Sumber belum dapat dihubungi. Coba lagi nanti.',
          };
        }
      }),
    );

    const eligible = settled.filter(
      (result): result is VenueEstimate & { grossOutcome: string } =>
        result.status === 'ELIGIBLE' && typeof result.grossOutcome === 'string',
    );
    const allFeesVerified =
      eligible.length >= 2 &&
      eligible.every((result) => result.fee.status === 'VERIFIED' && result.netOutcome);
    const rankField: 'netOutcome' | 'grossOutcome' = allFeesVerified
      ? 'netOutcome'
      : 'grossOutcome';
    const winner =
      eligible.length >= 2
        ? eligible.reduce((best, current) =>
            decimal(current[rankField]!).gt(decimal(best[rankField]!)) ? current : best,
          )
        : undefined;

    return {
      schemaVersion: '1',
      request: { asset, quote: 'IDR', side, amount },
      generatedAt: new Date().toISOString(),
      rankingBasis: winner ? (allFeesVerified ? 'NET' : 'GROSS') : 'NONE',
      winner: winner?.venue,
      winnerLabel: winner
        ? `${allFeesVerified ? 'Estimasi net' : 'Estimasi gross'} terbaik berdasarkan ${eligible.length} dari 3 venue sehat.`
        : undefined,
      eligibleVenueCount: eligible.length,
      results: settled,
      disclosure: 'Estimasi, bukan kuotasi yang dapat dieksekusi atau jaminan hasil.',
      exclusions: [
        'fee akun atau tier pribadi',
        'pajak dan promosi',
        'transfer antar-exchange',
        'perubahan harga dan kedalaman setelah snapshot',
      ],
    };
  }

  private applyFee(
    grossOutcome: string,
    _side: Side,
    fee: FeeAssumption,
  ): { estimatedFee?: string; netOutcome?: string } {
    if (fee.status !== 'VERIFIED' || !fee.rate || !fee.source || !fee.asOf || !fee.version) {
      return {};
    }
    const gross = decimal(grossOutcome);
    const estimatedFee = gross.mul(decimal(fee.rate));
    return {
      estimatedFee: plain(estimatedFee),
      netOutcome: plain(gross.minus(estimatedFee)),
    };
  }
}

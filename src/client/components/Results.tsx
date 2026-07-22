import type {
  ComparisonResponse,
  EstimateStatus,
  Venue,
  VenueEstimate,
} from '@shared/contracts.js';
import {
  formatAsset,
  formatIdr,
  formatOutcome,
  formatTime,
  sizeBucket,
} from '@client/lib/format.js';
import { track } from '@client/lib/api.js';
import { ExternalLinkIcon, StatusIcon } from '@client/components/Icons.js';

const VENUE_NAMES: Record<Venue, string> = {
  INDODAX: 'Indodax',
  REKU: 'Reku',
  TOKOCRYPTO: 'Tokocrypto',
};

const statusPresentation: Record<
  EstimateStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'unavailable'; className: string }
> = {
  ELIGIBLE: {
    label: 'Layak dibandingkan',
    tone: 'success',
    className: 'state-success text-success',
  },
  INSUFFICIENT_DEPTH: {
    label: 'Depth tidak cukup',
    tone: 'warning',
    className: 'state-warning text-warning',
  },
  BELOW_MINIMUM: {
    label: 'Di bawah minimum',
    tone: 'warning',
    className: 'state-warning text-warning',
  },
  STALE: { label: 'Data stale', tone: 'warning', className: 'state-warning text-warning' },
  UNSYNCED: { label: 'Belum sinkron', tone: 'warning', className: 'state-warning text-warning' },
  SCHEMA_ERROR: { label: 'Data ditolak', tone: 'danger', className: 'state-danger text-danger' },
  UNAVAILABLE: { label: 'Tidak tersedia', tone: 'danger', className: 'state-danger text-danger' },
  UNSUPPORTED: {
    label: 'Tidak didukung',
    tone: 'unavailable',
    className: 'state-unavailable',
  },
  UNVERIFIED_RULES: {
    label: 'Aturan belum terverifikasi',
    tone: 'warning',
    className: 'state-warning text-warning',
  },
};

function Freshness({ estimate }: { estimate: VenueEstimate }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted">
      <span
        className={`status-dot mt-1 ${estimate.status === 'ELIGIBLE' ? 'text-success' : 'text-warning'}`}
        aria-hidden="true"
      />
      <span>
        Diterima {formatTime(estimate.receivedAt)} WIB
        <span className="block">
          {estimate.receivedAt ? `Usia ${Math.round((estimate.ageMs ?? 0) / 100) / 10} dtk · ` : ''}
          {estimate.freshnessIndependentlyVerified
            ? 'waktu sumber dapat diverifikasi'
            : 'berdasarkan waktu terima server'}
        </span>
        {estimate.transport && (
          <span className="block">
            {estimate.transport} / {estimate.synchronization ?? 'SNAPSHOT'}
            {estimate.liveRevision ? ` / revisi ${estimate.liveRevision}` : ''}
          </span>
        )}
      </span>
    </div>
  );
}

function EstimateCard({
  estimate,
  comparison,
}: {
  estimate: VenueEstimate;
  comparison: ComparisonResponse;
}) {
  const status = statusPresentation[estimate.status];
  const isWinner = comparison.winner === estimate.venue;
  const side = comparison.request.side;
  const quantityDigits = estimate.quantityIncrementRule.normalizedStep?.split('.')[1]?.length ?? 8;
  return (
    <article
      className={`hud-panel relative overflow-hidden p-5 ${isWinner ? 'border-primary ring-2 ring-primary/20' : ''}`}
      aria-label={`${VENUE_NAMES[estimate.venue]}: ${status.label}`}
    >
      {isWinner && (
        <div className="absolute right-0 top-0 border-b border-l border-primary bg-primary-soft px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-primary">
          Pilihan {comparison.rankingBasis.toLowerCase()}
        </div>
      )}
      <div className="flex items-center gap-3 pr-20">
        <div
          className="grid h-10 w-10 place-items-center rounded-sm border border-accent/40 bg-accent-soft font-display text-sm font-bold text-accent"
          aria-hidden="true"
        >
          {VENUE_NAMES[estimate.venue][0]}
        </div>
        <div>
          <h3 className="font-extrabold text-foreground">{VENUE_NAMES[estimate.venue]}</h3>
          <p className="text-xs text-muted">
            {estimate.venueSymbol} · {estimate.marketSegment}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-bold ${status.className}`}
        >
          <StatusIcon kind={status.tone} className="h-4 w-4 shrink-0" />
          {status.label}
        </span>
      </div>

      {estimate.grossOutcome ? (
        <>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            {side === 'buy' ? 'Aset diterima (gross)' : 'Dana diterima (gross)'}
          </p>
          <p className="mt-1 break-words font-data text-2xl font-semibold tracking-[-0.04em] text-foreground tabular-nums">
            {estimate.outcomeAsset === 'IDR'
              ? formatOutcome(estimate.grossOutcome, estimate.outcomeAsset)
              : formatAsset(estimate.grossOutcome, estimate.outcomeAsset, quantityDigits)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/50 py-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Harga rata-rata</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-foreground">
                {formatIdr(estimate.grossAveragePrice)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Slippage gross</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-foreground">
                {estimate.slippageBps ?? '—'} bps
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Level terpakai</dt>
              <dd className="mt-0.5 font-bold text-foreground">
                {estimate.levelsConsumed ?? '—'} level
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Belum terpenuhi</dt>
              <dd className="mt-0.5 font-bold text-foreground">
                {side === 'buy'
                  ? formatIdr(estimate.unfilledInput)
                  : formatAsset(estimate.unfilledInput, comparison.request.asset)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Kuantitas executable</dt>
              <dd className="mt-0.5 font-bold text-foreground">
                {formatAsset(
                  estimate.executableBaseQuantity,
                  comparison.request.asset,
                  quantityDigits,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Penyesuaian floor</dt>
              <dd className="mt-0.5 font-bold text-foreground">
                {formatAsset(
                  estimate.quantizationAdjustment,
                  comparison.request.asset,
                  quantityDigits,
                )}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="state-unavailable mt-5 rounded-md p-3 text-sm leading-6">
          {estimate.statusReason}
        </p>
      )}

      {estimate.grossOutcome && (
        <p className="mt-3 text-xs leading-5 text-muted">{estimate.statusReason}</p>
      )}
      <div className="mt-4 rounded-md border border-border/60 bg-surface-soft px-3.5 py-3 text-xs leading-5 text-muted">
        {estimate.fee.status === 'VERIFIED' ? (
          <>
            <strong>Estimasi fee:</strong>{' '}
            {formatOutcome(estimate.estimatedFee, estimate.outcomeAsset)} · net{' '}
            {formatOutcome(estimate.netOutcome, estimate.outcomeAsset)}
            <span className="block">
              Sumber {estimate.fee.source}, per {estimate.fee.asOf}
            </span>
          </>
        ) : (
          <>
            <strong>Fee belum terverifikasi.</strong> Nilai net dan pemenang net tidak dihitung.
          </>
        )}
      </div>
      <details className="mt-3 rounded-md border border-border px-3.5 py-1 text-xs text-muted">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/25">
          Provenance aturan increment
        </summary>
        <dl className="mt-2 grid gap-2">
          {estimate.inputIncrementRule && (
            <div>
              <dt className="font-bold">
                Input eksekusi ({estimate.inputDenomination === 'QUOTE' ? 'IDR' : 'aset'})
              </dt>
              <dd>
                {estimate.inputIncrementRule.sourceField} ={' '}
                {estimate.inputIncrementRule.sourceValue ?? 'tidak tersedia'} Â· step{' '}
                {estimate.inputIncrementRule.normalizedStep ?? estimate.inputIncrementRule.state}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-bold">Harga</dt>
            <dd>
              {estimate.priceIncrementRule.sourceField} ={' '}
              {estimate.priceIncrementRule.sourceValue ?? 'tidak tersedia'} ·{' '}
              {estimate.priceIncrementRule.sourceSemantics} · step{' '}
              {estimate.priceIncrementRule.normalizedStep ?? estimate.priceIncrementRule.state}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Kuantitas</dt>
            <dd>
              {estimate.quantityIncrementRule.sourceField} ={' '}
              {estimate.quantityIncrementRule.sourceValue ?? 'tidak tersedia'} ·{' '}
              {estimate.quantityIncrementRule.sourceSemantics} · step{' '}
              {estimate.quantityIncrementRule.normalizedStep ??
                estimate.quantityIncrementRule.state}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Versi & pembulatan</dt>
            <dd>
              {estimate.ruleMetadataVersion} · {estimate.roundingMode ?? 'tidak diterapkan'}
            </dd>
          </div>
        </dl>
      </details>
      <div className="mt-4">
        <Freshness estimate={estimate} />
      </div>
      <a
        href={estimate.externalUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          track({
            event: 'exchange_link_opened',
            pair: `${comparison.request.asset}-IDR`,
            side: comparison.request.side,
            sizeBucket: sizeBucket(comparison.request.side, comparison.request.amount),
            venue: estimate.venue,
          })
        }
        className="action-secondary mt-5 w-full"
      >
        Buka {VENUE_NAMES[estimate.venue]}
        <ExternalLinkIcon className="h-4 w-4" />
        <span className="sr-only">di tab baru</span>
      </a>
    </article>
  );
}

export function Results({ comparison }: { comparison: ComparisonResponse }) {
  return (
    <section className="mt-8" aria-labelledby="results-heading">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Snapshot {formatTime(comparison.generatedAt)} WIB</p>
          <h2
            id="results-heading"
            className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-foreground"
          >
            Hasil untuk {comparison.request.asset} / IDR
          </h2>
          <p className="mt-1 text-sm text-muted">
            {comparison.request.side === 'buy'
              ? `Budget ${formatIdr(comparison.request.amount)}`
              : `Jual ${formatAsset(comparison.request.amount, comparison.request.asset)}`}
          </p>
        </div>
        <div
          aria-live="polite"
          className={`max-w-xl rounded-md px-4 py-3 text-sm font-bold ${comparison.winner ? 'state-success text-success' : 'state-warning text-warning'}`}
        >
          {comparison.winnerLabel ??
            `Belum ada pemenang: hanya ${comparison.eligibleVenueCount} venue yang layak.`}
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {comparison.results.map((estimate) => (
          <EstimateCard key={estimate.venue} estimate={estimate} comparison={comparison} />
        ))}
      </div>
      <aside
        className="state-warning mt-5 rounded-md p-4 text-sm leading-6"
        aria-label="Pengungkapan estimasi"
      >
        <strong>Estimasi — bukan kuotasi yang dapat dieksekusi.</strong> {comparison.disclosure}{' '}
        Tidak mencakup {comparison.exclusions.join(', ')}. Periksa kembali harga dan ketentuan di
        exchange sebelum bertindak.
      </aside>
    </section>
  );
}

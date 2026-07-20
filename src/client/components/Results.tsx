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

const VENUE_NAMES: Record<Venue, string> = {
  INDODAX: 'Indodax',
  REKU: 'Reku',
  TOKOCRYPTO: 'Tokocrypto',
};

const statusPresentation: Record<
  EstimateStatus,
  { label: string; symbol: string; className: string }
> = {
  ELIGIBLE: {
    label: 'Layak dibandingkan',
    symbol: '✓',
    className: 'bg-emerald-50 text-emerald-800',
  },
  INSUFFICIENT_DEPTH: {
    label: 'Depth tidak cukup',
    symbol: '!',
    className: 'bg-amber-50 text-amber-900',
  },
  BELOW_MINIMUM: {
    label: 'Di bawah minimum',
    symbol: '!',
    className: 'bg-amber-50 text-amber-900',
  },
  STALE: { label: 'Data stale', symbol: '!', className: 'bg-amber-50 text-amber-900' },
  UNSYNCED: { label: 'Belum sinkron', symbol: '!', className: 'bg-amber-50 text-amber-900' },
  SCHEMA_ERROR: { label: 'Data ditolak', symbol: '×', className: 'bg-red-50 text-red-800' },
  UNAVAILABLE: { label: 'Tidak tersedia', symbol: '×', className: 'bg-red-50 text-red-800' },
  UNSUPPORTED: { label: 'Tidak didukung', symbol: '×', className: 'bg-slate-100 text-slate-700' },
  UNVERIFIED_RULES: {
    label: 'Aturan belum terverifikasi',
    symbol: '!',
    className: 'bg-amber-50 text-amber-900',
  },
};

function Freshness({ estimate }: { estimate: VenueEstimate }) {
  return (
    <div className="flex items-start gap-2 text-xs text-slate-500">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-mint" aria-hidden="true" />
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
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ${isWinner ? 'border-coral ring-2 ring-coral/15' : 'border-slate-200'}`}
      aria-label={`${VENUE_NAMES[estimate.venue]}: ${status.label}`}
    >
      {isWinner && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-coral px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
          Pilihan {comparison.rankingBasis.toLowerCase()}
        </div>
      )}
      <div className="flex items-center gap-3 pr-20">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-sm font-black text-white"
          aria-hidden="true"
        >
          {VENUE_NAMES[estimate.venue][0]}
        </div>
        <div>
          <h3 className="font-extrabold text-ink">{VENUE_NAMES[estimate.venue]}</h3>
          <p className="text-xs text-slate-500">
            {estimate.venueSymbol} · {estimate.marketSegment}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}
        >
          <span aria-hidden="true">{status.symbol}</span>
          {status.label}
        </span>
      </div>

      {estimate.grossOutcome ? (
        <>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {side === 'buy' ? 'Aset diterima (gross)' : 'Dana diterima (gross)'}
          </p>
          <p className="mt-1 break-words text-2xl font-black tracking-[-0.04em] text-ink">
            {estimate.outcomeAsset === 'IDR'
              ? formatOutcome(estimate.grossOutcome, estimate.outcomeAsset)
              : formatAsset(estimate.grossOutcome, estimate.outcomeAsset, quantityDigits)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Harga rata-rata</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-ink">
                {formatIdr(estimate.grossAveragePrice)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Slippage gross</dt>
              <dd className="mt-0.5 font-bold tabular-nums text-ink">
                {estimate.slippageBps ?? '—'} bps
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Level terpakai</dt>
              <dd className="mt-0.5 font-bold text-ink">{estimate.levelsConsumed ?? '—'} level</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Belum terpenuhi</dt>
              <dd className="mt-0.5 font-bold text-ink">
                {side === 'buy'
                  ? formatIdr(estimate.unfilledInput)
                  : formatAsset(estimate.unfilledInput, comparison.request.asset)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Kuantitas executable</dt>
              <dd className="mt-0.5 font-bold text-ink">
                {formatAsset(
                  estimate.executableBaseQuantity,
                  comparison.request.asset,
                  quantityDigits,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Penyesuaian floor</dt>
              <dd className="mt-0.5 font-bold text-ink">
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
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {estimate.statusReason}
        </p>
      )}

      {estimate.grossOutcome && (
        <p className="mt-3 text-xs leading-5 text-slate-600">{estimate.statusReason}</p>
      )}
      <div className="mt-4 rounded-xl bg-cream px-3.5 py-3 text-xs leading-5 text-slate-700">
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
      <details className="mt-3 rounded-xl border border-slate-200 px-3.5 py-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-bold text-ink">Provenance aturan increment</summary>
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
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-extrabold text-ink hover:border-coral hover:text-coral focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25"
      >
        Buka {VENUE_NAMES[estimate.venue]}{' '}
        <span className="ml-2" aria-hidden="true">
          ↗
        </span>
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">
            Snapshot {formatTime(comparison.generatedAt)} WIB
          </p>
          <h2
            id="results-heading"
            className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-ink"
          >
            Hasil untuk {comparison.request.asset} / IDR
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {comparison.request.side === 'buy'
              ? `Budget ${formatIdr(comparison.request.amount)}`
              : `Jual ${formatAsset(comparison.request.amount, comparison.request.asset)}`}
          </p>
        </div>
        <div
          aria-live="polite"
          className={`max-w-xl rounded-xl px-4 py-3 text-sm font-bold ${comparison.winner ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}
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
        className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
        aria-label="Pengungkapan estimasi"
      >
        <strong>Estimasi — bukan kuotasi yang dapat dieksekusi.</strong> {comparison.disclosure}{' '}
        Tidak mencakup {comparison.exclusions.join(', ')}. Periksa kembali harga dan ketentuan di
        exchange sebelum bertindak.
      </aside>
    </section>
  );
}

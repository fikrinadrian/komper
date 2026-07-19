import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import type {
  MarketChartPeriod,
  MarketChartResponse,
  MarketDetailVenue,
  MarketOverviewVenue,
  Venue,
} from '@shared/contracts.js';
import { getMarketChart, getMarketDetail, getMarkets } from '@client/lib/api.js';
import { formatAsset, formatIdr, formatTime } from '@client/lib/format.js';
import { buildAbsoluteChartSeries } from '@client/lib/market-chart.js';
import { Logo } from '@client/components/Logo.js';

const VENUES: Venue[] = ['INDODAX', 'REKU', 'TOKOCRYPTO'];
const VENUE_LABEL: Record<Venue, string> = {
  INDODAX: 'Indodax',
  REKU: 'Reku',
  TOKOCRYPTO: 'Tokocrypto',
};
const HighchartsPriceChart = lazy(() =>
  import('@client/components/HighchartsPriceChart.js').then((module) => ({
    default: module.HighchartsPriceChart,
  })),
);

function formatPercent(value?: string): string {
  if (value === undefined) return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${value}%`;
  return `${numeric > 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(numeric)}%`;
}

function formatDateTime(value?: string): string {
  if (!value) return 'Tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatAge(sourceAt: string | undefined, generatedAt: string): string {
  if (!sourceAt) return 'Tidak tersedia';
  const ageMs = Date.parse(generatedAt) - Date.parse(sourceAt);
  if (!Number.isFinite(ageMs)) return 'Tidak tersedia';
  const seconds = Math.max(0, Math.round(ageMs / 1_000));
  if (seconds < 60) return `${seconds} dtk`;
  return `${Math.round(seconds / 60)} mnt`;
}

function spread(bestBid?: string, bestAsk?: string): { idr: string; bps: string } | undefined {
  try {
    const bid = new Decimal(bestBid ?? '');
    const ask = new Decimal(bestAsk ?? '');
    if (!bid.isPositive() || ask.lessThan(bid)) return undefined;
    const absolute = ask.minus(bid);
    const midpoint = ask.plus(bid).div(2);
    return {
      idr: formatIdr(absolute.toFixed()),
      bps: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(
        absolute.div(midpoint).mul(10_000).toNumber(),
      )} bps`,
    };
  } catch {
    return undefined;
  }
}

function tradeNotional(price: string, quantity: string): string {
  try {
    return formatIdr(new Decimal(price).mul(quantity).toFixed(), true);
  } catch {
    return 'â€”';
  }
}

function venueFor(venues: MarketOverviewVenue[], venue: Venue): MarketOverviewVenue | undefined {
  return venues.find((item) => item.venue === venue);
}

function MarketHeader() {
  return (
    <header id="top" className="bg-navy text-white">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8"
      >
        <Logo />
        <div className="flex items-center gap-2 text-sm font-bold">
          <a
            href="/markets"
            className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/40"
          >
            Markets
          </a>
          <a
            href="/"
            className="rounded-lg border border-white/20 px-3 py-2 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/40"
          >
            Simulasi transaksi
          </a>
        </div>
      </nav>
    </header>
  );
}

function MarketFooter({ generatedAt }: { generatedAt?: string }) {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-8">
        <span>Komper Market Lens · Data publik observasional</span>
        <span>
          {generatedAt ? `Diperbarui ${formatDateTime(generatedAt)} WIB` : 'Waktu dalam WIB'}
        </span>
      </div>
    </footer>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6" role="status">
      <div className="h-5 w-44 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
      <div className="mt-5 h-28 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
      <h2 className="text-lg font-extrabold text-red-950">Data market gagal dimuat</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-5 rounded-xl bg-red-800 px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
      >
        Coba lagi
      </button>
    </div>
  );
}

function MissingValue({ reason }: { reason?: string }) {
  return (
    <span className="block text-sm text-slate-500">
      Tidak tersedia{reason ? <span className="mt-1 block text-xs">{reason}</span> : null}
    </span>
  );
}

export function MarketsPage() {
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(100);
  const markets = useQuery({
    queryKey: ['markets'],
    queryFn: getMarkets,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const filteredRows =
    markets.data?.rows.filter((row) =>
      row.pair.toLowerCase().includes(search.trim().toLowerCase()),
    ) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <MarketHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">
            Ringkasan market
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Harga terakhir, berdampingan.
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Bandingkan last price spot IDR yang dilaporkan setiap exchange. Buka pair untuk melihat
            pricing, order book, aktivitas transaksi, dan pergerakan OHLC pada waktu yang sama.
          </p>
        </div>

        <div className="mt-9">
          {markets.isPending && <LoadingPanel label="Mengambil ticker dari setiap exchange…" />}
          {markets.isError && (
            <ErrorPanel message={markets.error.message} retry={() => void markets.refetch()} />
          )}
          {markets.data && markets.data.rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
              <h2 className="text-lg font-extrabold">Belum ada pair untuk dibandingkan</h2>
              <p className="mt-2 text-sm text-slate-600">
                Market akan muncul setelah setidaknya satu sumber menyediakan ticker yang valid.
              </p>
            </div>
          )}
          {markets.data && markets.data.rows.length > 0 && (
            <section aria-labelledby="market-table-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="market-table-heading" className="text-xl font-extrabold">
                    Perbandingan last price
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Snapshot {formatDateTime(markets.data.generatedAt)} WIB
                  </p>
                </div>
                <label className="grid min-w-[16rem] gap-1.5 text-sm font-bold text-ink">
                  Cari pair
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setVisibleLimit(100);
                    }}
                    placeholder="Contoh: BTC"
                    className="input-control"
                  />
                </label>
                {markets.isFetching && !markets.isPending && (
                  <span className="text-xs font-bold text-slate-500" role="status">
                    Memperbarui…
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-panel">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <caption className="sr-only">
                    Last price setiap pair pada Indodax, Reku, dan Tokocrypto
                  </caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-4 font-extrabold">
                        Pair
                      </th>
                      {VENUES.map((venue) => (
                        <th scope="col" key={venue} className="px-5 py-4 font-extrabold">
                          {VENUE_LABEL[venue]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.slice(0, visibleLimit).map((row) => (
                      <tr key={row.pair} className="transition-colors hover:bg-slate-50/70">
                        <th scope="row" className="px-5 py-5">
                          <a
                            href={`/markets/${row.asset.toLowerCase()}-idr`}
                            className="inline-flex rounded-md font-extrabold text-ink underline decoration-coral/40 decoration-2 underline-offset-4 hover:decoration-coral focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25"
                          >
                            {row.asset}/IDR
                          </a>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            Lihat detail
                          </span>
                        </th>
                        {VENUES.map((venue) => {
                          const item = venueFor(row.venues, venue);
                          return (
                            <td key={venue} className="px-5 py-5 align-top">
                              {(item?.status === 'AVAILABLE' || item?.status === 'STALE') &&
                              item.ticker ? (
                                <>
                                  <span className="block font-extrabold tabular-nums">
                                    {formatIdr(item.ticker.lastPrice)}
                                  </span>
                                  <span
                                    className={`mt-1 block text-xs font-bold tabular-nums ${
                                      Number(item.ticker.priceChangePercent24h) > 0
                                        ? 'text-emerald-700'
                                        : Number(item.ticker.priceChangePercent24h) < 0
                                          ? 'text-red-700'
                                          : 'text-slate-500'
                                    }`}
                                  >
                                    {formatPercent(item.ticker.priceChangePercent24h)} · 24 jam
                                  </span>
                                  <span
                                    className={`mt-1 block text-xs font-bold ${
                                      item.status === 'STALE' ? 'text-red-700' : 'text-slate-500'
                                    }`}
                                  >
                                    {item.status === 'STALE' ? 'Stale' : 'Usia'} ·{' '}
                                    {formatAge(
                                      item.ticker.sourceEventAt ?? item.ticker.receivedAt,
                                      markets.data.generatedAt,
                                    )}
                                  </span>
                                </>
                              ) : (
                                <MissingValue reason={item?.reason} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length === 0 && (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">
                  Pair yang cocok tidak ditemukan.
                </p>
              )}
              {filteredRows.length > visibleLimit && (
                <button
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + 100)}
                  className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25"
                >
                  Tampilkan 100 pair berikutnya
                </button>
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500">{markets.data.disclosure}</p>
            </section>
          )}
        </div>
      </main>
      <MarketFooter generatedAt={markets.data?.generatedAt} />
    </div>
  );
}

const CHART_PERIODS: Array<{ value: MarketChartPeriod; label: string }> = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

function MovementChart({ pair }: { pair: string }) {
  const [period, setPeriod] = useState<MarketChartPeriod>('1d');
  const [lastSuccessfulData, setLastSuccessfulData] = useState<MarketChartResponse>();
  const chart = useQuery({
    queryKey: ['market-chart', pair, period],
    queryFn: ({ signal }) => getMarketChart(pair, period, signal),
    staleTime: 60_000,
    placeholderData: (previousData) =>
      previousData && previousData.pair.toLowerCase() === pair ? previousData : undefined,
  });
  useEffect(() => {
    if (chart.data && !chart.isPlaceholderData && !chart.isError) {
      setLastSuccessfulData(chart.data);
    }
  }, [chart.data, chart.isError, chart.isPlaceholderData]);
  const retainedData =
    lastSuccessfulData?.pair.toLowerCase() === pair ? lastSuccessfulData : undefined;
  const displayedData = chart.data ?? retainedData;
  const model = displayedData
    ? buildAbsoluteChartSeries(displayedData.venues, displayedData.interval)
    : undefined;
  const hasData = model?.series.some((item) => item.candles.length > 0) ?? false;
  const comparisonEligible = (model?.maxOverlappingVenues ?? 0) >= 2;
  const unavailable = model?.series.filter(
    (item) => item.status !== 'AVAILABLE' || item.candles.length === 0 || Boolean(item.reason),
  );
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
          role="group"
          aria-label="Timeframe grafik"
        >
          {CHART_PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
              className={`rounded-lg px-4 py-2 text-xs font-extrabold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25 ${
                period === item.value
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-slate-500 hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {chart.isFetching && !chart.isPending && (
          <span role="status" className="text-xs font-bold text-slate-500">
            {chart.isPlaceholderData
              ? `Memuat ${period.toUpperCase()} · grafik ${chart.data?.period.toUpperCase()} tetap ditampilkan…`
              : `Memperbarui grafik ${period.toUpperCase()}…`}
          </span>
        )}
      </div>

      {chart.isPending && (
        <LoadingPanel label={`Mengambil candle timeframe ${period.toUpperCase()}…`} />
      )}
      {chart.isError && (
        <ErrorPanel message={chart.error.message} retry={() => void chart.refetch()} />
      )}
      {chart.isError && retainedData && (
        <p role="status" className="mb-4 text-xs font-bold text-slate-600">
          Grafik {retainedData.period.toUpperCase()} terakhir tetap ditampilkan saat{' '}
          {period.toUpperCase()} dimuat ulang.
        </p>
      )}
      {displayedData && unavailable && unavailable.length > 0 && (
        <div
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"
          role="status"
        >
          <strong>Data grafik parsial.</strong>{' '}
          {unavailable
            .map((item) => `${VENUE_LABEL[item.venue]}: ${item.reason ?? 'candle tidak tersedia'}`)
            .join(' · ')}
        </div>
      )}
      {displayedData && !hasData && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Candle untuk timeframe ini belum tersedia di ketiga exchange.
        </div>
      )}
      {displayedData && model && hasData && (
        <>
          <p className="highcharts-description mb-3 text-xs leading-5 text-slate-600">
            {comparisonEligible
              ? `Line chart membandingkan harga close absolut ${displayedData.pair} pada waktu yang overlap.`
              : `Line chart ini hanya menampilkan histori observasional ${displayedData.pair} karena belum ada dua exchange yang overlap pada timestamp yang sama.`}{' '}
            Sumbu waktu menggunakan WIB. Titik kosong merupakan gap sumber dan tidak disambungkan.
          </p>
          <Suspense
            fallback={
              <div
                role="status"
                className="h-[410px] animate-pulse rounded-xl bg-slate-100 p-5 text-sm text-slate-500 motion-reduce:animate-none"
              >
                Menyiapkan visualisasi grafik…
              </div>
            }
          >
            <HighchartsPriceChart
              pair={pair}
              period={displayedData.period}
              model={model}
              comparisonEligible={comparisonEligible}
            />
          </Suspense>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Timeframe {displayedData.period.toUpperCase()} · interval candle{' '}
            {displayedData.interval} · snapshot {formatDateTime(displayedData.generatedAt)} WIB.
            Cakupan aktual {formatDateTime(new Date(model.timestamps[0]).toISOString())}–
            {formatDateTime(new Date(model.timestamps.at(-1)!).toISOString())} WIB. Harga adalah
            close tiap bucket OHLC, bukan kuotasi bid/ask yang dapat dieksekusi.
          </p>
          {displayedData.period === 'all' && (
            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              <p className="font-extrabold text-ink">Cakupan histori All per exchange</p>
              <ul className="mt-1 space-y-1">
                {displayedData.venues.map((venue) => (
                  <li key={venue.venue}>
                    {VENUE_LABEL[venue.venue]}:{' '}
                    {venue.coverageStartAt && venue.coverageEndAt
                      ? `${formatDateTime(venue.coverageStartAt)}–${formatDateTime(venue.coverageEndAt)} WIB · ${venue.candles.length} bucket`
                      : (venue.reason ?? 'Belum ada histori yang diterima')}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Awal histori mengikuti candle terverifikasi paling awal yang tersedia; exchange yang
                listing lebih baru akan memiliki leading gap.
              </p>
            </div>
          )}
          <details className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
            <summary className="cursor-pointer text-sm font-extrabold focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25">
              Data grafik aksesibel
            </summary>
            <div className="mt-4 max-h-80 overflow-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <caption className="sr-only">
                  Harga OHLC Indodax, Reku, dan Tokocrypto pada setiap waktu
                </caption>
                <thead className="sticky top-0 bg-white text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-3">
                      Waktu (WIB)
                    </th>
                    {model.series.map((item) => (
                      <th scope="col" key={item.venue} className="px-2 py-2 text-right">
                        {VENUE_LABEL[item.venue]} · O/H/L/C
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.timestamps.map((timestamp, rowIndex) => (
                    <tr key={timestamp} className="border-t border-slate-100">
                      <th scope="row" className="py-2 pr-3 font-medium">
                        {formatDateTime(new Date(timestamp).toISOString())}
                      </th>
                      {model.series.map((item) => {
                        const candle = item.candles.find(
                          (candidate) => Date.parse(candidate.openedAt) === timestamp,
                        );
                        return (
                          <td key={item.venue} className="px-2 py-2 text-right tabular-nums">
                            {item.points[rowIndex]?.[1] === null || !candle ? (
                              'Gap · tidak tersedia'
                            ) : (
                              <>
                                {formatIdr(candle.open, true)} / {formatIdr(candle.high, true)} /{' '}
                                {formatIdr(candle.low, true)} / {formatIdr(candle.close, true)}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function PricingComparison({
  venues,
  generatedAt,
}: {
  venues: MarketDetailVenue[];
  generatedAt: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[980px] text-left text-sm">
        <caption className="sr-only">Perbandingan pricing dan ticker 24 jam per exchange</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-4">
              Exchange
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Last price
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Bid / Ask
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Low / High 24j
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Perubahan 24j
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Spread
            </th>
            <th scope="col" className="px-5 py-4 text-right">
              Usia data
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {venues.map((item) => (
            <tr key={item.venue}>
              <th scope="row" className="px-5 py-4 font-extrabold">
                {VENUE_LABEL[item.venue]}
              </th>
              {item.status === 'AVAILABLE' && item.ticker ? (
                (() => {
                  const tickerSpread = spread(item.ticker.bestBid, item.ticker.bestAsk);
                  return (
                    <>
                      <td className="px-5 py-4 text-right font-extrabold tabular-nums">
                        {formatIdr(item.ticker.lastPrice)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {formatIdr(item.ticker.bestBid)} <span className="text-slate-400">/</span>{' '}
                        {formatIdr(item.ticker.bestAsk)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {formatIdr(item.ticker.low24h)} <span className="text-slate-400">/</span>{' '}
                        {formatIdr(item.ticker.high24h)}
                      </td>
                      <td className="px-5 py-4 text-right font-bold tabular-nums">
                        {formatPercent(item.ticker.priceChangePercent24h)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {tickerSpread ? (
                          <>
                            {tickerSpread.idr}
                            <span className="block text-xs text-slate-500">{tickerSpread.bps}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {item.components.ticker.status === 'STALE' ? 'Stale · ' : ''}
                        {formatAge(
                          item.ticker.sourceEventAt ?? item.ticker.receivedAt,
                          generatedAt,
                        )}
                      </td>
                    </>
                  );
                })()
              ) : (
                <td colSpan={6} className="px-5 py-4">
                  <MissingValue reason={item.components.ticker.reason ?? item.reason} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderBookComparison({ venues, asset }: { venues: MarketDetailVenue[]; asset: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {venues.map((item) => (
        <article key={item.venue} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-extrabold">{VENUE_LABEL[item.venue]}</h3>
          {item.orderBook ? (
            <div className="mt-4 grid gap-5">
              {(
                [
                  ['Bid', item.orderBook.bids, 'text-emerald-700'],
                  ['Ask', item.orderBook.asks, 'text-red-700'],
                ] as const
              ).map(([label, levels, color]) => {
                let cumulativeBase = new Decimal(0);
                let cumulativeNotional = new Decimal(0);
                const rows = levels.slice(0, 5).map((level) => {
                  const quantity = new Decimal(level.quantity);
                  cumulativeBase = cumulativeBase.plus(quantity);
                  cumulativeNotional = cumulativeNotional.plus(quantity.mul(level.price));
                  return {
                    ...level,
                    cumulativeBase: cumulativeBase.toFixed(),
                    cumulativeNotional: cumulativeNotional.toFixed(),
                  };
                });
                return (
                  <div key={label}>
                    <table className="w-full text-right text-xs tabular-nums">
                      <caption className={`mb-2 text-left font-extrabold ${color}`}>
                        {label}
                      </caption>
                      <thead className="text-slate-500">
                        <tr>
                          <th scope="col" className="pb-1 text-left">
                            Harga
                          </th>
                          <th scope="col" className="pb-1">
                            Qty
                          </th>
                          <th scope="col" className="pb-1">
                            Kum. qty
                          </th>
                          <th scope="col" className="pb-1">
                            Kum. IDR
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((level, index) => (
                          <tr key={`${level.price}-${index}`} className="border-t border-slate-100">
                            <td className="py-1 text-left">{formatIdr(level.price, true)}</td>
                            <td className="py-1">
                              {formatAsset(level.quantity, asset, 4).replace(` ${asset}`, '')}
                            </td>
                            <td className="py-1">
                              {formatAsset(level.cumulativeBase, asset, 4).replace(` ${asset}`, '')}
                            </td>
                            <td className="py-1">{formatIdr(level.cumulativeNotional, true)}</td>
                          </tr>
                        ))}
                        {levels.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-3 text-left text-slate-500">
                              Kosong
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {rows.length > 0 && rows.length < 5 && (
                      <p className="mt-1 text-left text-[11px] font-bold text-amber-700">
                        Hanya {rows.length} level tersedia pada snapshot ini.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              <MissingValue
                reason={item.components.orderBook.reason ?? 'Snapshot order book tidak tersedia.'}
              />
            </div>
          )}
          {item.orderBook && (
            <p className="mt-4 text-xs text-slate-500">
              Snapshot {formatTime(item.orderBook.sourceEventAt ?? item.orderBook.receivedAt)} WIB
              {!item.orderBook.freshnessIndependentlyVerified
                ? ' · Kesegaran belum diverifikasi independen'
                : ''}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function ActivityComparison({ venues, asset }: { venues: MarketDetailVenue[]; asset: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {venues.map((item) => (
        <article key={item.venue} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-extrabold">{VENUE_LABEL[item.venue]}</h3>
          {item.ticker ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Volume {asset} · 24j</dt>
                <dd className="mt-1 font-bold tabular-nums">
                  {formatAsset(item.ticker.baseVolume24h, asset, 4)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Volume IDR · 24j</dt>
                <dd className="mt-1 font-bold tabular-nums">
                  {formatIdr(item.ticker.quoteVolume24h, true)}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4">
              <MissingValue reason={item.components.ticker.reason ?? item.reason} />
            </div>
          )}
          <h4 className="mt-5 border-t border-slate-100 pt-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Transaksi publik terbaru
          </h4>
          {item.tradeSampleStatus === 'AVAILABLE' && item.trades?.length ? (
            <div className="mt-2 max-h-52 overflow-auto">
              <table className="w-full text-xs tabular-nums">
                <thead className="text-slate-500">
                  <tr>
                    <th scope="col" className="py-1 text-left">
                      Waktu
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Harga
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Qty
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Notional
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Sisi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {item.trades.slice(0, 10).map((trade) => (
                    <tr key={trade.id} className="border-t border-slate-100">
                      <td className="py-1.5 text-left">{formatTime(trade.occurredAt)}</td>
                      <td
                        className={`py-1.5 text-right ${trade.side === 'buy' ? 'text-emerald-700' : trade.side === 'sell' ? 'text-red-700' : ''}`}
                      >
                        {formatIdr(trade.price, true)}
                      </td>
                      <td className="py-1.5 text-right">
                        {formatAsset(trade.quantity, asset, 4).replace(` ${asset}`, '')}
                      </td>
                      <td className="py-1.5 text-right">
                        {tradeNotional(trade.price, trade.quantity)}
                      </td>
                      <td className="py-1.5 text-right font-bold">
                        {trade.side === 'buy' ? 'Beli' : trade.side === 'sell' ? 'Jual' : 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {item.components.trades.reason ?? 'Sampel transaksi publik tidak tersedia.'}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function OhlcTables({ venues }: { venues: MarketDetailVenue[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {venues.map((item) => (
        <article
          key={item.venue}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <h3 className="px-5 pt-5 font-extrabold">{VENUE_LABEL[item.venue]}</h3>
          {item.candles?.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[390px] text-right text-xs tabular-nums">
                <caption className="sr-only">OHLC 1 jam terbaru {VENUE_LABEL[item.venue]}</caption>
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">
                      Waktu
                    </th>
                    <th scope="col" className="px-2 py-2">
                      O
                    </th>
                    <th scope="col" className="px-2 py-2">
                      H
                    </th>
                    <th scope="col" className="px-2 py-2">
                      L
                    </th>
                    <th scope="col" className="px-3 py-2">
                      C
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...item.candles]
                    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))
                    .slice(0, 6)
                    .map((candle) => (
                      <tr key={candle.openedAt} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-left">{formatTime(candle.openedAt)}</td>
                        <td className="px-2 py-2">{formatIdr(candle.open, true)}</td>
                        <td className="px-2 py-2">{formatIdr(candle.high, true)}</td>
                        <td className="px-2 py-2">{formatIdr(candle.low, true)}</td>
                        <td className="px-3 py-2 font-bold">{formatIdr(candle.close, true)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <MissingValue
                reason={item.components.candles.reason ?? 'Candle 1 jam tidak tersedia.'}
              />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mb-5 max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

export function MarketDetailPage({ pair }: { pair: string }) {
  const markets = useQuery({
    queryKey: ['markets'],
    queryFn: getMarkets,
    staleTime: 60_000,
  });
  const overviewRow = markets.data?.rows.find((row) => `${row.asset.toLowerCase()}-idr` === pair);
  const supported = markets.data ? Boolean(overviewRow) : undefined;
  const sizeComparisonEligible = overviewRow?.venues.every((venue) => venue.status === 'AVAILABLE');
  const market = useQuery({
    queryKey: ['market-detail', pair],
    queryFn: () => getMarketDetail(pair),
    enabled: supported === true,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
  const label = pair.replace('-', '/').toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <MarketHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <ol className="flex items-center gap-2">
            <li>
              <a
                href="/markets"
                className="rounded underline underline-offset-4 hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25"
              >
                Markets
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-bold text-ink">
              {label}
            </li>
          </ol>
        </nav>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">
              Market detail
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{label}</h1>
            <p className="mt-3 text-slate-600">
              Perbandingan lintas exchange dalam satu pandangan.
            </p>
          </div>
          {!markets.isPending &&
            (sizeComparisonEligible ? (
              <a
                href={`/?asset=${encodeURIComponent(pair.split('-')[0].toUpperCase())}#top`}
                className="rounded-xl bg-navy px-5 py-3 text-sm font-extrabold text-white hover:bg-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/30"
              >
                Bandingkan simulasi transaksi
              </a>
            ) : (
              <span className="max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-600">
                Simulasi ukuran tersedia bila pair aktif di ketiga exchange.
              </span>
            ))}
        </div>

        <div className="mt-9">
          {markets.isPending && (
            <LoadingPanel label={`Memvalidasi pair ${label} pada katalog market…`} />
          )}
          {markets.isError && (
            <ErrorPanel message={markets.error.message} retry={() => void markets.refetch()} />
          )}
          {markets.data && supported === false && (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"
              role="alert"
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">
                Pair tidak didukung
              </p>
              <h2 className="mt-2 text-2xl font-black text-amber-950">{label} belum tersedia</h2>
              <p className="mt-2 text-sm text-amber-900">
                Pair ini tidak ada dalam katalog spot IDR terverifikasi. Tidak ada harga pengganti
                yang diminta atau ditampilkan.
              </p>
              <a
                href="/markets"
                className="mt-5 inline-flex rounded-xl bg-amber-900 px-5 py-3 text-sm font-extrabold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
              >
                Lihat pair yang tersedia
              </a>
            </div>
          )}
          {supported === true && market.isPending && (
            <LoadingPanel label={`Mengambil detail ${label} dari setiap exchange…`} />
          )}
          {supported === true && market.isError && (
            <ErrorPanel message={market.error.message} retry={() => void market.refetch()} />
          )}
          {market.data && (
            <div className="space-y-14">
              {market.isFetching && !market.isPending && (
                <p role="status" className="text-xs font-bold text-slate-500">
                  Memperbarui snapshot market…
                </p>
              )}
              {market.data.venues.some(
                (venue) => venue.status === 'UNAVAILABLE' || Boolean(venue.reason),
              ) && (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
                  role="status"
                >
                  <p>
                    <strong>Data parsial.</strong> Bagian yang tidak tersedia tetap ditandai dan
                    tidak diisi dengan estimasi.
                  </p>
                  <button
                    type="button"
                    onClick={() => void market.refetch()}
                    disabled={market.isFetching}
                    className="rounded-lg bg-amber-900 px-4 py-2 text-xs font-extrabold text-white disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
                  >
                    {market.isFetching ? 'Memuat ulang…' : 'Muat ulang snapshot'}
                  </button>
                </div>
              )}
              {market.data.venues.every((venue) => venue.status === 'UNAVAILABLE') && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
                  <h2 className="font-extrabold">Belum ada data untuk {label}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Pair dikenali, tetapi semua sumber sedang tidak tersedia.
                  </p>
                </div>
              )}

              <section aria-labelledby="pricing-heading">
                <div id="pricing-heading">
                  <SectionHeading
                    eyebrow="Pricing"
                    title="Ticker dan rentang 24 jam"
                    copy="Last price adalah transaksi terakhir yang dilaporkan sumber; bid dan ask menunjukkan top of book pada snapshot."
                  />
                </div>
                <PricingComparison
                  venues={market.data.venues}
                  generatedAt={market.data.generatedAt}
                />
              </section>

              <section aria-labelledby="movement-heading">
                <div id="movement-heading">
                  <SectionHeading
                    eyebrow="Perbandingan histori harga"
                    title="Last price ketiga exchange dalam satu chart"
                    copy="Line chart membandingkan harga close absolut tiap candle pada Indodax, Reku, dan Tokocrypto untuk timeframe 1 hari, 1 minggu, 1 tahun, atau seluruh histori yang tersedia."
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <MovementChart pair={pair} />
                </div>
              </section>

              <section aria-labelledby="orderbook-heading">
                <div id="orderbook-heading">
                  <SectionHeading
                    eyebrow="Likuiditas"
                    title="Order book per exchange"
                    copy="Lima level bid dan ask teratas ditampilkan apa adanya dari snapshot publik. Snapshot yang hilang tidak direkonstruksi."
                  />
                </div>
                <OrderBookComparison venues={market.data.venues} asset={market.data.asset} />
              </section>

              <section aria-labelledby="activity-heading">
                <div id="activity-heading">
                  <SectionHeading
                    eyebrow="Aktivitas transaksi"
                    title="Volume 24 jam dan public trades"
                    copy="Volume berasal dari ticker 24 jam, sedangkan daftar transaksi adalah sampel publik terbaru dan bukan riwayat lengkap."
                  />
                </div>
                <ActivityComparison venues={market.data.venues} asset={market.data.asset} />
              </section>

              <section aria-labelledby="ohlc-heading">
                <div id="ohlc-heading">
                  <SectionHeading
                    eyebrow="Data sumber grafik"
                    title="OHLC terbaru per exchange"
                    copy="Tabel ini mempertahankan harga absolut open, high, low, dan close untuk memeriksa angka di balik chart pergerakan."
                  />
                </div>
                <OhlcTables venues={market.data.venues} />
              </section>

              <p className="border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
                {market.data.disclosure}
              </p>
            </div>
          )}
        </div>
      </main>
      <MarketFooter generatedAt={market.data?.generatedAt} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComparisonResponse, Side } from '@shared/contracts.js';
import {
  getCatalog,
  getComparison,
  subscribeLiveComparison,
  track,
  type LiveConnectionState,
} from '@client/lib/api.js';
import { sizeBucket } from '@client/lib/format.js';
import { ComparisonForm } from '@client/components/ComparisonForm.js';
import { Logo } from '@client/components/Logo.js';
import { Results } from '@client/components/Results.js';
import { MarketDetailPage, MarketsPage } from '@client/components/MarketPages.js';
import { SignalIcon } from '@client/components/Icons.js';

type Submitted = { asset: string; side: Side; amount: string };

function LandingPage() {
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState<Submitted>();
  const [liveState, setLiveState] = useState<LiveConnectionState>();
  const trackedUpdate = useRef(0);
  const liveEnabled = import.meta.env.VITE_LIVE_COMPARISONS === 'true';
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 30_000 });
  const comparison = useQuery({
    queryKey: ['comparison', submitted],
    queryFn: () => getComparison(submitted!),
    enabled: Boolean(submitted),
    refetchInterval: submitted && (!liveEnabled || liveState === 'reconnecting') ? 15_000 : false,
  });

  useEffect(() => {
    if (!submitted || !liveEnabled) {
      setLiveState(undefined);
      return;
    }
    return subscribeLiveComparison(
      submitted,
      (next) => {
        queryClient.setQueryData<ComparisonResponse>(['comparison', submitted], next);
      },
      setLiveState,
    );
  }, [liveEnabled, queryClient, submitted]);

  useEffect(() => {
    const updateAt = comparison.dataUpdatedAt || comparison.errorUpdatedAt;
    if (!submitted || updateAt === 0 || trackedUpdate.current === updateAt) return;
    trackedUpdate.current = updateAt;
    const common = {
      pair: `${submitted.asset}-IDR`,
      side: submitted.side,
      sizeBucket: sizeBucket(submitted.side, submitted.amount),
    };
    if (comparison.data) {
      track({
        event: 'comparison_succeeded',
        ...common,
        eligibleVenueCount: comparison.data.eligibleVenueCount,
      });
    } else if (comparison.error) {
      track({ event: 'comparison_failed', ...common });
    }
  }, [
    comparison.data,
    comparison.dataUpdatedAt,
    comparison.error,
    comparison.errorUpdatedAt,
    submitted,
  ]);

  function submit(input: Submitted) {
    setSubmitted(input);
    const bucket = sizeBucket(input.side, input.amount);
    track({
      event: 'comparison_requested',
      pair: `${input.asset}-IDR`,
      side: input.side,
      sizeBucket: bucket,
    });
  }

  const sourceProblems = catalog.data?.sourceStatus.filter((source) => !source.ok) ?? [];
  const requestedAsset = new URLSearchParams(window.location.search).get('asset')?.toUpperCase();
  const initialAsset =
    requestedAsset && /^[A-Z0-9]{2,12}$/.test(requestedAsset) ? requestedAsset : 'BTC';
  return (
    <div id="top" className="app-shell">
      <header className="hud-header">
        <nav
          className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"
          aria-label="Navigasi utama"
        >
          <Logo />
          <div className="flex items-center gap-2 text-sm font-bold text-muted sm:gap-3">
            <a
              href="/markets"
              className="inline-flex min-h-11 items-center rounded-md px-3 hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
            >
              Markets
            </a>
            <a
              href="#methodology"
              className="hidden min-h-11 items-center rounded-md px-3 hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 sm:inline-flex"
            >
              Metodologi
            </a>
            <span className="hidden rounded-sm border border-accent/35 bg-accent-soft px-3 py-1.5 font-data text-xs uppercase tracking-wider text-accent md:inline-flex">
              Evaluasi internal
            </span>
          </div>
        </nav>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:pb-24 lg:pt-16">
          <div>
            <p className="eyebrow mb-5 inline-flex items-center gap-2 rounded-sm border border-success/40 bg-success-soft px-3 py-1.5 text-success">
              <SignalIcon className="h-4 w-4" /> Indodax · Reku · Tokocrypto
            </p>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[4rem]">
              Harga terbaik bukan selalu <span className="text-primary">harga terakhir.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
              Bandingkan estimasi hasil spot IDR berdasarkan beberapa level order book—beserta
              slippage, kedalaman, dan kondisi datanya.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-foreground/10 pt-6 text-sm">
              <div>
                <strong className="block font-data text-xl text-foreground tabular-nums">3</strong>
                <span className="text-muted">exchange bernama</span>
              </div>
              <div>
                <strong className="block font-data text-xl text-foreground">IDR</strong>
                <span className="text-muted">pair langsung saja</span>
              </div>
              <div>
                <strong className="block font-data text-xl text-foreground tabular-nums">0</strong>
                <span className="text-muted">kredensial diminta</span>
              </div>
            </div>
          </div>
          <div className="lg:translate-y-10">
            {catalog.isPending && (
              <div className="hud-panel-static p-7 text-foreground" role="status">
                <div className="h-5 w-32 animate-pulse rounded bg-surface-raised motion-reduce:animate-none" />
                <div className="mt-7 h-12 animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none" />
                <div className="mt-5 h-12 animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none" />
                <p className="mt-5 text-sm text-muted">Memvalidasi katalog pair publik…</p>
              </div>
            )}
            {catalog.isError && (
              <div className="hud-panel-static state-danger p-7 text-foreground" role="alert">
                <h2 className="text-xl font-extrabold">Katalog belum tersedia</h2>
                <p className="mt-2 text-sm text-muted">{catalog.error.message}</p>
                <button onClick={() => void catalog.refetch()} className="action-primary mt-5">
                  Coba lagi
                </button>
              </div>
            )}
            {catalog.data && (
              <ComparisonForm
                instruments={catalog.data.instruments}
                initialAsset={initialAsset}
                pending={comparison.isFetching}
                onSubmit={submit}
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 lg:pt-20">
        {sourceProblems.length > 0 && (
          <div role="status" className="state-warning mb-5 rounded-md p-4 text-sm">
            Sebagian metadata venue tidak tersedia:{' '}
            {sourceProblems.map((item) => item.venue).join(', ')}. Pair hanya ditampilkan bila
            cakupan tiga venue tervalidasi.
          </div>
        )}
        {comparison.isFetching && submitted && !comparison.data && (
          <div className="hud-panel-static p-8 text-center" role="status">
            Mengambil tiga snapshot order book dan memeriksa kesehatannya…
          </div>
        )}
        {comparison.isError && (
          <div className="state-danger rounded-md p-5" role="alert">
            <h2 className="font-extrabold text-danger">Perbandingan gagal dimuat</h2>
            <p className="mt-1 text-sm text-danger">{comparison.error.message}</p>
            <button onClick={() => void comparison.refetch()} className="action-danger mt-4">
              Coba lagi tanpa menghapus input
            </button>
          </div>
        )}
        {comparison.data && <Results comparison={comparison.data} />}
        {submitted && liveEnabled && (
          <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">
            {liveState === 'live'
              ? 'Pembaruan live tersambung.'
              : liveState === 'reconnecting'
                ? 'Pembaruan live terputus; mencoba menyambung kembali tanpa menghapus input.'
                : 'Menyambungkan pembaruan live...'}
          </p>
        )}
        {!submitted && catalog.data && (
          <section className="hud-panel-static border-dashed bg-surface/60 p-8 text-center">
            <p className="text-lg font-extrabold">
              Siap membandingkan ukuran nyata, bukan hanya ticker.
            </p>
            <p className="mt-2 text-sm text-muted">
              Pilih aset, arah, dan ukuran di atas untuk melihat estimasi per venue.
            </p>
          </section>
        )}

        <section
          id="methodology"
          className="mt-16 grid gap-8 border-t border-border pt-12 lg:grid-cols-[.7fr_1.3fr]"
        >
          <div>
            <p className="eyebrow">Cara kerja</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.045em]">
              Transparan sampai ke asumsi.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                '01',
                'Katalog intersection',
                'Hanya pair spot IDR langsung yang aktif di ketiga exchange yang bisa dipilih.',
              ],
              [
                '02',
                'Depth walking',
                'Ask untuk beli dan bid untuk jual dijalani per level dengan aritmetika desimal.',
              ],
              [
                '03',
                'Fail closed',
                'Data stale, crossed, invalid, atau tidak cukup tidak boleh menentukan pemenang.',
              ],
            ].map(([number, title, copy]) => (
              <article key={number} className="hud-panel p-5">
                <span className="font-data text-xs font-semibold text-accent">SYS_{number}</span>
                <h3 className="mt-3 font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <details className="hud-panel-static mt-10 p-5 open:shadow-glow">
          <summary className="flex min-h-11 cursor-pointer items-center font-extrabold focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/25">
            Cakupan dan batasan exchange
          </summary>
          <div className="mt-4 grid gap-5 text-sm leading-6 text-muted sm:grid-cols-2">
            <p>
              Market Lens saat ini hanya membandingkan{' '}
              <strong className="text-foreground">Indodax, Reku, dan Tokocrypto</strong>. Ini bukan
              cakupan semua exchange Indonesia. Katalog dihitung dari metadata pair IDR aktif yang
              tersedia di ketiganya.
            </p>
            <p>
              Produk tidak meminta API key, tidak mengetahui saldo, dan tidak mengeksekusi order.
              Hak penggunaan komersial data setiap exchange masih merupakan release gate; build ini
              ditandai evaluasi internal.
            </p>
          </div>
        </details>
      </main>
      <footer className="border-t border-border/70 bg-surface-strong">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Komper Market Lens · Estimasi observasional</span>
          <span>Waktu ditampilkan dalam WIB · Data publik saja</span>
        </div>
      </footer>
    </div>
  );
}

function currentRoute(): { page: 'landing' | 'markets' | 'detail' | 'not-found'; pair?: string } {
  const path = window.location.pathname;
  if (/^\/markets\/?$/i.test(path)) {
    if (path !== '/markets')
      window.history.replaceState(null, '', `/markets${window.location.search}`);
    return { page: 'markets' };
  }

  const detail = /^\/markets\/([^/]+)\/?$/i.exec(path);
  if (detail) {
    let pair: string;
    try {
      pair = decodeURIComponent(detail[1]).toLowerCase();
    } catch {
      return { page: 'not-found' };
    }
    if (/^[a-z0-9]{2,12}-idr$/.test(pair)) {
      const canonicalPath = `/markets/${pair}`;
      if (path !== canonicalPath) {
        window.history.replaceState(null, '', `${canonicalPath}${window.location.search}`);
      }
      return { page: 'detail', pair };
    }
    return { page: 'not-found' };
  }

  if (path !== '/') return { page: 'not-found' };
  return { page: 'landing' };
}

function NotFoundPage() {
  return (
    <div className="app-shell grid place-items-center px-5">
      <main className="hud-panel-static w-full max-w-lg p-8 text-center">
        <p className="eyebrow">SYS_404 · Not found</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">Route market tidak valid</h1>
        <p className="mt-3 leading-7 text-muted">
          Gunakan pair spot IDR dalam format seperti <span className="font-bold">btc-idr</span>.
        </p>
        <a href="/markets" className="action-primary mt-6">
          Kembali ke Markets
        </a>
      </main>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (route.page === 'markets') return <MarketsPage />;
  if (route.page === 'detail' && route.pair) return <MarketDetailPage pair={route.pair} />;
  if (route.page === 'not-found') return <NotFoundPage />;
  return <LandingPage />;
}

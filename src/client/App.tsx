import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Side } from '@shared/contracts.js';
import { getCatalog, getComparison, track } from '@client/lib/api.js';
import { sizeBucket } from '@client/lib/format.js';
import { ComparisonForm } from '@client/components/ComparisonForm.js';
import { Logo } from '@client/components/Logo.js';
import { Results } from '@client/components/Results.js';

type Submitted = { asset: string; side: Side; amount: string };

export function App() {
  const [submitted, setSubmitted] = useState<Submitted>();
  const trackedUpdate = useRef(0);
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 30_000 });
  const comparison = useQuery({
    queryKey: ['comparison', submitted],
    queryFn: () => getComparison(submitted!),
    enabled: Boolean(submitted),
    refetchInterval: submitted ? 15_000 : false,
  });

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
  return (
    <div id="top" className="min-h-screen bg-cream text-ink">
      <header className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-coral/10 blur-3xl" />
        <nav
          className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"
          aria-label="Navigasi utama"
        >
          <Logo />
          <div className="flex items-center gap-5 text-sm font-bold text-white/75">
            <a
              href="#methodology"
              className="hidden rounded-md hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/40 sm:inline"
            >
              Metodologi
            </a>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85">
              Evaluasi internal
            </span>
          </div>
        </nav>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:pb-24 lg:pt-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.15em] text-[#8ff1dc]">
              <span aria-hidden="true">◎</span> Indodax · Reku · Tokocrypto
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.055em] sm:text-5xl lg:text-[4.25rem]">
              Harga terbaik bukan selalu <span className="text-coral">harga terakhir.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Bandingkan estimasi hasil spot IDR berdasarkan beberapa level order book—beserta
              slippage, kedalaman, dan kondisi datanya.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-white/10 pt-6 text-sm">
              <div>
                <strong className="block text-xl text-white">3</strong>
                <span className="text-slate-400">exchange bernama</span>
              </div>
              <div>
                <strong className="block text-xl text-white">IDR</strong>
                <span className="text-slate-400">pair langsung saja</span>
              </div>
              <div>
                <strong className="block text-xl text-white">0</strong>
                <span className="text-slate-400">kredensial diminta</span>
              </div>
            </div>
          </div>
          <div className="lg:translate-y-10">
            {catalog.isPending && (
              <div className="rounded-[1.75rem] bg-white p-7 text-ink shadow-panel" role="status">
                <div className="h-5 w-32 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
                <div className="mt-7 h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
                <div className="mt-5 h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
                <p className="mt-5 text-sm text-slate-500">Memvalidasi katalog pair publik…</p>
              </div>
            )}
            {catalog.isError && (
              <div className="rounded-[1.75rem] bg-white p-7 text-ink shadow-panel" role="alert">
                <h2 className="text-xl font-extrabold">Katalog belum tersedia</h2>
                <p className="mt-2 text-sm text-slate-600">{catalog.error.message}</p>
                <button
                  onClick={() => void catalog.refetch()}
                  className="mt-5 rounded-xl bg-coral px-5 py-3 font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/30"
                >
                  Coba lagi
                </button>
              </div>
            )}
            {catalog.data && (
              <ComparisonForm
                instruments={catalog.data.instruments}
                pending={comparison.isFetching}
                onSubmit={submit}
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 lg:pt-20">
        {sourceProblems.length > 0 && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            Sebagian metadata venue tidak tersedia:{' '}
            {sourceProblems.map((item) => item.venue).join(', ')}. Pair hanya ditampilkan bila
            cakupan tiga venue tervalidasi.
          </div>
        )}
        {comparison.isFetching && submitted && !comparison.data && (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-8 text-center"
            role="status"
          >
            Mengambil tiga snapshot order book dan memeriksa kesehatannya…
          </div>
        )}
        {comparison.isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
            <h2 className="font-extrabold text-red-900">Perbandingan gagal dimuat</h2>
            <p className="mt-1 text-sm text-red-800">{comparison.error.message}</p>
            <button
              onClick={() => void comparison.refetch()}
              className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
            >
              Coba lagi tanpa menghapus input
            </button>
          </div>
        )}
        {comparison.data && <Results comparison={comparison.data} />}
        {!submitted && catalog.data && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
            <p className="text-lg font-extrabold">
              Siap membandingkan ukuran nyata, bukan hanya ticker.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Pilih aset, arah, dan ukuran di atas untuk melihat estimasi per venue.
            </p>
          </section>
        )}

        <section
          id="methodology"
          className="mt-16 grid gap-8 border-t border-slate-200 pt-12 lg:grid-cols-[.7fr_1.3fr]"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Cara kerja</p>
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
              <article key={number} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <span className="text-xs font-black text-coral">{number}</span>
                <h3 className="mt-3 font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <details className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 open:shadow-sm">
          <summary className="cursor-pointer font-extrabold focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25">
            Cakupan dan batasan exchange
          </summary>
          <div className="mt-4 grid gap-5 text-sm leading-6 text-slate-600 sm:grid-cols-2">
            <p>
              Market Lens saat ini hanya membandingkan{' '}
              <strong className="text-ink">Indodax, Reku, dan Tokocrypto</strong>. Ini bukan cakupan
              semua exchange Indonesia. Katalog dihitung dari metadata pair IDR aktif yang tersedia
              di ketiganya.
            </p>
            <p>
              Produk tidak meminta API key, tidak mengetahui saldo, dan tidak mengeksekusi order.
              Hak penggunaan komersial data setiap exchange masih merupakan release gate; build ini
              ditandai evaluasi internal.
            </p>
          </div>
        </details>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Komper Market Lens · Estimasi observasional</span>
          <span>Waktu ditampilkan dalam WIB · Data publik saja</span>
        </div>
      </footer>
    </div>
  );
}

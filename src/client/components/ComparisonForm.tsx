import { useEffect, useState, type FormEvent } from 'react';
import { decimalInputSchema, type CatalogInstrument, type Side } from '@shared/contracts.js';
import { formatAsset, formatIdr } from '@client/lib/format.js';
import { ArrowRightIcon, SignalIcon } from '@client/components/Icons.js';

type Props = {
  instruments: CatalogInstrument[];
  initialAsset?: string;
  pending: boolean;
  onSubmit: (input: { asset: string; side: Side; amount: string }) => void;
};

const buyPresets = ['1000000', '5000000', '10000000'];
const sellPresets = ['0.01', '0.1', '1'];

export function ComparisonForm({ instruments, initialAsset = 'BTC', pending, onSubmit }: Props) {
  const selectable = instruments.filter((item) => item.selectable);
  const [asset, setAsset] = useState(initialAsset);
  const [side, setSide] = useState<Side>('buy');
  const [amount, setAmount] = useState('5000000');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!selectable.some((item) => item.asset === asset) && selectable[0])
      setAsset(selectable[0].asset);
  }, [asset, selectable]);

  function chooseSide(next: Side) {
    setSide(next);
    setAmount(next === 'buy' ? '5000000' : '0.1');
    setError(undefined);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = decimalInputSchema.safeParse(amount);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Nilai tidak valid.');
      return;
    }
    setError(undefined);
    onSubmit({ asset, side, amount: parsed.data });
  }

  const presets = side === 'buy' ? buyPresets : sellPresets;
  return (
    <form
      onSubmit={submit}
      className="hud-panel-static p-5 sm:p-7"
      aria-labelledby="compare-heading"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Pembanding spot IDR</p>
          <h2
            id="compare-heading"
            className="text-2xl font-extrabold tracking-[-0.035em] text-foreground"
          >
            Rencanakan ukuran transaksimu
          </h2>
        </div>
        <span className="hidden items-center gap-2 rounded-sm border border-success/35 bg-success-soft px-3 py-1.5 text-xs font-bold text-success sm:inline-flex">
          <SignalIcon className="h-4 w-4" /> Data publik
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-foreground">
          Aset
          <select
            value={asset}
            onChange={(event) => setAsset(event.target.value)}
            className="input-control"
            disabled={!selectable.length}
          >
            {selectable.map((item) => (
              <option key={item.asset} value={item.asset}>
                {item.asset} / IDR
              </option>
            ))}
          </select>
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-bold text-foreground">Arah transaksi</legend>
          <div
            className="grid grid-cols-2 rounded-xl bg-surface-raised/70 p-1"
            role="radiogroup"
            aria-label="Arah transaksi"
          >
            {(['buy', 'sell'] as const).map((value) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 py-2.5 text-center text-sm font-extrabold transition-colors duration-ui has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-focus/30 ${side === value ? 'bg-primary-soft text-primary ring-1 ring-primary/35' : 'text-muted hover:bg-surface-soft hover:text-foreground'}`}
              >
                <input
                  type="radio"
                  name="side"
                  value={value}
                  checked={side === value}
                  onChange={() => chooseSide(value)}
                  className="sr-only"
                />
                {value === 'buy' ? 'Beli' : 'Jual'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="mt-5 grid gap-2 text-sm font-bold text-foreground" htmlFor="trade-size">
        {side === 'buy' ? 'Budget pembelian' : 'Jumlah aset yang dijual'}
        <span className="relative">
          {side === 'buy' && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-muted">
              Rp
            </span>
          )}
          <input
            id="trade-size"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(',', '.'))}
            className={`input-control w-full text-lg font-extrabold tabular-nums ${side === 'buy' ? 'pl-12' : 'pr-16'}`}
            aria-describedby="size-preview size-error"
            aria-invalid={Boolean(error)}
          />
          {side === 'sell' && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-extrabold text-muted">
              {asset}
            </span>
          )}
        </span>
      </label>
      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs">
        <span id="size-preview" className="text-muted">
          {decimalInputSchema.safeParse(amount).success
            ? `Dibaca sebagai ${
                side === 'buy'
                  ? formatIdr(amount)
                  : formatAsset(amount, asset, amount.split('.')[1]?.length ?? 8)
              }`
            : 'Masukkan angka tanpa pemisah ribuan.'}
        </span>
        <span id="size-error" role="alert" className="font-bold text-danger">
          {error}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Pilihan ukuran cepat">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className="min-h-11 rounded-md border border-border bg-surface-soft px-3 py-2 text-xs font-bold text-muted transition-colors duration-ui hover:border-primary hover:text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
          >
            {side === 'buy' ? formatIdr(preset, true) : formatAsset(preset, asset)}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending || !selectable.length}
        className="action-primary mt-6 min-h-12 w-full text-base disabled:cursor-wait"
      >
        {pending ? 'Mengambil snapshot…' : 'Bandingkan estimasi'}
        <ArrowRightIcon className="h-5 w-5" />
      </button>
    </form>
  );
}

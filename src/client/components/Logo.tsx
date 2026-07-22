export function Logo() {
  return (
    <a
      href="/"
      className="group inline-flex min-h-11 items-center gap-3 rounded-md focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/35"
      aria-label="Komper Market Lens, beranda"
    >
      <svg
        viewBox="0 0 40 40"
        className="h-9 w-9 shrink-0 text-primary drop-shadow-[0_0_9px_rgb(var(--color-primary)/.38)]"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M8 4h19l5 5v23H13l-5-5V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M14 11h12v4H18v10h8v4H14V11Z" fill="currentColor" />
        <path d="M28 4v7h7" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="font-display text-base font-bold uppercase tracking-[0.08em] text-foreground sm:text-lg">
        Komper<span className="text-accent">_</span>
      </span>
    </a>
  );
}

export function Logo() {
  return (
    <a
      href="#top"
      className="group inline-flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/35"
      aria-label="Komper Market Lens, ke atas"
    >
      <span
        className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-coral text-white shadow-lg shadow-coral/20"
        aria-hidden="true"
      >
        <span className="absolute h-5 w-5 rotate-45 rounded-sm border-2 border-white/90" />
        <span className="h-2 w-2 rounded-full bg-navy" />
      </span>
      <span className="text-lg font-extrabold tracking-[-0.03em] text-white">
        komper<span className="text-coral">.</span>
      </span>
    </a>
  );
}

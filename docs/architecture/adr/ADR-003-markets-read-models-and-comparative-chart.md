# ADR-003: Evolve a bounded Markets snapshot into capability read models with a shared-baseline price overlay

- Status: Proposed
- Date: 2026-07-18
- Owners: CTO
- Related PRD/architecture: [Market Lens PRD](../../product/market-lens-prd.md); [Komper Market Lens architecture](../market-lens-architecture.md); [ADR-001: Market-data ingestion and normalization](./ADR-001-market-data-ingestion-and-normalization.md); [ADR-002: Live market data and browser delivery](./ADR-002-live-market-data-and-browser-delivery.md)

## Context

The Markets extension needs an overview at `/markets` and a pair detail at `/markets/:pair`. The overview compares last traded prices across Indodax, Reku, and Tokocrypto. Detail compares ticker statistics, order books, transaction activity, and OHLC history, with all venues' price movement visible in one chart.

The venue contracts are asymmetric. Reku documents REST OHLC arrays in a nonstandard `open, close, low, high` order and public market/trade streams. Tokocrypto documents type-specific REST and WebSocket hosts, standard klines, raw or aggregate trades, and a rolling mini-ticker. Indodax documents REST ticker/trades/depth and WebSocket chart ticks, summaries, trades, and order books, but the supplied public collection does not establish a historical OHLC REST endpoint. Update times, ticker windows, side semantics, event aggregation, and sequence guarantees also differ.

A client that calls exchanges directly would duplicate normalization, expose upstream topology, make bounds difficult to enforce, and turn partial venue failure into inconsistent UI behavior. A single monolithic detail response would couple panels with different refresh rates and make an OHLC failure erase healthy order-book or ticker data. Drawing three candlestick series in the same plot would occlude values; independently rebasing venue lines at different timestamps would create a misleading movement comparison.

The application currently has no routing dependency. Phase 1 introduces only two read-only Markets path patterns and a fixed chart interval/range; richer URL search state and nested Markets navigation are follow-up concerns.

## Decision drivers

- Make last price, executable order-book price, trade activity, and candle history distinct concepts.
- Preserve provenance, freshness, coverage, and unsupported capability states rather than manufacturing symmetric data.
- Isolate venue and panel failures and bound upstream load.
- Provide one readable, reproducible cross-venue price-movement chart.
- Support deep links and validated range/interval state without a second client data cache.
- Keep direct-IDR identity and public-data security boundaries from ADR-001.
- Make gaps, partial candles, and unavailable historical coverage visible.

## Options considered

### Option A: Client-side exchange fan-out and normalization

The browser calls each venue for ticker, depth, trades, and candles, then maps and compares the responses.

- Benefits:
  - Minimal new BFF surface.
  - Low server compute and storage for data a browser can fetch.
- Costs/risks:
  - Exposes venue hosts and inconsistent CORS/rate-limit behavior to users.
  - Duplicates validation, decimal, symbol, time-unit, and Tokocrypto segment routing logic.
  - Cannot provide one controlled cache, bounded fan-out, historical coverage policy, or trustworthy partial-failure contract.
  - Makes schema drift a client release problem and weakens observability.

### Option B: One monolithic pair-detail endpoint and overlaid candlesticks

The BFF returns ticker, full books, trades, and candles for every venue in one response. The client draws each OHLC series as candlesticks in the same coordinate space.

- Benefits:
  - One request and one loading state.
  - Raw absolute IDR prices remain visible.
- Costs/risks:
  - Different data sizes, refresh cadences, and failure modes are coupled.
  - One slow candle source delays current ticker and book data.
  - Three candlestick bodies and wicks overlap, obscuring which venue moved.
  - Payload and retry costs are high even when only one panel needs refresh.

### Option C: Progressive BFF snapshot-to-capability read models with a shared-baseline close overlay

The BFF provides a batched overview and, for phase 1, one bounded pair-detail snapshot whose ticker, order-book, trade, and candle adapter attempts settle independently. The aggregate returns per-component availability and per-venue health/provenance. When observed cadence, payload, or failure-coupling costs justify it, the same components are exposed as separate capability projections without changing their canonical semantics. Canonical OHLC is returned, while a comparative series rebases each venue's close-price percentage change to `0%` at the earliest shared valid closed bucket. Later missing points remain gaps.

A centralized phase-1 parser owns `/`, `/markets`, and `/markets/:pair` with native history behavior. TanStack Query remains the only network cache. TanStack Router is introduced only when richer URL search state, nested navigation, loaders, or coordinated route pending states create a concrete need.

- Benefits:
  - Localizes normalization and upstream safety controls.
  - Preserves a path to panel-specific refresh, cache, retry, and rollback after phase-1 evidence.
  - Makes missing venue coverage and history explicit.
  - Produces a readable comparison with one reproducible baseline instant.
  - Provides stable deep links and route-level error/not-found behavior.
- Costs/risks:
  - Adds API contracts and more integration tests; later capability extraction may add client request coordination.
  - Requires bounded historical candle storage where a venue cannot backfill.
  - Normalized movement hides absolute price differences unless the UI exposes raw OHLC alongside it.

## Decision

Choose Option C as a progressive decision: ship the bounded aggregated detail snapshot in phase 1, retain capability-specific endpoints as the approved extraction path, and defer a router dependency until its triggers occur.

### Routes and identity

- Add no routing dependency in phase 1. Use one centralized, exhaustive path parser for `/`, `/markets`, and `/markets/:pair`, plus native links/history so direct reload and browser back/forward work. Do not place fetched market data in history or route-local caches.
- Adopt TanStack Router when `interval`/`range` become validated URL search state, Markets gains nested layouts/navigation, route loaders/pending states need coordination, or new patterns would make the hand-written parser non-trivial. The router must not duplicate TanStack Query's network cache.
- Use `/markets` for the overview and canonical lower-case `/markets/:pair`, such as `/markets/btc-idr`, for detail. Only direct IDR quote pairs are accepted in this release.
- Parse the path case-insensitively and replace non-canonical casing with lower-case. Reject malformed pair shapes before lookup. A syntactically valid pair missing from the canonical registry is a market-not-found state.
- The Markets overview is the union of verified active direct-IDR instruments and displays missing venue cells. Existing effective-price comparison remains the three-venue intersection. Comparative claims require at least two healthy venues.

### Read-model APIs

Provide versioned, bounded resources progressively:

- `GET /api/markets?quote=IDR&limit=100&cursor=...` for the paginated overview. It uses at most one batched ticker operation per venue per refresh, not one upstream call per pair.
- `GET /api/markets/:pair` is the phase-1 snapshot for identity and per-venue ticker, bounded order book, bounded recent trades, fixed-range OHLC, component availability, and health. Component adapter calls settle independently, so one unavailable component is represented instead of failing healthy data.
- `GET /api/markets/:pair/order-books?depth=20` is the approved follow-up for at most 100 canonical levels per side and comparable spread/liquidity summaries.
- `GET /api/markets/:pair/trades?window=15m&limit=50` is the approved follow-up for at most 100 recent normalized trades/aggregates and same-window activity summaries.
- `GET /api/markets/:pair/candles?interval=1h&range=24h` is the approved follow-up for canonical OHLCV and comparative normalized percentage closes, capped at 500 buckets per venue.

Every successful projection contains `schemaVersion`, `generatedAt`, canonical instrument identity, and per-venue status, reason, source time when available, receive time, age, market segment, and venue symbol. A projection returns `200` with explicit unavailable venue entries when it can build the response. The stable error envelope distinguishes malformed input, unknown markets, unsupported range/interval combinations, product rate limiting, and inability to build the projection.

Live overview/detail payloads use HTTP `no-store`; the BFF provides short, health-aware caches and single-flight request coalescing. In phase 1 the detail uses one bounded polling cadence and one retry because it is one snapshot. This can make a slow capability delay the full response and retransmit unchanged candles with faster ticker/book data; component latency, payload, and retry-waste metrics are required residual-risk evidence. After extraction, closed candle history may use an `ETag`, panel polling can use separate cadence/retry, and a current open bucket remains explicitly non-final. Polling pauses when hidden/offline and backs off with jitter. BFF push can replace polling later without changing canonical payloads.

### Canonical semantics

- Ticker last price is the latest reported trade/close, not an executable quote. Normalize optional open/high/low, best bid/ask, base/quote volume, and rolling-window provenance without filling absent fields.
- Order books retain canonical decimal levels and health rules from ADR-001. Comparable liquidity is summarized within fixed basis-point bands around a validated midpoint; a fixed number of displayed rows is not treated as equal economic depth.
- Trades retain raw versus aggregate granularity. Normalize trade time, price, base quantity, derived quote notional, and taker/aggressor side only when semantics are verified. For Tokocrypto, `isBuyerMaker=true` maps to a sell aggressor only after segment fixtures validate the documented behavior. Unknown semantics remain `UNKNOWN`.
- Candles use half-open UTC buckets, canonical `open/high/low/close`, optional base/quote volume and trade count, `isClosed`, coverage status, and provenance. Reku's array ordering and venue time units are adapter concerns. Indodax ticks/trades may be aggregated into candles; unavailable time before collection began is not backfilled or forward-filled.

### Comparative chart

- Return raw canonical OHLCV for inspection, tooltip, and an accessible data table. The primary one-chart comparison overlays normalized close-price percentage lines; do not overlay three candlestick series.
- Select the earliest closed bucket in the requested range for which every included healthy venue has a valid close. Set this as `commonBaselineAt` and calculate `normalizedChangePercent = (close / baselineClose - 1) * 100` with decimal arithmetic.
- Return each venue's baseline price and raw close with every normalized point. The value `0%` means unchanged from the same shared instant; `1%` means a one-percent rise.
- Exclude a venue that lacks a common baseline or enough valid buckets and return the reason. Preserve later missing buckets as gaps. Never interpolate or independently rebase a venue.
- Permit only adapter-verified interval/range combinations and no more than 500 buckets per venue.

## Consequences

Positive consequences:

- A failed component is explicit inside the phase-1 snapshot, and the contract can be extracted without changing canonical semantics.
- Venue differences and data age remain visible instead of being hidden by a lowest-common-denominator client model.
- Overview load is bounded and observable, and canonical paths are stable shareable URLs.
- Movement comparison is visually readable and mathematically reproducible while raw OHLC remains available.

Negative consequences:

- The BFF gains normalized component projections and historical storage/aggregation work; later endpoint extraction adds panel-specific operations.
- The small phase-1 path parser is intentionally limited and must be replaced, not expanded indefinitely, when router triggers occur.
- A slow component can delay the entire aggregated snapshot, all components share one refresh/retry cadence, and static candles may be retransferred with fast data until capability endpoints are extracted.
- Indodax chart ranges remain limited until sufficient verified ticks/trades have been retained.
- Ticker and transaction metrics may still be non-comparable when window or granularity provenance differs; the product must label or suppress those comparisons.

## Migration and rollback

1. Extend capability contracts and fixtures for ticker, trades, and candles without exposing routes.
2. Run batched ticker and candle/trade normalization in shadow mode. Measure schema acceptance, source time, coverage, rate limits, and overview payload size.
3. Add the bounded path parser and overview behind a `marketsOverview` feature flag. Existing root comparison remains independently usable.
4. Enable the aggregated pair-detail snapshot with bounded, independently settled components and fixed chart controls.
5. Begin bounded OHLC collection and enable only interval/range pairs with measured coverage. Backfill solely from verified native endpoints.
6. Enable comparative overlay after common-baseline and gap tests pass.
7. Use measured component latency, payload, refresh cadence, and retry waste to extract order-book, trades, and candles. Introduce TanStack Router only when the documented route triggers occur.

Rollback can disable the overview, individual detail capabilities, a venue segment, or an interval/range independently. Disabling candles does not remove the pair detail route. Stored canonical candles remain versioned and can expire under retention policy; rollback never relabels partial history as complete.

## Validation

- Route tests cover exhaustive phase-1 pattern matching, canonicalization, malformed and unknown pairs, deep-link reload, not-found UI, native back/forward navigation, focus, and scroll behavior. Interval/range search validation is added with the router trigger that exposes those controls in the URL.
- API contract tests cover pagination, deterministic ordering, all bounds, stable errors, per-venue partial failure, age/status propagation, and absence of upstream N+1 calls.
- Venue fixtures cover ticker windows, trade/aggregate granularity and side semantics, Reku candle field order, Tokocrypto segment routing, Indodax tick aggregation, and seconds-versus-milliseconds validation.
- Candle property tests cover UTC boundaries, duplicate/out-of-order events, gaps, partial/current buckets, OHLC and volume calculation, and exact decimal serialization.
- Overlay property tests prove a single shared baseline at `0%`, exact decimal percentage calculation, no independent rebasing or interpolation, deterministic exclusions, and the 500-point ceiling.
- Performance/fault tests cover single-flight behavior, cache expiry versus freshness thresholds, one slow venue or component, 429/5XX/timeouts, aggregate-detail latency/payload/retry waste, maximum overview/depth/trade/chart bounds, and hidden/offline polling pause. Extraction thresholds are reviewed with this evidence.
- Accessibility tests cover keyboard navigation, non-color series identification, a programmatic chart name/summary, raw OHLC table access, status announcements that do not fire every polling tick, and reduced motion.
- Security review confirms strict pair/query allowlists, fixed upstream host selection, response-size limits, same-origin API access, CSP compatibility, and no exchange credential path.

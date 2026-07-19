# ADR-003: Evolve Markets into period-aware candle read models and a Highcharts comparison

- Status: Accepted (amended for Highcharts and historical periods)
- Date: 2026-07-18
- Owners: CTO
- Related PRD/architecture: [Market Lens PRD](../../product/market-lens-prd.md); [Komper Market Lens architecture](../market-lens-architecture.md); [ADR-001: Market-data ingestion and normalization](./ADR-001-market-data-ingestion-and-normalization.md); [ADR-002: Live market data and browser delivery](./ADR-002-live-market-data-and-browser-delivery.md)

## Context

The Markets extension needs an overview at `/markets` and a pair detail at `/markets/:pair`. The overview compares last traded prices across Indodax, Reku, and Tokocrypto. Detail compares ticker statistics, order books, transaction activity, and OHLC history, with all venues' price movement visible in one chart.

The venue contracts are asymmetric. Reku documents REST OHLC arrays in a nonstandard `open, close, low, high` order and public market/trade streams. Tokocrypto documents type-specific REST and WebSocket hosts, standard klines, raw or aggregate trades, and a rolling mini-ticker. Indodax documents REST ticker/trades/depth and WebSocket chart ticks, summaries, trades, and order books, but the supplied public collection does not establish a historical OHLC REST endpoint. Update times, ticker windows, side semantics, event aggregation, and sequence guarantees also differ.

A client that calls exchanges directly would duplicate normalization, expose upstream topology, make bounds difficult to enforce, and turn partial venue failure into inconsistent UI behavior. A single monolithic detail response would couple panels with different refresh rates and make an OHLC failure erase healthy order-book or ticker data. Drawing three candlestick series in the same plot would occlude values; independently rebasing venue lines at different timestamps would create a misleading movement comparison.

The first Markets implementation has no routing dependency and returns only a fixed 24-hour set of hourly candles inside the aggregate detail response. The requested chart adds `1D`, `1W`, `1Y`, and `All` controls. That gives candle history a different payload and refresh cadence from ticker/order-book data and triggers the previously documented capability-extraction threshold. Product has not approved period persistence in the URL, so it does not yet trigger a router migration. The current adapters are not yet symmetric historical stores: Indodax requests only the latest 25 hours, Reku requests the chart feed without a bounded historical window, and Tokocrypto requests 24 hourly klines. Longer labels must therefore describe verified retained coverage, not imply venue-lifetime history.

## Decision drivers

- Make last price, executable order-book price, trade activity, and candle history distinct concepts.
- Preserve provenance, freshness, coverage, and unsupported capability states rather than manufacturing symmetric data.
- Isolate venue and panel failures and bound upstream load.
- Provide one readable line chart with the three venues' absolute closed-candle prices.
- Preserve pair deep links and validated local period state without a second client data cache.
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

### Option C: Period-aware candle projection with a Highcharts line comparison

The BFF provides a batched overview and one bounded pair-detail snapshot for current panels, then extracts candles into a period-aware capability projection. The projection returns canonical absolute OHLC values. The primary Highcharts Core line chart plots raw closed-candle `close` values in IDR for Indodax, Reku, and Tokocrypto. Later missing points remain gaps. A normalized-return mode is deferred product scope and, if later approved, may be derived client-side from this canonical response using one documented shared baseline; it is not required in this response or chart.

The selected period is local client state and part of the TanStack Query key. The BFF request uses the strict `period=1d|1w|1y|all` query, but the browser route remains `/markets/:pair` until Product approves shareable period URLs. The existing bounded path parser remains in place, TanStack Query remains the only network cache, and Highcharts is installed from npm in the browser application. Code splitting is a measured bundle follow-up rather than a current guarantee.

- Benefits:
  - Localizes normalization and upstream safety controls.
  - Preserves a path to panel-specific refresh, cache, retry, and rollback after phase-1 evidence.
  - Makes missing venue coverage and history explicit.
  - Produces a readable absolute-IDR close-price comparison without conflating candles and live tickers.
  - Preserves stable pair deep links and route-level error/not-found behavior.
- Costs/risks:
  - Adds API contracts and more integration tests; later capability extraction may add client request coordination.
  - Requires bounded historical candle storage where a venue cannot backfill.
  - Longer periods require explicit aggregation, retention, and gap contracts.
  - Introduces a licensed visualization dependency and increases the browser bundle unless a later code-splitting threshold is met.

## Decision

Choose Option C and execute the previously approved extraction trigger. Keep the aggregate detail snapshot for current ticker/book/activity panels, but load historical candles independently. Keep the current route parser and store selected period in component state plus TanStack Query until Product approves URL persistence. Use Highcharts Core with the official `@highcharts/react` integration for the comparison. Production enablement is conditional on confirming a Highcharts license appropriate to the deployment; npm installation does not itself grant commercial production rights.

### Routes and identity

- Keep the centralized bounded parser for `/`, `/markets`, and `/markets/:pair`. Period buttons update local state; pair navigation resets to `1d`, while background detail refresh preserves period and venue visibility. The candle API accepts only `period=1d|1w|1y|all`; an omitted period defaults to `1d`, while any present invalid, repeated, array-shaped, or unsupported query is rejected as `400 INVALID_REQUEST`.
- TanStack Query remains the network cache. Its chart query key is `['market-chart', canonicalPair, period]`. If Product later approves shareable period URLs, make `period` validated URL search state and adopt TanStack Router under the existing trigger; the router must not create a second network cache.
- Use `/markets` for the overview and canonical lower-case `/markets/:pair`, such as `/markets/btc-idr`, for detail. Only direct IDR quote pairs are accepted in this release.
- Parse the path case-insensitively and replace non-canonical casing with lower-case. Reject malformed pair shapes before lookup. A syntactically valid pair missing from the canonical registry is a market-not-found state.
- The Markets overview is the union of verified active direct-IDR instruments and displays missing venue cells. Existing effective-price comparison remains the three-venue intersection. Comparative claims require at least two healthy venues.

### Read-model APIs

Provide versioned, bounded resources progressively:

- `GET /api/markets?quote=IDR&limit=100&cursor=...` for the paginated overview. It uses at most one batched ticker operation per venue per refresh, not one upstream call per pair.
- `GET /api/markets/:pair` is the phase-1 snapshot for identity and per-venue ticker, bounded order book, bounded recent trades, fixed `1d` OHLC compatibility data, component availability, and health. Component adapter calls settle independently, so one unavailable component is represented instead of failing healthy data.
- `GET /api/markets/:pair/order-books?depth=20` is the approved follow-up for at most 100 canonical levels per side and comparable spread/liquidity summaries.
- `GET /api/markets/:pair/trades?window=15m&limit=50` is the approved follow-up for at most 100 recent normalized trades/aggregates and same-window activity summaries.
- `GET /api/markets/:pair/candles?period=1d|1w|1y|all` is the period-aware projection for canonical absolute OHLC and raw close lines. Clients cannot select arbitrary intervals, `from`, or `to`; the server selects the approved resolution. Each venue is capped at 1,000 closed buckets, so the three-series response contains at most 3,000 points.

The version-1 period policy is:

| Period | Server resolution | Normal maximum | Meaning |
| --- | --- | --- | --- |
| `1d` | `1h` UTC | 24 | Latest 24 hours ending at the most recent closed hourly bucket |
| `1w` | `4h` UTC | 42 | Latest seven days, aggregated to aligned four-hour buckets |
| `1y` | `1d` UTC | 365 | Latest trailing 365 times 24 hours, aggregated to UTC days |
| `all` | `1w` UTC, Monday 00:00 | 1,000 | All **approved retained coverage** from the earliest accepted venue bucket, not exchange inception |

The response contains `period`, chosen `interval`, `generatedAt`, requested/available bounds, and one stable entry for each configured venue. Each venue entry contains component status/reason, actual coverage start/end, missing-bucket count, retention limitation when known, and canonical closed candles. Each point contains UTC open/close time and absolute OHLC strings; no normalized value is required. A period may return `200` with partial or unsupported venue entries; it must not duplicate the 24-hour sample to simulate a longer period. `All` begins at the earliest accepted retained bucket available from any supported venue, shows later listings as leading gaps, and is labeled with its actual earliest available date.

Every successful projection contains `schemaVersion`, `generatedAt`, canonical instrument identity, and per-venue status, reason, source time when available, receive time, age, market segment, and venue symbol. A projection returns `200` with explicit unavailable venue entries when it can build the response. The stable error envelope distinguishes malformed input, unknown markets, a period that cannot be projected, product rate limiting, and inability to build the projection.

Live detail payloads use HTTP `no-store`. The initial extracted candle projection uses `Cache-Control: private, max-age=60`; TanStack Query deduplicates in-flight browser requests by canonical pair and period and retains the prior successful chart while a new period loads. Period changes abort or ignore obsolete requests. BFF single-flight keyed by pair/period/interval/history version, immutable-bucket caching, and `ETag`/`If-None-Match` are approved rollout follow-ups after history retention/versioning exists; they are not current guarantees. Period-specific server/client freshness may be tuned only after measurement.

### Canonical semantics

- Ticker last price is the latest reported trade/close, not an executable quote. Normalize optional open/high/low, best bid/ask, base/quote volume, and rolling-window provenance without filling absent fields.
- Order books retain canonical decimal levels and health rules from ADR-001. Comparable liquidity is summarized within fixed basis-point bands around a validated midpoint; a fixed number of displayed rows is not treated as equal economic depth.
- Trades retain raw versus aggregate granularity. Normalize trade time, price, base quantity, derived quote notional, and taker/aggressor side only when semantics are verified. For Tokocrypto, `isBuyerMaker=true` maps to a sell aggressor only after segment fixtures validate the documented behavior. Unknown semantics remain `UNKNOWN`.
- Candles use half-open UTC buckets, canonical `open/high/low/close`, optional base/quote volume and trade count, `isClosed`, coverage status, and provenance. Reku's array ordering and venue time units are adapter concerns. Indodax ticks/trades may be aggregated into candles; unavailable time before collection began is not backfilled or forward-filled.
- `close` is the close of a completed candle, not the live ticker's `lastPrice`. The chart and tooltip identify it as “harga penutupan” and show its bucket close time; the current ticker remains a separate, fresher component.

### Comparative chart and Highcharts integration

- Use Highcharts Core `line` series, not Highcharts Stock and not three overlaid candlesticks. The default y-axis is raw closed-candle price in IDR. All configured venues retain stable names/colors/markers; unavailable venues remain explicit in status text rather than disappearing silently.
- Use a UTC datetime x-axis, `connectNulls: false`, and nullable points for missing aligned buckets. Tooltips show timestamp, venue, and absolute O/H/L/C. Highcharts receives finite display numbers only after response/schema validation, while canonical contract values remain decimal strings.
- Plot each accepted point exactly from that venue candle's `close`; do not substitute ticker last price, open/high/low, an average, normalized return, or a cross-venue value. Never interpolate, forward-fill, or bridge a gap.
- Render every venue with valid observations. Comparative language requires at least two venues with an overlapping valid timestamp; a single valid series is observational only, and zero valid series produces the application no-data state. A partial chart must not be titled as a complete three-exchange comparison.
- Install pinned compatible `highcharts` and official `@highcharts/react` packages from npm; do not load runtime scripts from a CDN. Load the Accessibility module in browser code and keep application-owned partial/empty states; a Highcharts no-data module is optional, not a current dependency. The application is currently Vite client-rendered, so no chart module is imported by server code. If SSR is added, the chart must use a client-only boundary/dynamic import and stable placeholder to avoid `window` access and hydration divergence. Validate the documented Vite dependency-prebundle exclusion if module initialization order fails in development.
- Keep the 1,000-point-per-venue contract (at most 3,000 points). Do not enable Boost initially: this remains below Highcharts' default per-series Boost threshold and standard SVG behavior better preserves interaction and accessibility. Reconsider Boost only after measured render latency and accessibility regression tests justify it.
- The Highcharts Accessibility module is mandatory: provide a meaningful title/caption, keyboard navigation, series descriptions, explicit point value/time suffixes, and non-color identification. Keep the existing semantic OHLC table as the complete alternative representation. Announce only user-initiated period completion or failure, not every refresh, respect reduced motion, and use an Indonesian contextual empty-state message.

## Consequences

Positive consequences:

- A failed component is explicit inside the phase-1 snapshot, and the contract can be extracted without changing canonical semantics.
- Venue differences and data age remain visible instead of being hidden by a lowest-common-denominator client model.
- Overview load is bounded and observable, and canonical paths are stable shareable URLs.
- Movement comparison is visually readable and mathematically reproducible while raw OHLC remains available.
- History traffic is isolated from fast detail polling, and period state survives unrelated background refresh.

Negative consequences:

- The BFF gains historical storage/aggregation work; later endpoint extraction adds panel-specific operations.
- Period selection is not shareable or restored by browser back/forward until Product approves URL persistence and the router trigger executes.
- A slow component can delay the entire aggregated snapshot, all components share one refresh/retry cadence, and static candles may be retransferred with fast data until capability endpoints are extracted.
- Indodax chart periods remain limited until sufficient verified ticks/trades have been retained.
- Ticker and transaction metrics may still be non-comparable when window or granularity provenance differs; the product must label or suppress those comparisons.
- Highcharts adds bundle and licensing obligations; commercial/public deployment remains gated on a recorded license decision.

## Migration and rollback

1. Extend capability contracts and fixtures for ticker, trades, and candles without exposing routes.
2. Run batched ticker and candle/trade normalization in shadow mode. Measure schema acceptance, source time, coverage, rate limits, and overview payload size.
3. Add the bounded path parser and overview behind a `marketsOverview` feature flag. Existing root comparison remains independently usable.
4. Enable the aggregated pair-detail snapshot with bounded, independently settled components and fixed chart controls.
5. Extract `/candles`, add the four allowlisted periods, begin bounded OHLC collection, and backfill solely from verified native endpoints. Return explicit partial/unsupported coverage until a period is proven.
6. Add local period controls and TanStack Query keys without changing the route parser. Record URL persistence as a Product decision; migrate to TanStack Router only if that follow-up is approved.
7. Replace the SVG chart with the Highcharts line chart after visual, accessibility, performance, and license gates pass. A feature flag and `ETag`/single-flight optimization are optional rollout follow-ups, not prerequisites claimed by this implementation; rollback deploys the prior known-good build.
8. Enable each period independently after boundary, weekly-alignment, gap, coverage, adapter-rate, and cache tests pass.

Rollback can disable the overview, individual detail capabilities, a venue segment, or a period independently. Disabling candles does not remove the pair detail route. Stored canonical candles remain versioned and can expire under retention policy; rollback never relabels partial history as complete.

## Validation

- Route tests preserve the existing pair deep-link, focus, and scroll behavior. Component tests cover the `1d` default and local period changes; strict invalid-period rejection is an API test until URL persistence is approved.
- API contract tests cover pagination, deterministic ordering, all bounds, stable errors, per-venue partial failure, age/status propagation, and absence of upstream N+1 calls.
- Venue fixtures cover ticker windows, trade/aggregate granularity and side semantics, Reku candle field order, Tokocrypto segment routing, Indodax tick aggregation, and seconds-versus-milliseconds validation.
- Candle property tests cover UTC boundaries, duplicate/out-of-order events, gaps, partial/current buckets, OHLC and volume calculation, and exact decimal serialization.
- Chart property tests prove exact UTC aggregation for every period, Monday 00:00 UTC weekly alignment, point equality to canonical `close`, no substitution/interpolation, deterministic gaps, actual `all` coverage labeling, and the 1,000-point-per-venue ceiling.
- Current performance/fault tests cover TanStack Query keys, aborted/ignored period races, one slow venue, 429/5XX/timeouts, the 3,000-point chart maximum, chunk size/render latency, and hidden/offline polling pause. The later cache rollout adds ETag/304 and BFF single-flight tests before enabling those optimizations. Boost remains disabled unless measurements overturn the decision.
- Accessibility tests cover the Highcharts module loading, keyboard traversal, non-color series identification, a programmatic chart name/summary, Indonesian no-data/partial states, equivalent raw OHLC table access, deliberate period announcements, and reduced motion.
- Dependency/license review records exact Highcharts versions, bundle analysis, vulnerability scan, CSP behavior, and an appropriate deployment license before the Highcharts build can be deployed to production.
- Security review confirms strict pair/query allowlists, fixed upstream host selection, response-size limits, same-origin API access, CSP compatibility, and no exchange credential path.

## Implementation references

- [Official Highcharts React getting-started guide](https://www.highcharts.com/docs/react/getting-started)
- [Highcharts Accessibility module](https://www.highcharts.com/docs/accessibility/accessibility-module)
- [Highcharts Boost module and caveats](https://www.highcharts.com/docs/advanced-chart-features/boost-module)
- [Highcharts download and production-license guidance](https://www.highcharts.com/blog/download/)

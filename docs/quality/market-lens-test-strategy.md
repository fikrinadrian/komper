# Test strategy: Komper Market Lens

## Status and ownership

- Status: Active for internal evaluation
- QA owner: `senior_qa_engineer`
- Product owner: `product_manager`
- Technical owner: `cto`
- Last updated: 2026-07-18
- Related documents: [Market Lens PRD](../product/market-lens-prd.md), [architecture](../architecture/market-lens-architecture.md), [ADR-001](../architecture/adr/ADR-001-market-data-ingestion-and-normalization.md), [ADR-002](../architecture/adr/ADR-002-live-market-data-and-browser-delivery.md), and [ADR-003](../architecture/adr/ADR-003-markets-read-models-and-comparative-chart.md)

## Quality objectives

Testing protects the decision a user makes from a comparison. A venue must never win because of wrong side selection, binary floating-point conversion, stale or invalid data, unsupported market state, insufficient depth, or an unverified fee. The UI must explain why a result is or is not eligible, preserve exact financial values through display, work without exchange credentials, and remain usable by keyboard at narrow/reflowed layouts.

The strategy distinguishes deterministic correctness evidence from point-in-time upstream contract evidence. Live public API checks do not prove reliability, data rights, freshness, or a service-level objective.

## Scope

### In scope

- React web application, Express BFF, canonical catalog, three public venue adapters, order-book walking, comparison/ranking, fee fail-closed behavior, analytics minimization, and public exchange links.
- Indodax, Reku, and Tokocrypto direct spot IDR metadata and order-book contracts.
- Buy and sell calculations, three-of-three and partial coverage, minimum-order and precision rules, stale/unavailable/schema/empty/crossed/insufficient-depth behavior, and recovery.
- Responsive/reflow behavior, keyboard operation, labels, live status, visible focus, reduced motion, and non-color status cues.
- Timeout, response-size, allowlist, HTTP error/rate-limit handling, absence of credentials/private routes, and legal release gating.
- Server-side public WebSocket ingestion, venue-specific synchronization, reconnect epochs, heartbeat/silence health, bounded delivery to the browser, and long-running resource behavior.
- Market discovery at `/markets` and pair detail at `/markets/{pair}`, including direct navigation, browser history, same-pair last-price comparison, price/depth/trade panels, and one Highcharts line chart that overlays OHLC-close history for the three venues.
- Chart timeframe selection for `1D`, `1W`, `1Y`, and `All`, including allowlisted API query validation, server-declared interval/bounds, loading and race behavior, bounded all-time responses, and state preservation during refresh.
- Aggregate detail loading/retry plus independent empty, partial, stale, schema-error, and recovery status for ticker, order book, recent trades, and OHLC components inside the snapshot.

### Out of scope

- Private APIs, balances, order execution, tax, portfolio, custody, transfer, authenticated fee tiers, and production load testing.
- Long-duration reliability claims until the required 72-hour shadow run and 30-day observation exist.
- Public commercial release until product/legal records approval for all intended venue-data uses.

## Applications and environments

| Application/service | Environment | Browser/device or protocol | Test data approach |
| --- | --- | --- | --- |
| Web app | Local production build, fixture BFF | Playwright Chromium desktop, Pixel 5, 320 px reflow, reduced motion | Deterministic 18-asset fixture; request interception for recovery |
| BFF/API | Local production build and in-process integration | HTTP through Playwright `APIRequestContext`; Supertest | Deterministic adapters plus malformed/failing adapter probes |
| Domain services | Vitest/inline TypeScript probes | Node.js | Exact decimal strings and controlled books/catalog failures |
| Public adapters | Live production public endpoints | HTTPS, read-only | Point-in-time catalog and BTC book checks; no credentials or mutations |
| WebSocket ingest workers | Local deterministic protocol harness, then shadow environment | Indodax/Centrifuge-style protocol, Reku/Phoenix Channels, Tokocrypto raw/combined streams | Virtual-clock protocol fixtures, captured sanitized frames, deterministic replay, and fault injection |
| Browser live delivery | Local production build with deterministic BFF stream | Playwright desktop/mobile, reduced motion | Controlled canonical events; no direct browser connection to exchange hosts |
| Markets web routes | Local production build, fixture BFF | Playwright Chromium desktop, Pixel 5, 320 px reflow, 200% zoom, reduced motion | Deterministic multi-venue market, OHLC, order-book, and trade scenarios for `1D`, `1W`, `1Y`, and `All`, with route interception |
| Markets read APIs | In-process integration and built BFF | Supertest and Playwright `APIRequestContext` | Frozen clock; exact decimal strings; all timeframe values; healthy, partial, stale, gapped, malformed, unsupported, oversized, and recovery fixtures |

## Risk assessment

| Risk or critical journey | Impact | Likelihood | Test layer and coverage |
| --- | --- | --- | --- |
| Wrong buy/sell book walk or partial-fill math | Critical | Medium | Decimal unit references, API buy/sell, browser outcomes |
| Precision lost in ranking or presentation | Critical | High | Beyond-safe-integer and sub-satoshi probes; step/increment properties |
| Stale, failed, or suspended venue remains eligible | Critical | Medium | Health service tests, catalog refresh-failure replay, adapter status fixtures |
| Unknown/expired fee influences net winner | High | Medium | Fee lookup variants and response/UI assertions |
| Schema drift produces plausible ranking | Critical | Medium | Adapter contract schemas, malformed numeric/crossed/empty/type-shift fixtures |
| Live contract differs from collected docs | High | High | Conservative read-only live smoke; retain raw identity and fail closed |
| Rate limit, timeout, or retry storm | High | Medium | Mock 429/`Retry-After`, abort/timeout, call-count and circuit-state tests |
| Credentials/private capability enters MVP | Critical | Low | Route/source inventory, network observation, allowlist tests |
| Inaccessible state or mobile data loss | High | Medium | Playwright keyboard, 320 px overflow, 200% reflow equivalent, reduced motion |
| Commercial use without venue permission | Critical | High until resolved | Documentary release gate owned by product/legal |
| Snapshot/delta semantics are confused across venues | Critical | High | Capability-specific state builders and protocol replay; never infer delta semantics |
| Gap, reorder, duplicate, or old-epoch event corrupts a plausible book | Critical | High | Sequence/offset/epoch invariant tests and immediate fail-closed invalidation |
| Connected socket or heartbeat masks silent/stale market data | Critical | Medium | Independent data-silence and freshness clocks; periodic REST verification where source time/sequence is absent |
| Reconnect storm, subscription excess, or slow consumer exhausts resources | High | Medium | Bounded queues, jittered backoff, per-host budgets, leak/backpressure stress tests, and operational metrics |
| Last prices compare different canonical pairs, quote currencies, or market segments | Critical | Medium | Identity/normalization unit tests, API contract assertions, and three-venue browser labels |
| Stale or partial ticker is styled as a current best price | Critical | High | Frozen-clock freshness tests, capability-level health, accessible status text, and recovery E2E |
| OHLC overlay compares misaligned intervals/time zones or silently joins gaps | Critical | High | Bucket/alignment properties, UTC boundary fixtures, gap-preserving API checks, and overlay E2E |
| Chart is visually present but inaccessible or unusable on mobile | High | High | Keyboard-operable series controls, accessible data alternative, 320 px/200% reflow, contrast, and reduced-motion checks |
| Fast pair/timeframe navigation leaks data from the previous request | High | Medium | Query-key/cache unit checks and delayed-response Playwright race tests |
| A timeframe label returns the wrong window, interval, or boundary inclusivity | Critical | Medium | Frozen-clock window fixtures for `1D`, `1W`, `1Y`, and `All`; response metadata and first/last bucket assertions |
| Invalid, duplicated, or oversized timeframe input reaches venue fan-out | High | Medium | Query-schema unit tests, adapter call-count assertions, and black-box `400 INVALID_REQUEST` coverage |
| All-time history produces an unbounded response or freezes the browser | High | Medium | Server limit/downsampling invariants, payload-size checks, Highcharts point-count assertions, and long-history responsiveness smoke |
| Highcharts defaults expose only pointer hover or animate excessively | High | Medium | Keyboard controls, non-pointer data table, focus/announcement checks, reduced-motion assertions, and no library-internal locators |

## Coverage matrix

| Requirement/journey | Unit/component | Integration/API | Contract/schema | Playwright E2E | Exploratory/a11y | Exit expectation |
| --- | --- | --- | --- | --- | --- | --- |
| AC-01 named scope | Copy review | Catalog requires 3 venues | — | Coverage disclosure | Non-overclaim review | Pass |
| AC-02 eligible catalog | Active/direct/intersection fixtures | Refresh/failure behavior | Live metadata schemas/status flags | Selector contents | Unsupported/maintenance review | Pass, including failed refresh |
| AC-03 buy calculation | Multi-level golden and step rounding | Buy response | Numeric types/bounds | Gross outcome/units | Large/tiny values | Exact and executable precision |
| AC-04 sell calculation | Multi-level golden, min notional, step rounding | Sell response | Market rules | Gross proceeds/units | Large/tiny values | Exact and executable precision |
| AC-05 insufficient depth | Buy and sell partial walk | Cannot win | Empty/short books | Filled/unfilled visible | Plain-language state | Pass |
| AC-06 fee transparency | Verified, unknown, expired, invalid rate | Ranking basis | Version/source/as-of schema | Gross/net distinction | Wording review | Unknown/expired never net-rank |
| AC-07 freshness/gap | Stale clock, sequence/gap state | No stale winner | Source/receive time | Stale state | Announcement review | Pass before public beta |
| AC-08 2/3 availability | One source fails | Winner says 2/3 | Failure classification | Partial card state | — | Pass |
| AC-09 fewer than 2 | Two failures | No winner/alert | — | No best claim | — | Pass |
| AC-10 schema safety | Missing/type-shift/NaN/crossed/unknown version | Non-sensitive error | All adapters | Rejected state | Operator diagnosis | Fail closed and classify correctly |
| AC-11 precision | Safe-integer, fractional, tick/step properties | Exact decimal strings | Parse all JSON numbers as strings | Exact formatting | Zoom/reflow | No `Number` financial conversion |
| AC-12 disclosure | — | Exclusions contract | — | Disclosure before links | Copy/order review | Pass |
| AC-13 public-only | Source/route inventory | Private routes 404 | Host allowlists | Network capture | Threat review | Pass |
| AC-14 accessibility | Component semantics where useful | — | — | Keyboard/mobile/reflow/reduced motion | Screen-reader/contrast follow-up | No critical violation |
| AC-15 recovery | Adapter state transition | Failure then success | Fresh resync | Input retained and recovery announced | — | Pass |
| AC-16 legal gate | — | — | Permission evidence register | Internal label | Product/legal sign-off | Blocks monetization until approved |
| AC-17 Markets union coverage | Catalog union, canonical dedupe, stable venue order | One/two/three-venue support fixtures | Pair/segment/support schema | Direct `/markets` load and refresh | Coverage wording review | Union is exact; unsupported cells remain visible |
| AC-18 last-price semantics | Exact decimal display model and provenance | Three-venue ticker normalization | Numeric/time/health fields | Venue, unit, age, last-trade label | Non-winner/non-executable wording | No lowest-price winner claim |
| AC-19 list partial/stale | 90-second phase-1 frozen-clock boundary and future skew | Fresh/stale/unavailable/unsupported in one row | Distinct bounded reason codes | Healthy value retained; stale age/status text | Status not color-only | `90,000 ms` available; `90,001 ms` stale and never current |
| AC-20 canonical routing | Case-insensitive parser and canonical formatter | Canonical identity response | Canonical pair grammar | Uppercase canonicalization, refresh/history | URL and focus review | One lowercase canonical URL per pair |
| AC-21 invalid/unsupported route | Grammar and catalog-membership split | Reject before venue fan-out | Not-found vs unsupported error schema | Malformed, non-IDR, unsupported states | Assistive distinction and recovery path | No alias/synthetic substitution or 500 |
| AC-22 comparative pricing | Spread IDR/bps decimal references; eligibility | Pricing capability isolation | Exact decimal/provenance/optional metric schema | Metrics, ages, unavailable 24h, fewer-than-two | Large/tiny values; terminology | Approved metrics exact; no false comparison |
| AC-23 order-book comparison | Sort, side, cumulative base/IDR, crossed/increment validation | Configured-depth and per-venue partial fixtures | Book-level decimal/increment schema | Bids/asks, short/empty/unsupported, mobile | Keyboard/reflow/table semantics | No fabricated level; invalid book quarantined |
| AC-24 public transactions | Dedupe, authoritative side, notional, stable source order | Per-venue trades and partial failure | Trade ID/time/price/quantity/side schema | Rows, `Unknown`, empty/stale/recovery | Time/side not color-only | No inferred side, duplicate, or cross-pair trade |
| AC-25 Highcharts close overlay | Exact OHLC-close mapping; series eligibility and stable venue identity | Identical pair/period/interval per venue | Absolute IDR close and null-gap schema | One line plot, three labelled venue series, legend, shared inspection | Keyboard, contrast, accessible data equivalent | Every plotted value equals that venue candle's `close`; absent buckets stay null |
| AC-26 candle alignment/gaps | UTC-hour/closed-bucket, conflicting duplicate quarantine, OHLC invariants | Misaligned/current/duplicate/invalid candle and missing middle bucket | Ordered unique validated bucket schema | WIB display and visible discontinuity | Gap understandable without color | Rejected/duplicate buckets become gaps; no interpolation or line bridge |
| AC-27 timeframe/state | Period enum, frozen-clock bounds, selection/query state, stale-result suppression | `period=1d|1w|1y|all`, server-declared interval and bounded point count | Period/interval/start/end metadata; deterministic downsampling policy | Four controls, default `1d`, rapid switching, refresh/error/focus/visibility | Announcement, reduced-motion, touch target review | Selected period, visible lines, and focus survive refresh; old responses never replace the active period |
| AC-28 aggregate retry/component recovery | Explicit ticker/book/trades/candles state aggregation | One component/venue fails then fresh aggregate recovery | Component status/reason bounded/non-sensitive | One whole-snapshot retry; healthy prior data retained | Stable live-region announcement | Component states recover without full-page reload |
| AC-29 responsive/accessibility | Component semantics where useful | — | — | Desktop, Pixel 5, 320 px, 200% zoom, keyboard | Screen reader and contrast follow-up | No critical loss, trap, or page overflow |

## Frontend test approach

Playwright runs desktop Chromium and Pixel 5 against the production build with fixture data. Critical browser tests cover 3/3 buy, 2/3 partial availability, insufficient depth, mobile keyboard sell, and the Highcharts comparison across all four periods. Targeted release checks additionally use 320 px reflow, reduced motion, horizontal-overflow detection, external-link focus, request inventory, delayed period responses, and a simulated fail-then-recover response that must retain user input and chart controls.

Before public beta, add persistent automated coverage for stale, all unavailable, no winner, fee verified/expired, schema error, empty book, recovery announcement, 200% browser zoom, and an automated accessibility scanner. Web-first assertions and user-facing roles/names are required; arbitrary sleeps and implementation selectors are prohibited.

## API and contract test approach

- Keep fast Vitest/Supertest coverage for validation, deterministic comparisons, and analytics schemas.
- Use Playwright `APIRequestContext` against the built BFF for black-box status, headers, buy/sell, validation, and absence of private routes.
- For `GET /api/markets/:pair`, cover an omitted `period` default and the exact allowlist `1d|1w|1y|all`. Reject empty, repeated, mixed-case, unknown, encoded-delimiter, overlong, and extra query parameters according to the owned strict schema before any adapter fan-out; assertions include adapter call counts.
- Assert response period metadata, canonical UTC bounds, server-selected interval, ascending unique closed buckets, maximum point count, and payload-size bound for every period. `all` means the earliest retained verified history through the latest closed bucket, not an unlimited upstream request; any compaction/downsampling policy must be deterministic and disclosed in response metadata.
- Mock venue transport at the adapter boundary for 429, 418, 5xx, `Retry-After`, timeout, invalid JSON, oversized body, redirect, and host allowlist cases.
- Store sanitized documented and observed fixtures for each adapter. Contract checks must include missing fields, unexpected fields, numeric strings/numbers, invalid decimal tokens, status flags, and Tokocrypto wrapper variants.
- Schemathesis and Pact are not justified because there is no owned OpenAPI contract or independently deployed consumer/provider pair. k6 is deferred until a load profile and SLO are approved.

## Test data and isolation

Fixture mode is the deterministic release oracle. It contains no user data, credentials, or private endpoints. Live checks use public GET endpoints only and must remain low-rate. Reproduction adapters are created in memory and must not modify product code. No raw order amount is accepted into analytics; emitted analytics use only pair, side, coarse size bucket, venue, and eligible count.

## Quality gates

| Gate | Command/evidence | Required threshold |
| --- | --- | --- |
| Formatting | `pnpm run format:check` | Zero unformatted files |
| Types | `pnpm run typecheck` | Zero errors |
| Lint | `pnpm run lint` | Zero errors/warnings |
| Unit/integration | `pnpm test` | All deterministic tests pass |
| Build | `pnpm run build` | Production client and server build |
| Browser | `pnpm run test:e2e` | All applicable projects pass; skips explained |
| Public contract | Low-rate live catalog plus one buy/sell BTC comparison | Schemas accepted or venue safely quarantined; not an uptime gate |
| Correctness | All AC-02–AC-11 financial/health regression tests | 100% pass; no P0/P1 defects |
| Legal | Venue rights evidence and explicit product/legal decision | Required for public monetization |
| Reliability | 72-hour shadow report; 30-day evidence before reliability claim | Required before beta expansion/claims |
| WebSocket deterministic replay | Protocol/state-builder fixture suites | 100% pass for every enabled venue segment; zero unhealthy book ranked |
| WebSocket browser delivery | Playwright live-update, stale, partial, reconnect, and reduced-motion flows | All supported projects pass; no direct exchange connection or lost user input |
| WebSocket resource safety | Flood, slow-consumer, subscription churn, and reconnect stress evidence | Configured bounds never exceeded; sockets/listeners/timers return to baseline after cleanup |
| Markets route correctness | AC-17–AC-29 deterministic/API/browser suites, including every `period` value and invalid-query fan-out checks | 100% pass; no open P0/P1; every unsupported or unhealthy capability fails closed |
| Markets chart correctness | Highcharts series-point oracle, timeframe boundary matrix, gap/partial fixtures, and delayed-response E2E | Every point equals canonical OHLC `close`; three stable venue identities; no interpolation, cross-period leak, or unbounded `all` payload |
| Markets accessibility | Automated accessibility scan plus keyboard/reflow/timeframe/chart-data-alternative evidence | Zero critical/serious violations; all information available without pointer, color, animation, tooltip hover, or visual chart inspection |

## Defect management and exit criteria

P0 can cause loss, credential exposure, or active harmful execution; P1 can recommend the wrong/ineligible venue or materially misstate a financial value; P2 misleads state/diagnosis or breaks an important secondary path; P3 is minor. Every defect records deterministic repro, observed/expected result, affected AC, and retest evidence. P0/P1 defects cannot receive a QA release exception for public beta.

Internal evaluation may proceed with visible internal labeling, public data only, and no external monetization. Public beta requires all P0/P1 defects closed, every AC observed or explicitly accepted by its owner, legal approval, and the 72-hour shadow evidence. Public reliability claims additionally require the 30-day evidence and an approved SLO.

## Markets discovery and detail QA plan

This section is the test handover for `/markets` and `/markets/{pair}`. It treats recent transaction activity as public venue trades, never as the current user's private order or account history. Pair identity, timestamps, and health are part of every comparison; values from different canonical pairs, quote assets, intervals, or unverified market segments are not comparable even when their display symbols look similar.

### Testable acceptance

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-17 | Verified catalogs where a direct-IDR pair is active on one, two, or three venues | The user directly loads or refreshes `/markets` | The union contains the pair once; Indodax, Reku, and Tokocrypto cells remain in stable order and show current support or explicit `unsupported`. The size-aware intersection catalog is unchanged. |
| AC-18 | Frozen healthy last-trade/ticker fixtures for the same pair | `/markets` renders | Every last price is an exact decimal with explicit IDR unit, venue, source/receive age, and “last traded price” semantics. No lowest-price winner or executable-quote claim is present. |
| AC-19 | One fresh venue, one at 90,000/90,001 ms age, one unavailable venue, and one unsupported cell across fixtures | The market row renders and later receives a fresh observation | `90,000 ms` is available and `90,001 ms` is stale. Healthy data remains; stale, unavailable, and unsupported are distinct textual states; unhealthy values are not current. Recovery requires newly accepted data, not only a connected transport. |
| AC-20 | A catalog pair requested with mixed/upper case and query state | Detail navigation, direct load, reload, and browser history occur | The URL canonicalizes to lowercase `/markets/{base}-idr` without losing valid query state; heading, data, accessible summary, analytics, and URL identify the same pair. |
| AC-21 | Malformed/non-IDR/native-symbol/extra-segment routes and a well-formed pair outside the union | Navigation is evaluated | Malformed inputs show not found; the absent catalog pair shows unsupported with a link to Markets. Both are distinguishable to assistive technology, cause no invalid venue fan-out, substitute no synthetic price, and never become a server error. |
| AC-22 | Exact pricing fixtures with unequal bid, ask, last, spread, and verified/unverified 24-hour metrics | Pair detail pricing renders with three, two, or one healthy venue | Last/bid/ask, spread IDR/bps, age, and venue match decimal references. Unverified window metrics are unavailable, last is not called executable, and fewer than two healthy venues has no comparative conclusion. |
| AC-23 | Books with configured valid depth plus short, empty, crossed, unsorted, increment-invalid, and unsupported variants | The order-book comparison renders | Price, base quantity, cumulative base, and cumulative IDR match exact side/order references per venue. No levels merge across venues or are fabricated; invalid books fail closed and all partial states retain identity, units, and freshness. |
| AC-24 | Public trade fixtures with identical timestamps, duplicate IDs, out-of-order arrival, authoritative/unknown aggressor side, and empty history | Transaction activity renders and updates | Venue, public trade time, price, base quantity, IDR notional, and approved source ordering match fixtures. Side is shown only when authoritative; otherwise both rendered and accessible values say `Unknown`. No event crosses pair/venue identity. |
| AC-25 | Valid OHLC fixtures for Indodax, Reku, and Tokocrypto with unequal absolute close prices plus one missing bucket | The Highcharts comparison renders, a venue toggles, or a timestamp is inspected | One line chart has three stable, labelled venue series on a shared time axis and IDR price axis. Each non-null point exactly equals that venue candle's `close`; no ticker, open, high, low, average, normalization, or cross-venue value substitutes for it. The legend and non-pointer data equivalent expose timestamp, venue, close, unit, health, and explicit gap. |
| AC-26 | UTC-boundary candles, misaligned/current buckets, conflicting duplicates, invalid OHLC, and a missing middle bucket | Server validation and display complete | Accepted buckets are closed, unique, and aligned to canonical UTC; conflicting duplicates are quarantined rather than selected. Display represents the same instant in WIB, while rejected/missing intervals remain discontinuous gaps with no interpolation, forward-fill, or line bridge. |
| AC-27 | Frozen-clock fixtures for `period=1d`, `1w`, `1y`, and `all`, plus delayed out-of-order responses and a bounded retained-history start | The default loads, each timeframe control is activated, the page refreshes, or controls are switched rapidly | Omitted `period` selects `1d`; `1D`, `1W`, `1Y`, and `All` are keyboard-operable and expose the active state. The request uses the exact canonical value, the response period/bounds/interval match the frozen oracle, and the chart contains only that response. Pair, period, venue visibility, prior valid chart, and focus persist while loading/error is announced; a late old-period response cannot replace the active period. `All` starts at the earliest retained verified candle and remains within the approved point/payload bound. |
| AC-28 | An aggregate response where pricing is healthy and one venue component is unavailable | Detail renders, the one retry action is used, and a later aggregate snapshot recovers | Component-and-venue status identifies the failure, healthy prior components remain visible while one whole detail request is pending, and the fresh snapshot restores the component without full-page reload or false panel-only retry wording. |
| AC-29 | Desktop, Pixel 5, 320 CSS px, 200% zoom-equivalent reflow, reduced motion, and keyboard-only use | A user completes Markets discovery and reviews every detail panel/chart value | There is no page overflow, clipped relationship/unit/status, focus trap, or focus loss. Landmarks, headings, table headers, non-color distinctions, and a chart data equivalent preserve meaning without pointer or visual chart inspection. |

AC-25 deliberately defines the plotted value as the absolute IDR `close` from each accepted OHLC bucket: it is the last chart price for that interval, not the current ticker last price and not normalized percentage movement. A venue without a candle at a canonical timestamp has a null gap while the other venues may remain continuous. Interpolation, forward-fill, connecting across nulls, silently substituting ticker prices, or mixing response periods is a P1 defect because it can present a false exchange comparison.

### Deterministic data scenarios

| Scenario | Market overview | Detail capabilities | OHLC oracle | Expected user state |
| --- | --- | --- | --- | --- |
| `markets-all-healthy` | Three fresh last prices for at least two pairs | Three healthy pricing/books/trades | Three complete aligned series | Full comparison and explicit freshness |
| `markets-one-venue-partial` | One ticker unavailable or stale | A different capability fails on one venue | One series has a declared gap | Healthy data remains; every limitation is local and textual |
| `markets-all-unavailable` | No eligible ticker | Every capability unavailable | No valid series | No best/current claim; route shell, explanation, and retry remain |
| `markets-boundaries` | Exact decimal extremes and freshness T-1/T/T+1 | Crossed/empty/invalid increment books; duplicate/out-of-order trades | UTC day boundary, duplicate bucket, invalid high/low, late candle | Invalid capability quarantined without corrupting siblings |
| `markets-race` | Pair A delayed behind pair B | Aggregate refresh and retry responses resolve out of order | Old pair snapshot resolves after new pair | URL, heading, visible and accessible data always agree |
| `markets-periods` | One healthy direct-IDR pair | Pricing/books/trades remain unchanged while `period` changes | Distinct frozen `1d`, `1w`, `1y`, and bounded `all` windows with declared intervals | Active control, request, metadata, chart, and data equivalent always identify the same period |
| `markets-period-race` | One pair and unchanged venue identities | `1y` responds after a later-selected `1d` | Delayed responses have visibly distinct close sentinels | `1d` remains active; no `1y` sentinel leaks into chart or table; focus and hidden-series state persist |

Fixture timestamps are ISO-8601 UTC instants and the test clock is frozen. Display may use WIB, but assertions verify the represented instant rather than locale-formatted punctuation. Financial values remain decimal strings in fixtures and contracts; tests do not use binary `Number` as the calculation oracle.

### Unit, integration, and API coverage

- Unit/property tests cover canonical pair parsing, route encoding, exact decimal ordering and relative differences, capability health aggregation, source/receive freshness boundaries, book sorting and cumulative depth, trade deduplication/stable ordering, and OHLC invariants (`low <= open/close <= high`, unique ascending buckets, declared interval alignment). The chart oracle maps each accepted candle to `[openedAt, close]` without binary-number arithmetic as a financial reference; rendering conversion must round-trip to the approved display precision and never choose another OHLC field or ticker value.
- OHLC alignment tests generate different venue start/end times, daylight-independent UTC boundaries, missing buckets, duplicate buckets, late revisions, and uneven response order. The merge oracle emits an explicit per-venue gap and never forward-fills or joins points from different intervals.
- Integration tests cover `GET /api/markets`, aggregate `GET /api/markets/:pair`, and the extracted `GET /api/markets/:pair/candles?period={value}` projection. They verify supported/unsupported pair validation, canonical pair echo, omitted-period default, all four accepted periods, response interval/bounds/point limit, per-component partial success, bounded upstream timeouts, malformed/oversized payloads, and recovery. An invalid pair or period must be rejected before adapter fan-out; an overview refresh uses at most one batched ticker operation per venue, not one call per row.
- Black-box `APIRequestContext` coverage verifies `400 INVALID_REQUEST`, `404 MARKET_NOT_FOUND`, product `429`, and projection-level `503` behavior; a successfully built aggregate remains `200` when individual venue components are unhealthy. It also checks content type, cache policy, schema version, exact numeric strings, stable sorting, canonical venue order, pair/period validation, period-specific interval/bounds, cache variation by pair and period, and non-sensitive errors.
- Concurrent identical refreshes prove single-flight behavior, while one slow/failing venue is bounded and cannot delay healthy entries beyond the configured aggregate timeout. Paginated/split detail endpoints, arbitrary range/interval queries, and their limit tests are follow-up scope, not phase-1 gates.
- Contract fixtures for every venue include ticker, order book, public recent trades, and OHLC. Missing/type-shift/invalid numeric/time fields, wrong symbols, wrapper variants, partial payloads, rate limits, and schema versions must quarantine only the affected venue capability.
- Schemathesis remains unjustified until an owned OpenAPI schema exists. Pact is unnecessary while the browser and BFF ship together. Add k6 only after product/CTO approve an update cadence, concurrency profile, retention/range limits, and response-time objective.

#### Period query validation matrix

| Request query | Expected result | Fan-out/cache assertion |
| --- | --- | --- |
| Omitted `period` | `200`; canonical response period is `1d` | Same cache identity and adapter parameters as explicit `period=1d` |
| `period=1d`, `1w`, `1y`, or `all` | `200`; exact period is echoed with approved UTC bounds, interval, and point limit | One bounded history request per supported venue; cache varies by canonical pair and period |
| Empty, uppercase/mixed-case, whitespace-padded, unknown, encoded delimiter, or overlong `period` | `400 INVALID_REQUEST` with a bounded non-sensitive reason | Zero adapter calls and no cache entry under a coerced value |
| Repeated `period`, array syntax, or unsupported extra query key | `400 INVALID_REQUEST` under the strict query contract | Zero adapter calls; no first/last-value guessing |

For a frozen latest closed bucket `T`, period-boundary fixtures assert the product-approved inclusive/exclusive rule for `1d`, `1w`, and `1y` rather than only counting points. Calendar/time-zone arithmetic is server-side and UTC-defined. `All` asserts both the earliest retained verified bucket and the maximum response point/payload budget; QA must not approve an implementation whose all-time behavior depends on upstream default limits or grows without a documented bound.

### Playwright route and state coverage

Playwright uses user-facing roles and names plus controlled BFF responses; tests do not locate chart library internals. The minimum persistent suite is:

1. Load `/markets` directly, verify venue-aware last prices and freshness, open a pair, then exercise reload and browser back/forward.
2. Load a supported detail URL directly and prove pricing, order book, public trades, and the single Highcharts line chart all identify the URL pair. Assert three stable venue labels and compare every rendered/accessibly exposed line point with that venue's OHLC `close` fixture.
3. Load malformed and unsupported pairs, including percent-encoded separators and excessive length, and verify safe not-found behavior with no internal error leakage.
4. Return an aggregate response with one failed venue/component, all venues failed for one component, and all components failed. Verify component-level states, one whole-snapshot retry, retained prior healthy content while pending, and automatic recovery.
5. Cross freshness boundaries with a frozen fixture clock; verify stale text and removal of best/current eligibility, followed by recovery on newly accepted data.
6. Switch pair while old aggregate responses are delayed. Verify URL/data consistency, request cancellation or stale-result suppression, retained focus, and matching analytics.
7. Verify `1D` is the default, then select `1W`, `1Y`, and `All` by pointer and keyboard. For each selection, assert active semantics, the outgoing canonical `period` query, response metadata, changed sentinel values/bounds, and the synchronized chart-data alternative; URL query persistence follows the product routing contract.
8. Repeat the critical navigation and partial-state journey in desktop and Pixel 5 projects, plus targeted 320 px, 200% zoom, reduced-motion, horizontal-overflow, focus-visible, and automated accessibility checks.
9. Observe controlled polling while the tab becomes hidden, visible, offline, and online; prove polling pauses when hidden/offline, resumes without a request burst, and does not reset focus, series visibility, filters, or healthy panels.
10. Delay a `1Y` response, switch to `1D`, and resolve `1D` first. When `1Y` later resolves, prove the active control, Highcharts series, accessible table, and response announcement still show only `1D`; repeat while hiding one venue series.
11. Supply three healthy lines, one venue with a middle null, one venue entirely unsupported, and all venues without candles. Verify healthy lines remain, the middle interval is not connected, every partial state is textual, and empty history has explanation/retry without a fabricated line.

The accessible chart alternative may be a concise synchronized value table or an on-demand data table. It must expose active period, venue, timestamp, close, IDR unit, and gap/status without requiring pointer hover; retaining open/high/low is useful but is not a substitute for an explicit close column. Timeframe and venue controls use native buttons or equivalent semantics, have visible focus, expose selected/pressed state, retain at least one visible series, and meet the approved target size. Highcharts SVG paths, generated class names, and tooltip DOM are not stable test selectors. Rapid market updates are coalesced so the DOM/live region does not churn faster than the approved presentation cadence, and reduced-motion mode disables non-essential chart animation.

### Markets feature exit evidence

Before handoff, the quality report must name the build and fixture mode, routes and API contracts tested, Playwright projects/viewports, commands and exact results, AC-17 through AC-29 status, open defects, missing live-contract evidence, and residual upstream/data-rights risk. Release requires all deterministic market fixtures and affected existing ACs green, no open P0/P1, no critical/serious automated accessibility issue, and observed partial/stale/recovery behavior. A green live endpoint smoke is supplementary contract evidence, not proof of freshness or reliability.

## WebSocket implementation QA plan

This section is the engineer-facing acceptance and test handover for the planned WebSocket implementation. The existing application is REST-snapshot based; these requirements must be implemented and tested without weakening its current decimal, increment, schema, fee, and health gates.

### Venue protocol contracts and uncertainty boundaries

| Venue/capability | Documented contract | Required state-builder policy | Contract risks to prove before enablement |
| --- | --- | --- | --- |
| Indodax `market:order-book-<pair>` | Production `wss://ws3.indodax.com/ws/`; static public-token handshake; method `1` subscribe, method `2` unsubscribe, method `7` ping; order-book payload contains complete ask/bid arrays and publication `offset`; subscription response exposes `recoverable`, `epoch`, and `offset` | Treat each validated order-book message as an atomic full snapshot, never as a delta. Track connection epoch and last offset. Duplicate/older offsets cannot advance state. Invalidate on unexplained offset regression/gap until documented recovery or a fresh snapshot proves state. | Recovery-by-offset is documented generically and exemplified on another channel, not proven for order book. Prove order-book recovery publications and epoch behavior in shadow mode; otherwise reconnect means invalidate and re-bootstrap. Static token expiry/rotation and the conflicting troubleshooting URL must be configuration/contract tested. |
| Reku `order:{coinId}` | `wss://ws.reku.id/socket`; Phoenix Channels join/leave, heartbeat and refs; public channel; every 50–200 ms typical update is documented as a complete book snapshot, not a delta; no event sequence or source timestamp is documented | Atomically replace the book per valid message. Never merge payloads. New socket/channel join creates a new epoch and invalidates the old book until a fresh valid snapshot arrives. Use receive-time health with `freshnessIndependentlyVerified:false` and periodic REST verification. | Loss between full snapshots is not detectable and source freshness cannot be independently proven. Validate actual join/data/error payloads and the documented REST query mismatch (`symbol` vs example `pair`) before relying on recovery. |
| Tokocrypto type 1 diff depth | Type-1 route/symbol transform; raw or combined stream; `<symbol>@depth` or `@100ms`; event time `E`, symbol `s`, first/final update IDs `U/u`, absolute quantities in `b/a`; REST snapshot has `lastUpdateId`; connection lifetime 24 hours; server ping every 3 minutes and expects pong within 10 minutes | Buffer deltas before REST snapshot. Discard `u <= lastUpdateId`; first accepted event must span `lastUpdateId + 1`; thereafter require `U == previous.u + 1`. Apply absolute quantities and remove zero levels. Any gap, overflow, invalid event, or epoch change invalidates the book and restarts bootstrap. | Prove raw and combined wrappers, supported depth limit, endpoint host, symbol transform, scheduled connection renewal, ping/pong, and REST/WS race. Never publish buffered or partially synchronized state. |
| Tokocrypto type 3 | Separate REST/WS hosts and market segment; supplied collection does not establish that type-1 sequence/bootstrap semantics apply identically | Keep type 3 disabled or `UNVERIFIED/UNSYNCED` until captured frames and REST correlation establish its exact snapshot/delta, sequence, symbol, heartbeat, and reconnect contract. Use an independent capability flag and state builder. | Reusing the type-1 builder without evidence is a release blocker. A type-3 failure must not affect type 1 or another venue. |

Primary local sources are `Indodax Marketdata-websocket.md`, Reku `websocket/overview.md` and `orderbook-stream.md`, and Tokocrypto `Marketdata-websocket.md`. Documentation examples are fixtures to validate, not proof of current production behavior.

### Risk-based WebSocket coverage matrix

| ID | Risk/behavior | Deterministic unit/replay | Integration/protocol harness | API/browser/operations | Release condition |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Protocol handshake and subscription contract | Encode/decode valid, missing, wrong-type, unknown-event, error, raw, and wrapped frames | Ack/ref correlation; join/subscribe failure; unsubscribe; auth/static-token rejection; wrong channel/symbol/host | Per-venue connection/subscription state visible without secrets | Every enabled segment contract-tested; unsupported variant quarantined |
| WS-02 | Snapshot vs delta semantics | Full snapshots replace atomically; deltas never enter a full-snapshot builder | Feed a plausible partial payload to Indodax/Reku and prove rejection; feed Tokocrypto delta to sequence builder only | Comparison cannot observe half-applied or mixed-protocol state | Zero cross-capability coercion |
| WS-03 | Tokocrypto snapshot-plus-delta bootstrap | Virtual-clock replay of buffer → snapshot → stale discard → first overlap → contiguous updates | Snapshot behind earliest buffered event retries within a configured bound; timeout/overflow fails closed | No estimate/winner until synchronization completes | All bootstrap interleavings deterministic and green |
| WS-04 | Duplicate, overlap, gap, and reorder | Duplicate/stale `u` is idempotently discarded; overlapping first event applies once; `U > previous.u + 1` and future-before-prior reorder invalidate immediately | Inject duplicate frames, missing event, reverse pair, replay after recovery, and zero-quantity delete including unknown level | Gap reason and resync count observable; unhealthy book cannot rank/alert | 100% injected gaps detected; zero corrupted book published |
| WS-05 | Indodax offset/recovery behavior | Same-epoch duplicate/older offset cannot advance; full snapshot replacement preserves ordering/increments | Recoverable same-epoch publications applied only after contract proof; epoch mismatch, non-recoverable response, gap, or offset regression invalidates | Venue shows recovering/unverified until fresh state; other venues remain usable | Order-book recovery enabled only with live evidence; safe fallback tested |
| WS-06 | Reku full-snapshot replacement | Consecutive books replace rather than merge; missing level disappears; duplicates remain idempotent | Phoenix join/data/leave/error/heartbeat frames; dropped intermediate full snapshot followed by valid replacement | REST verification mismatch quarantines Reku; no fabricated source timestamp | Receive-time limitation disclosed and fail-closed verification works |
| WS-07 | Connection epoch and reconnect | Old-epoch event after reconnect is rejected; state from epochs is never joined | Close before/after join, DNS/TLS/error close, reconnect during snapshot, repeated flap, scheduled Tokocrypto renewal | User input persists; recovery state is announced without full reload | Old state invalid immediately; one healthy state published after resync |
| WS-08 | Heartbeat, silence, and staleness | Separate connection-heartbeat, last-message, source-event, receive, and processing clocks using fake timers | Missed Indodax method-7 response, Phoenix heartbeat ack, Tokocrypto ping/pong; open-but-silent socket; clock regression/skew | Stale/silent venue removed from winner/alert at the next evaluation, without showing old value as current | Connected is never synonymous with `LIVE`; thresholds configured and evidenced |
| WS-09 | Schema, decimal, book, and increment safety | Missing/type-shift/NaN/negative/crossed/unsorted/misaligned/unknown schema all reject before canonical state | Malformed and oversized frames, binary/unexpected data, decompression/parser failure if applicable | Bounded non-sensitive reason/metric; healthy venue isolation | Existing AC-10/AC-11 gates pass for every stream variant |
| WS-10 | Partial and total venue availability | One/two/all workers fail independently; last-known book invalidates rather than silently persists | Kill one worker/segment, recover it, then kill all; catalog change during subscription | 2-of-3 label, fewer-than-2 no winner, automatic recovery, no input loss | AC-07–AC-09 and AC-15 pass with streamed state |
| WS-11 | Subscription/rate limits and reconnect storm | Token-bucket/backoff/jitter with deterministic clock; command batching; capped attempts | Reku stays below 10 connections/IP, 50 channels/connection, 100 messages/s. Indodax/Tokocrypto use conservative configurable caps where numeric limits are absent. Test rejection/temporary disconnect. | Metrics expose attempts, subscriptions, disconnect reason, and backoff; no retry storm | No hard-coded undocumented ceiling presented as fact; configured budgets observed |
| WS-12 | Browser live delivery | Canonical update coalescer preserves latest health/provenance and never coalesces away a delta needed by a sequence builder | Chosen BFF delivery transport reconnects/resumes or refetches canonical state without exposing exchange URLs/tokens | Playwright proves healthy update, re-rank, stale removal, 2/3, no winner, recovery, mobile/reduced-motion and `aria-live` announcement | UI cadence is bounded independently of ingest; no direct exchange socket from browser |
| WS-13 | Backpressure and slow consumers | Queue/buffer high-water limits; full snapshots may coalesce to latest valid same-epoch snapshot; sequenced-delta overflow invalidates/resyncs instead of dropping silently | Replay faster than processing, block downstream, burst at 100 ms, and delay REST bootstrap | Queue depth, drops/coalesces, event-loop lag and resync reason observable | Configured bounds never exceeded; no stale/corrupt ranking under load |
| WS-14 | Memory, listener, timer, and socket leaks | Repeated create/start/stop leaves no retained epochs/books beyond configured retention | Subscription churn, 24-hour-renewal simulation, 100+ reconnect cycles, catalog add/remove cycles | Process/socket/listener/timer counts return to baseline after cleanup; heap trend reported after controlled GC where available | No monotonic resource growth; one active subscription per intended capability |
| WS-15 | Shutdown/deploy behavior | Stop is idempotent; new events rejected after stop; current state invalidated | Graceful shutdown during join/bootstrap/message application; restart with incompatible schema/version | Readiness becomes false before sockets close; no stale state served across process restart | Deployment/rollback cannot bridge epochs or schemas |
| WS-16 | Live contract and shadow evidence | Sanitized observed frames promoted into regression fixtures after review | Low-rate single-pair live smoke per venue/segment, then controlled allowlist shadow | 72-hour report and dashboards; no user-visible enablement during shadow | Live smoke is not reliability proof; shadow gate below is mandatory |

### Deterministic fixture and replay requirements

- Use an injectable monotonic clock, wall clock, connection-epoch generator, scheduler, and reconnect jitter seed. Tests use fake time and event-driven assertions; no arbitrary sleeps.
- Store sanitized frames as bytes/text plus expected parse result. Include protocol handshake/ack/error, full book, delta, combined wrapper, heartbeat, close, schema drift, and catalog metadata versions. Never store cookies, request headers, private tokens, or user data.
- A replay scenario declares initial metadata/rules, REST snapshot, ordered transport events, timing, expected health transitions, final canonical book hash, and whether ranking is permitted after each step.
- Required Tokocrypto scenarios: stale deltas before snapshot, first-event overlap, duplicate, overlapping ranges, exact continuity, single/multiple gaps, reorder, zero delete, unknown-level delete, reconnect during buffer, snapshot timeout, snapshot behind buffer, buffer overflow, source-time regression, and 24-hour renewal.
- Required full-snapshot scenarios: atomic replacement, duplicate offset/message, older offset, missing level, empty/crossed/misaligned snapshot, malformed frame, socket silence, reconnect, old-epoch late message, REST verification match/mismatch, and recovery.
- Property tests generate valid decimal books and event sequences around sequence/offset and configured queue boundaries. The oracle verifies sorted/non-crossed books, increment alignment, exact decimal totals, and that no unhealthy transition publishes an eligible estimate.

### Browser live-delivery and accessibility acceptance

- A controlled canonical book update changes the visible estimate and ranking within the approved UI delivery cadence while preserving asset, side, amount, focus, and scroll context.
- A venue crossing stale/gap/unverified/unavailable becomes textually ineligible at the next evaluation; if two remain, the winner says 2 of 3; if fewer than two remain, the best-venue claim disappears.
- Recovery requires a new synchronized/fresh state, not merely an open socket. The status change is announced through stable live-region semantics without repeatedly reading the entire results grid.
- Rapid ingest does not create rapid DOM churn. Rendering is throttled/coalesced, final state is correct, focus is not stolen, and meaningful updates do not depend on animation or color.
- Desktop, mobile, keyboard, 200% zoom/reflow, reduced motion, and screen-reader-oriented accessible-name/live-region assertions cover healthy, stale, partial, no-winner, and recovery flows.
- Browser network inventory must show only Komper BFF delivery endpoints. Exchange WebSocket URLs, static tokens, and adapter control messages remain server-side.

### Live smoke and 72-hour shadow gate

Live checks are public, low-rate, allowlisted, and non-mutating. Start with one liquid verified direct-IDR pair per venue/segment. Verify handshake, subscription ack, sanitized payload schema, symbol identity, numeric representation, message cadence, heartbeat, close behavior, and REST top-of-book correlation. A failed smoke check disables that capability; it never authorizes a fallback contract guess.

Before user-visible WebSocket rankings, run at least 72 continuous hours in a production-like shadow environment on the approved pair allowlist. The report must state environment/build/configuration, exact venues/segments/pairs and coverage time, planned/unplanned restarts, and all missing intervals. It must include:

- connection hours, joins, disconnect codes/reasons, reconnect attempts/backoff, connection epochs, heartbeat RTT/misses, open-but-silent intervals, and scheduled renewals;
- messages/bytes, schema acceptance/rejection by version, source-to-receive and receive-to-process lag where measurable, queue/buffer high-water marks, coalesces/overflows, event-loop lag, heap trend, active sockets/listeners/timers, and CPU/network observations;
- snapshots, deltas, duplicates/stale events, offset/sequence gaps, reorder detections, invalidations, resync attempts/outcomes/duration, REST requests/status/`Retry-After`, and rate/subscription-limit disconnects;
- synchronized/fresh/eligible time per venue/pair, comparisons suppressed by reason, zero instances of stale/gapped/unverified state entering ranking or alerts, and REST-versus-WS top-of-book/depth discrepancies with investigation outcome;
- measured common direct-IDR coverage against the PRD launch gate, known defects, missing coverage, upstream/documentation contradictions, and residual risk.

Shadow exit requires all deterministic gates green, no open P0/P1, 100% of injected gaps detected, zero observed unhealthy books ranked, PRD data-health target evaluated only during intervals the upstream is demonstrably reachable, configured resource bounds respected, and every unexplained gap/schema/rate-limit/recovery anomaly resolved or explicitly rejected by CTO/QA with user-visible capability disabled. The 72-hour run does not satisfy AC-16 data rights and does not justify an availability claim; those remain separate gates.

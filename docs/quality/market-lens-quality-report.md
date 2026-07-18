# Quality report: Komper Market Lens

## Release recommendation

**Conditional GO for the Markets increment and existing comparison as an internal, non-commercial evaluation. NO-GO for public beta, monetization, or reliability claims.**

The build, 66-test deterministic suite, full Chromium desktop/mobile browser suite, and core comparison/Markets flows are green. Retest evidence closes ML-007 through ML-010 and the WebSocket defects documented in the 2026-07-18 addendum below. Public release remains blocked by incomplete accessibility/live reliability evidence, the 72-hour shadow gate, and AC-16 because no product/legal approval evidence for commercial public-data use was observed.

## Environment and tested scope

- Date/time: 2026-07-18, Asia/Jakarta
- Host: Windows 11 Home Single Language 64-bit, version 10.0.26200
- Runtime: Node.js 24.14.0, npm 11.9.0
- Browser tooling: Playwright 1.61.1, Chromium desktop, Pixel 5, and 320 px narrow viewport
- Build: local workspace production client/server build; fixture mode for deterministic tests; live mode for low-rate public GET contract checks
- Scope: web app, BFF routes, catalog/comparison services, three public adapters, decimal/order-book domain, fee registry, analytics schema, and external-link flow
- Excluded: private APIs, execution, credentials, production load, long-duration reliability, and legal research/sign-off

## Commands and observed results

| Command/evidence | Result |
| --- | --- |
| `npm run format:check` | PASS; all files formatted before report creation |
| `npm run typecheck` | PASS; zero TypeScript errors |
| `npm run lint` | PASS; zero warnings/errors |
| `npm test` | PASS; 8 files, 29 tests |
| `npm run build` | PASS; Vite client and tsup server |
| `npm run test:e2e` | PASS; 9 passed, 1 intentional desktop skip for mobile-only test |
| Playwright `APIRequestContext`, fixture built server | PASS; health/catalog, buy/sell, invalid/unsupported input, cache headers, private-route 404s |
| Playwright recovery probe | PASS; simulated 503 then success retained `7000000`, removed error, and rendered results without reload |
| Narrow/reduced-motion browser probe | PASS; 320/320 scroll width, all venue links present, Reku link focusable, no console error/private request |
| Live built BFF contract smoke | PASS point-in-time; all three metadata sources accepted. ADA buy failed closed for Reku as `UNVERIFIED_RULES`; Indodax and Tokocrypto remained eligible and the gross winner was based on 2 of 3. |
| Targeted ML-001–ML-006 regression | PASS; 5 test files/19 focused tests plus original-repro probes |
| CTO increment invariants | PASS; executable quantity modulo step = 0, buy spend ≤ budget, sell quantity ≤ request, exact remainder/provenance returned, tiny sell excluded |
| Screenshot artifacts | PASS; desktop 1440×2218 and mobile 390×4687 PNGs exist and were visually inspected |

The live check observed the same 18 common assets stated in the PRD: ADA, ARB, AVAX, BNB, BTC, DOGE, DRX, ETH, HBAR, POL, RENDER, SOL, SUI, USDC, USDT, WIF, WLD, and XRP. This is not catalog, availability, or reliability approval beyond that run.

## Acceptance criteria assessment

| AC | Result | Evidence and gap |
| --- | --- | --- |
| AC-01 | PASS | Coverage disclosure names exactly three venues and says it is not all Indonesian exchanges. |
| AC-02 | PASS | Intersection fixture, failed-refresh quarantine/recovery, and Indodax maintenance/suspension regressions pass. |
| AC-03 | PASS | Multi-level decimal buy and post-quantization re-walk pass; executable quantity aligns to step and spend never exceeds budget. |
| AC-04 | PASS | Multi-level sell, floor quantization, request bound, remainder disclosure, and post-quantization minimum checks pass. |
| AC-05 | PASS | Deterministic partial depth and browser state expose unfilled amount and prevent that venue from winning. |
| AC-06 | PARTIAL | Current registry correctly leaves all fees unverified and ranks gross only. Verified fee unit path passes. Expiry semantics and invalid fee bounds are not implemented/tested. |
| AC-07 | PARTIAL | Controlled stale snapshots are excluded. The live increment now has connection epochs, health states, Indodax/Reku full-snapshot workers, and a Tokocrypto `U/u` sequence/gap builder. It remains partial because Reku/Indodax were not proven live in this environment and no 72-hour shadow evidence exists. |
| AC-08 | PASS | WIF fixture retains two healthy venues, exposes schema failure, and labels winner as 2 of 3. |
| AC-09 | PASS | DRX fixture with one eligible venue suppresses winner/ranking. No alert capability exists. |
| AC-10 | PARTIAL | Zod, crossed-book, invalid decimal, and misaligned/unverified rule failures now fail closed with the correct category. Explicit unknown canonical schema-version injection remains untested. |
| AC-11 | PASS | Domain arithmetic, increment lattice, beyond-safe-integer IDR, and 18-digit asset formatting pass without financial `Number` coercion. |
| AC-12 | PASS | Estimate/non-executable disclosure and fee/tax/transfer/execution-delay exclusions appear before venue links. |
| AC-13 | PASS | Source/route inventory and browser traffic found no credential form, private exchange request, or execution route; `/api/order`, `/api/wallet`, and `/api/private` return 404. |
| AC-14 | PARTIAL | Existing mobile keyboard flow, 320 px no-overflow probe, visible focus, text/symbol statuses, and reduced-motion CSS pass. Automated 200% browser zoom, screen-reader announcement, contrast, and axe coverage remain missing. |
| AC-15 | PARTIAL | Browser fail-then-recover retains input, while deterministic supervisor tests cover reconnect, stale market-data detection independent of heartbeat, and epoch rejection. EventSource-enabled browser reconnect/announcement coverage remains missing. |
| AC-16 | BLOCKED | UI is labeled internal evaluation, but no documented venue permission or product/legal approval was present. Public monetization remains blocked by the PRD. |

## Defects

### ML-001 — P1 — CLOSED — failed metadata refresh retained stale venue eligibility

- Affected: AC-02, catalog fail-closed behavior.
- Repro: create three in-memory catalog adapters; first forced refresh succeeds; make Tokocrypto discovery throw; force refresh again.
- Observed: `sourceStatus` says Tokocrypto `ok:false`, but BTC remains `selectable:true` and Tokocrypto coverage remains `available:true` from the prior map.
- Expected: failed venue metadata is quarantined/removed for the refreshed catalog; no instrument can claim validated three-venue coverage from stale hidden state.
- Cause evidence: `CatalogService` updates `instrumentsByVenue` only for fulfilled results and does not clear a rejected venue.
- Retest: failed refresh now deletes the affected venue catalog, makes coverage unavailable/selectable false, and a later successful refresh restores it. Unit regression passed.

### ML-002 — P1 — CLOSED — sell below venue minimum was eligible and could win

- Affected: AC-04 and minimum-order ranking.
- Repro: fixture comparison BTC sell amount `0.000000001`; each fixture publishes minimum notional `10000` IDR.
- Observed: gross outcomes are approximately Rp1, all three venues are `ELIGIBLE`, and Tokocrypto wins.
- Expected: compute sell notional using walked bids and mark below-minimum/ineligible according to the venue rule.
- Cause evidence: minimum-notional check runs only when `side === 'buy'`.
- Retest: BTC sell `0.000000001` now returns `BELOW_MINIMUM` for all three fixture venues, zero eligible venues, and no winner.

### ML-003 — P1 — CLOSED — venue tick/step rules were not applied to estimates

- Affected: AC-03, AC-04, AC-11.
- Repro: fixture BTC buy Rp5,000,000 with quantity increment `0.00000001`.
- Observed: Indodax gross outcome `0.004995004995004995`, remainder modulo step `0.000000004995004995`; comparable violations occur for other venues. Increment metadata is not passed to the walker or API result.
- Expected: normalization defines correct increment semantics and the reference calculation applies documented rounding without overstating fill or changing money silently.
- Retest: provenance-bearing `STEP_SIZE`/`DECIMAL_PLACES` rules follow the CTO decision. Fixture buy/sell executable quantities have zero modulo step; buy spend is within budget; sell is within request; exact floor remainder is returned. Misaligned or ambiguous rules fail closed.

### ML-004 — P1 — CLOSED — Indodax maintenance/suspension was normalized active

- Affected: AC-02.
- Repro: mocked Indodax pair payload with `is_maintenance:1` and `is_market_suspended:1`.
- Observed: adapter returns `active:true`. It also maps `volume_precision:8` to `quantityIncrement:"8"`, showing decimal-count/increment ambiguity.
- Expected: suspended/maintenance pairs cannot enter the active intersection; precision fields are converted by verified semantics.
- Retest: the original mocked payload now returns `active:false`, price step `1000` from `price_precision`, and quantity step `0.00000001` from documented `price_round:8` decimal-place semantics.

### ML-005 — P2 — CLOSED — invalid numeric schema data was reported as upstream unavailable

- Affected: AC-10 and operator/user diagnosis.
- Repro: canonical bid price `NaN` from each controlled adapter.
- Observed: all results become `UNAVAILABLE`; telemetry category is `unavailable`, and UI says source cannot be contacted.
- Expected: `SCHEMA_ERROR` with a bounded non-sensitive schema reason. Ranking already fails closed.
- Retest: `NaN` now produces `SCHEMA_ERROR` and telemetry category `schema`; focused regression passed.

### ML-006 — P1 — CLOSED — UI financial formatting converted exact strings to binary `Number`

- Affected: AC-11 end-to-end precision.
- Repro: call the client formatters with exact strings.
- Observed: `10000000000000001` IDR displays as `10.000.000.000.000.000`, losing Rp1; `1.000000000000000001 BTC` displays as `1 BTC`.
- Expected: decimal-string-safe grouping and rounding according to governed display/source precision, without binary conversion.
- Retest: exact outputs are `Rp10.000.000.000.000.001` and `1,000000000000000001 BTC`; unit and desktop/mobile browser regressions passed.

## Architecture gaps and non-defect residual risk

- The implementation now includes server-side WebSocket workers, connection epochs, immutable live state, gap handling, periodic REST correlation/verification, `UNSYNCED` fail-closed states, same-origin SSE, and REST rollback. Capability negotiation, durable history, and Reku channel multiplexing are not implemented; Reku instead uses a fail-closed process-local connection budget.
- Live BTC snapshots were eligible while `freshnessIndependentlyVerified:false`; reported age was BFF receive age, not provable upstream book age. Indodax may serve cached public REST data, and cache provenance is not carried into health.
- `fetchPublicJson` has HTTPS host allowlists, a six-second timeout, redirect rejection, strict JSON parsing, and a two-megabyte limit. It does not implement the architecture's `Retry-After` handling, per-host budgets, circuit breaking, or 429/418/5xx telemetry. A controlled 429 produced one `upstream_http_429` error and discarded `Retry-After`.
- The fixture asserts 18 selectable assets but does not exercise each venue's status, min-notional, price increment, and quantity increment variants.
- The current fee registry is safely unverified. Before enabling net comparison, define expiry, rate bounds, fee asset/side semantics, version governance, and display rounding.
- There is no 72-hour shadow-ingestion report, 30-day reliability evidence, approved SLO, or runbook evidence. No reliability statement should be published.
- Automated cross-browser coverage is Chromium-only. Screen-reader behavior, contrast, 200% browser zoom, and WebKit/Firefox remain unverified.

## Required release actions

1. Preserve the ML-001–ML-006 regressions as mandatory release gates.
2. Keep the live WebSocket/SSE feature flags off for public traffic until the shadow, venue-live, operational, and browser EventSource gates in the 2026-07-18 addendum pass.
3. Add fee-expiry/bounds/asset semantics before any `VERIFIED` registry entry.
4. Run the required 72-hour shadow evaluation and record schema acceptance, pair coverage, source/cache age, gaps, rate limits, and residual risk.
5. Obtain and record product/legal approval for public commercial display, caching, and derived data at each venue. Until then retain the internal evaluation label and do not monetize.

## Markets increment verification — 2026-07-18

### Environment and tested scope

- Environment: local Windows workspace, production client/server build, fixture market-data mode, Asia/Jakarta display timezone.
- Browser matrix: Playwright Chromium desktop and Pixel 5 mobile; targeted 390 px and horizontal-overflow probes.
- Tested scope: `/markets`, canonical and invalid `/markets/{pair}` routing, overview/detail BFF contracts, union catalog, pricing, order-book cumulative values, recent public trades, fixed 24-hour/1-hour normalized chart, aggregate partial-state rendering, and responsive artifacts.
- Not tested as release evidence: production load, live Markets data correctness, 200% browser zoom, screen-reader output, automated WCAG scan/contrast, 72-hour shadow behavior, or venue data-rights approval.

### Commands and observed results

| Command/evidence | Result |
| --- | --- |
| `npm run format:check` | PASS in the final primary-agent gate after formatting corrections. |
| `npm run typecheck` | PASS; zero TypeScript errors, including the post-handoff chart extraction. |
| `npm run lint` | PASS; zero warnings/errors. |
| `npm test` | PASS; 66 unit/integration tests across 20 files, including freshness boundaries, candle quarantine, shared chart baseline/gaps, live state builders, and Markets contracts. |
| Focused Markets unit coverage | PASS; shared `0%` baseline/hourly gap segmentation, 89,999/90,000/90,001 ms freshness boundaries, aligned closed candles, invalid OHLC, current bucket, and conflicting duplicate quarantine. |
| `npm run build` | PASS; production Vite client and tsup server bundles generated. |
| `npm run test:e2e` | PASS; 16 passed and 2 expected viewport-specific skips across desktop and mobile Chromium. Covers age UI, canonical/unsupported routing, series toggle/accessibility table, and partial aggregate retry/recovery. |
| Markets API integration | PASS for fixture overview, aggregate BTC detail, fixed `1h` interval/24 candles, malformed `400`, and unknown market `404`. |
| Targeted mobile probe | PASS for page-level reflow: document `clientWidth` and `scrollWidth` were both 390 px. The overview table intentionally scrolls inside a 348 px container with 760 px content; all Pair/Indodax/Reku/Tokocrypto headers remained programmatically present. |
| Partial-response recovery | PASS; injected Reku order-book failure produced component status and partial banner, retained healthy pricing, exposed one whole-snapshot retry, and cleared the partial state after the fresh aggregate response. |
| Low-rate live BTC candle smoke | PASS as point-in-time contract evidence only; Indodax/Reku/Tokocrypto returned 23/14/23 valid closed candles after quarantine. Uneven history remains a visible coverage limitation, not reliability evidence. |
| Screenshot inspection | `markets-detail-desktop.png` and `markets-mobile.png` exist and were visually inspected. Desktop preserves pricing/chart/book/trade/OHLC hierarchy; mobile overview is readable and internally scrollable, but the static artifact shows only Pair and Indodax without proving discovery of off-screen venue columns. |

### Markets acceptance assessment

| AC | Result | Evidence and gap |
| --- | --- | --- |
| AC-17 | PASS | Union catalog unit test preserves one/two/three-venue pairs, stable venue cells, and explicit unsupported coverage; fixture overview API/browser path passes. |
| AC-18 | PASS | Last-price labels, venue identity, IDR values, and source/receive age render per venue; targeted Playwright requires three age labels for the BTC fixture row. |
| AC-19 | PASS | `AVAILABLE`, `STALE`, `UNAVAILABLE`, and `UNSUPPORTED` are distinct. Frozen-clock tests prove 89,999/90,000 ms remain available and 90,001 ms becomes stale; the UI retains the value with explicit stale text instead of presenting it current. |
| AC-20 | PASS | Upper-case detail URL canonicalizes to lowercase and direct refresh renders the same fixture detail in Playwright. |
| AC-21 | PASS | Malformed and well-formed unsupported browser routes avoid the detail API and show distinct not-found states; the API unknown canonical pair returns `MARKET_NOT_FOUND`. |
| AC-22 | PARTIAL | Pricing table shows last/bid/ask, IDR/bps spread, age, venue, and optional 24-hour fields. Exact spread boundaries, unverified-window suppression, and fewer-than-two comparative wording lack dedicated automated coverage. |
| AC-23 | PARTIAL | Cumulative base and IDR are calculated with Decimal and visible per venue; empty, unsupported, and fewer-than-five-level snapshots are explicitly labelled. Invalid ordering/increments are not all exercised at the Markets UI/service layer. |
| AC-24 | PARTIAL | Public trade time/price/quantity/notional, visible buy/sell/unknown side, and venue grouping render. Dedicated deduplication and source-order fixtures remain missing. |
| AC-25 | PASS | One chart uses a shared `0%` baseline and gap segmentation. Venue controls expose `aria-pressed`, prevent hiding the final series, and the aligned accessible table exposes each timestamp's absolute O/H/L/C, normalized percent, and explicit gaps across venues. |
| AC-26 | PASS | Server validation requires UTC-hour alignment, positive finite OHLC invariants, a closed/non-current bucket, and deterministic duplicate quarantine to an explicit gap. Unit tests cover misalignment, invalid high/low, open current bucket, and conflicting duplicates. |
| AC-27 | PARTIAL | Fixed 24h/1h presentation has no range control; series controls and React-local visibility state survive aggregate data replacement by design, and background refresh has a live status announcement. The browser test covers toggling, but does not yet assert that hidden-series state survives a refetch. |
| AC-28 | PASS | Response contracts expose ticker/order-book/trades/candles status and reason per venue. Playwright injects a partial Reku order book, retains healthy pricing, uses one whole-snapshot retry, and observes recovery without page reload. |
| AC-29 | PARTIAL | Desktop/mobile Playwright, keyboard navigation, internal horizontal scrolling, no page overflow at 390 px, reduced-motion classes, chart description, and accessible OHLC tables are present. Automated 200% zoom, screen-reader announcement, contrast, and accessibility scanning remain unverified. |

### Markets defect retest

#### ML-007 — P1 — CLOSED — stale overview ticker was presented as available without age

- Affected: AC-18, AC-19.
- Original evidence: the overview accepted any ticker object and omitted its age.
- Fix/retest: the service now evaluates source time when present or BFF receive time against a 90-second phase-1 threshold, rejects excessive future skew, and returns distinct `STALE`, `UNAVAILABLE`, and `UNSUPPORTED`. Unit boundaries at 89,999/90,000/90,001 ms pass, and Playwright observes age beside all three BTC venue values.

#### ML-008 — P2 — CLOSED — partial aggregate snapshot lacked compliant component status and retry

- Affected: AC-28.
- Original evidence: detail exposed only an aggregate venue state and no retry for a structurally successful partial response.
- Fix/retest: each venue now carries ticker/order-book/trades/candles status and reason. The partial banner offers one `Muat ulang snapshot` action, retains healthy pricing, disables/renames the action while fetching, and focused Playwright observes a second aggregate request and recovered state without reload.

#### ML-009 — P1 — CLOSED — invalid or misaligned candles could enter the comparison chart

- Affected: AC-25, AC-26.
- Original evidence: client normalization accepted any positive close, floored timestamps, and silently used the last duplicate.
- Fix/retest: `validateMarketCandles` now runs server-side, requires exact UTC-hour alignment, positive finite OHLC with `low <= open/close <= high`, a valid closed interval, and a completed bucket. Conflicting duplicates remove the bucket so it remains a gap. Deterministic tests pass, and a low-rate BTC smoke retained 23/14/23 valid candles after quarantine.

#### ML-010 — P2 — CLOSED — chart series controls and shared timestamp inspection were absent

- Affected: AC-25, AC-27, AC-29.
- Original evidence: legend entries were static and accessible tables were separated by venue.
- Fix/retest: every venue is now a keyboard button with `aria-pressed` and visible/hidden text; at least one series remains visible. Visibility is component state rather than response data, so aggregate refresh does not reset it. The accessible table aligns all venue O/H/L/C and normalized percentage values by shared timestamp and labels missing points as gaps; focused Playwright toggles a series and opens the table.

### Missing coverage and residual risk

- Browser coverage now exercises age display, canonical/malformed/well-formed unsupported routing, series controls/access table, and partial aggregate retry/recovery. All-component failure, stale-to-fresh browser recovery, off-screen venue discovery, 200% zoom, and automated accessibility rules remain missing.
- Low-rate live BTC candle smoke accepted 23 Indodax, 14 Reku, and 23 Tokocrypto closed candles. This confirms point-in-time parsing/quarantine only; Reku did not supply a complete 24-bucket history, and timestamps, retention, side semantics, sustained gaps, and upstream reliability remain risks.
- The chart performs exact Decimal normalization before converting plotted percentages to JavaScript numbers. Extreme-price/precision fixtures and accessible normalized-value rounding are not covered.
- Static mobile evidence cannot prove scroll affordance or screen-reader relationships; the targeted DOM probe proves internal scrolling and headers, not usability with assistive technology.
- AC-16, historical storage/display rights, the 72-hour shadow gate, and reliability claims remain blocked independently of the Markets implementation defects.

### Markets release recommendation

QA recommends **conditional GO for internal, non-commercial evaluation of the Markets increment**. ML-007 through ML-010 are closed by deterministic and focused browser evidence. Public beta remains **NO-GO** because AC-27 and AC-29 retain announcement/assistive-technology evidence gaps, live 24-hour history is incomplete for Reku in the observed smoke, and the independent shadow/legal gates remain unmet.

## Final QA decision

The final green format/typecheck/lint/build gates, 66 deterministic tests, and full Playwright result of 16 passed/2 expected skips demonstrate build integrity and close ML-007 through ML-010 plus the automated WebSocket regressions below. QA recommends **conditional GO for internal, non-commercial evaluation of both Markets and the existing size-aware comparison**. Public beta, monetization, and reliability claims remain **NO-GO** until the remaining AC-27/AC-29 evidence gaps, 72-hour shadow evidence, live coverage limitations, and legal/data-rights gates are resolved.

## WebSocket/SSE increment verification — 2026-07-18

### Scope and environment

- Scope: server-side Indodax/Reku/Tokocrypto ingestion, canonical live-book store, epoch/health handling, comparison ranking integration, same-origin SSE, browser EventSource cache replacement, connection/resource cleanup, and default-off rollout controls.
- Environment: local Windows workspace in Asia/Jakarta; deterministic fake socket/clock/scheduler fixtures plus low-rate public smoke where network and credentials allowed.
- Excluded as release evidence: production load, 72-hour shadow ingestion, 100+ reconnect soak, production observability/runbooks, browser EventSource E2E with the live build flag enabled, and legal/data-rights approval.
- QA independently reproduced the heartbeat-freshness, SSE backpressure, concurrent-retain, and retain error-path defects before the fixes. The final automated regression and repository gates were rerun by the primary agent after the QA agent session reached its usage limit.

### Final commands and observed results

| Command/evidence | Result |
| --- | --- |
| `npm run format:check` | PASS; all files match Prettier. |
| `npm run lint` | PASS; zero warnings/errors. |
| `npm run typecheck` | PASS; zero TypeScript errors. |
| `npm test` | PASS; 20 files, 66 tests. Includes live protocol/store/builder/supervisor/coordinator/SSE regressions. |
| `npm run build` | PASS; Vite client and tsup server bundles generated. |
| `npm run test:e2e` | PASS; 16 passed, 2 intentional project-specific skips. The suite is baseline browser coverage, not EventSource-enabled acceptance. |
| Tokocrypto BTC/IDR type-1 smoke | PASS point-in-time only; a valid `depthUpdate` frame was observed and a full REST-plus-delta worker bootstrap reached `LIVE`/`SYNCHRONIZED`. |
| Reku live smoke | BLOCKED by local DNS `ENOTFOUND ws.reku.id`; deterministic parsing is covered, but live behavior is not approved. |
| Indodax live smoke | NOT RUN because `INDODAX_PUBLIC_WS_TOKEN` was absent; deterministic worker replay is covered. |
| Flags-off API | PASS; live SSE returns `404 LIVE_DISABLED`, invalid input returns `400 INVALID_REQUEST`. |

### WS-01 through WS-16 assessment

| Area | Result | Evidence and gap |
| --- | --- | --- |
| WS-01 Indodax | PARTIAL | Runtime schemas, full-snapshot worker replay, offset gap invalidation, reconnect, and REST top correlation are tested. Live handshake/recovery is unverified without a token. |
| WS-02 Reku | PARTIAL | Phoenix parsing, full-snapshot replacement, heartbeat, REST verification, and fail-closed connection budgeting are implemented. Live DNS failed and there is no multiplexed channel worker. |
| WS-03/04 Tokocrypto | PARTIAL | Type-1 snapshot plus `U/u` buffering/overlap/continuity/gap tests pass and low-rate smoke reached live state. Type-3 intentionally remains `REST_POLL`; long-duration sequence reliability is unverified. |
| WS-05/06 state and ranking | PASS deterministic | Immutable records, connection epochs, old-epoch rejection, synchronization/health metadata, freshness gating, and fail-closed ranking paths are covered. |
| WS-07/08 reconnect and silence | PASS deterministic | Reconnect/backoff/gap observability is covered. Market-data freshness is tracked separately from ping/pong and protocol ACK traffic. |
| WS-09/10 partial failure | PARTIAL | Invalid frames and venue creation failures fail closed; mixed healthy/failed venues retain partial availability. Sustained upstream rate-limit and circuit-breaker behavior remains untested. |
| WS-11/14 concurrency and lifecycle | PASS deterministic, PARTIAL operational | Per-instrument creation is single-flight; concurrent subscribers share one ref-counted worker; failed reservations retry; rollback prevents leaked references. No high-churn or 100+ reconnect soak was run. |
| WS-12 SSE backpressure | PASS deterministic | One latest comparison is retained, heartbeats cannot overwrite it, memory is bounded, and persistent slow consumers are disconnected. |
| WS-13 browser delivery | PARTIAL | EventSource replaces the TanStack comparison cache and reports connection state. No Playwright run enabled `VITE_LIVE_COMPARISONS`, so browser reconnect/stale/announcement acceptance remains open. |
| WS-15 live venue smoke | PARTIAL | Tokocrypto passed a point-in-time smoke; Reku and Indodax remain unverified in this environment. |
| WS-16 shadow/release | BLOCKED | No 72-hour shadow report, reliability SLO evidence, alerting dashboard, or venue data-rights approval exists. |

### Closed WebSocket defects

- Heartbeat/ACK traffic could keep a silent market feed `LIVE`; fixed by tracking market payload freshness independently.
- An SSE heartbeat could replace the newest pending comparison during backpressure; fixed with separate control/data handling, one latest comparison slot, and slow-consumer disconnect.
- One Reku socket per asset could exceed the venue connection limit; fixed with a default budget of 8 and a hard maximum of 10. This is fail-closed budgeting, not multiplexing.
- Concurrent first subscribers could create two workers and leak one socket/budget permit; fixed with per-instrument single-flight creation and ref-counted release.
- A later venue creation failure could leak earlier retained workers and fail the whole stream; fixed with partial-failure isolation, reservation retry cleanup, and rollback coverage.

### WebSocket release recommendation

**Conditional GO for internal, non-commercial, feature-flagged evaluation only. NO-GO for enabling live ranking/SSE in public beta, monetization, or reliability claims.** Keep `MARKET_LIVE_INGEST_ENABLED`, `MARKET_LIVE_RANKING_ENABLED`, `MARKET_LIVE_SSE_ENABLED`, and `VITE_LIVE_COMPARISONS` off by default until WS-13, WS-15, WS-16, operational observability, and legal/data-rights gates are closed.

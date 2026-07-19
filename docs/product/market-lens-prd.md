# Product requirements: Komper Market Lens

## Status and ownership

- Status: Draft
- Product owner: `product_manager`
- Technical owner: `cto`
- Last updated: 2026-07-18
- Related issues/designs/ADRs: [Market Lens architecture](../architecture/market-lens-architecture.md); [ADR-001: Market-data ingestion and normalization](../architecture/adr/ADR-001-market-data-ingestion-and-normalization.md)

## Problem

An Indonesian crypto trader who has access to more than one exchange cannot reliably answer where a spot order will receive the best result. Last price and best bid/ask ignore order size, available depth, slippage, fees, stale data, and minimum-order rules. The user must inspect multiple applications and calculate the comparison manually before placing an order.

Evidence available in this repository:

- The collected public APIs for Indodax, Reku, and Tokocrypto expose IDR market metadata and order books. Tokocrypto additionally documents sequenced depth updates and 100 ms WebSocket streams.
- A public-endpoint audit on 2026-07-17 observed 18 active IDR assets common to all three exchanges: ADA, ARB, AVAX, BNB, BTC, DOGE, DRX, ETH, HBAR, POL, RENDER, SOL, SUI, USDC, USDT, WIF, WLD, and XRP. This is a point-in-time observation, not a guaranteed catalog.
- Tokocrypto exposes symbol precision, notional filters, order-book snapshots, recent trades, and market streams through public endpoints. Equivalent public market-data capabilities exist in the collected Indodax and Reku documentation, with different schemas and freshness characteristics.

Assumptions that remain unvalidated:

- Active traders who use at least two supported exchanges experience this problem often enough to return weekly.
- Size-adjusted comparisons and persistent alerts create more willingness to pay than a simple last-price comparison.
- The three named exchanges and at least 10 common liquid IDR pairs provide enough coverage for an initial paid beta.
- Commercial display, caching, and transformation of each exchange's public market data are permitted. This requires explicit review before public monetization.
- A browse-first market overview and pair-detail view will help users identify which pair deserves a size-aware execution comparison; this repository does not yet contain observed usage evidence for those journeys.
- Public last-trade, recent-trade, order-book, and candle data can be normalized to comparable time buckets for all three venues. Missing source timestamps, inconsistent candle boundaries, and retention limits remain technical validation items.

## Users and context

Primary user: an active Indonesian retail crypto trader who uses at least two of Indodax, Reku, and Tokocrypto and manually chooses a venue before placing a spot order.

Job to be done: “Before I buy or sell an asset, help me quickly estimate which supported exchange gives me the best result for my intended size, and show why I can or cannot trust the comparison.”

Secondary users for later validation are small trading desks, analysts, and publishers that may consume a derived-data API or embeddable widget. They are not the primary design target for this MVP.

The user remains responsible for funding accounts, transferring assets, and executing orders in the exchange application. Market Lens does not know the user's balances or account-specific fee tier.

## Desired outcome

Users can make a more informed venue choice in under one minute using a transparent estimate based on current public order-book depth, declared fee assumptions, market rules, and data freshness.

The business validates whether repeated comparison behavior and willingness to pay justify a Pro product, without initially accepting exchange credentials or execution risk.

Proposed positioning:

> Compare estimated spot execution across Indodax, Reku, and Tokocrypto before you trade.

The product must not claim to cover all Indonesian exchanges, guarantee an executable quote, or guarantee arbitrage profit.

This PRD also defines a Markets discovery increment. It adds `/markets` for scanning last prices across the named exchanges and `/markets/{pair}` for inspecting a pair's pricing, order books, public transaction activity, and OHLC history. Pair detail includes one Highcharts line chart that compares the candle close price from Indodax, Reku, and Tokocrypto over selectable `1D`, `1W`, `1Y`, and `All` periods. These views are observational context. They complement rather than replace the existing size-aware buy/sell comparison.

## Success measures

All targets below are product hypotheses for the first 30-day closed beta; they are not observed baselines or approved forecasts.

| Measure                        | Baseline           | Proposed target                                                                                                              | Window                                       | Instrumentation                                                            |
| ------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| Comparison activation          | Unknown            | At least 40% of new sessions produce one valid two-or-more-venue comparison                                                  | First 30 days                                | `comparison_requested`, `comparison_succeeded`                             |
| Time to first valid comparison | Unknown            | Median at or below 60 seconds from landing                                                                                   | First 30 days                                | Anonymous session timestamps                                               |
| Repeat value                   | Unknown            | At least 20% of activated users return and compare again within 7 days                                                       | Rolling D7                                   | Privacy-preserving anonymous/user ID cohort                                |
| Comparison usefulness          | Unknown            | At least 60% of surveyed activated users report that the result changed or confirmed their venue decision                    | First 30 days                                | In-product one-question survey; minimum 30 responses before interpretation |
| Data health                    | Unknown            | At least 99% successful normalized snapshots during intervals when the upstream endpoint is reachable                        | Seven consecutive days before beta expansion | Per-exchange ingestion and schema telemetry                                |
| Calculation correctness        | No reference suite | 100% pass on approved deterministic order-book fixtures for buy, sell, fee, precision, stale, and insufficient-depth cases   | Every release                                | Automated reference-calculation suite                                      |
| Monetization signal            | Unknown            | At least 10 qualified upgrade-interest submissions or 3 paid design partners; neither target alone proves product-market fit | First 30 days                                | `upgrade_interest_submitted`; manually verified design-partner ledger      |
| Markets discovery activation   | Unknown            | At least 30% of `/markets` sessions open one supported pair detail                                                            | First 30 days                                | `markets_viewed`, `market_pair_opened`                                     |
| Pair-detail usefulness         | Unknown            | At least 60% of surveyed pair-detail users say the view helped them understand cross-exchange differences                      | First 30 days; minimum 30 responses before interpretation | `market_pair_viewed`; in-product usefulness response |
| Market-view data completeness  | Unknown            | At least 95% of supported pair-detail loads show fresh pricing and order books from every venue where the pair is active; exclusions remain visible | Seven consecutive days before beta expansion | Per-capability health telemetry; excluded venues do not count as success |
| Market-view responsiveness     | Unknown            | p75 initial `/markets` usable render at or below 2.5 seconds and pair-detail primary pricing at or below 3 seconds              | Closed beta, supported mobile and desktop profiles | Web-vitals and API latency telemetry |
| Chart exploration              | Unknown            | At least 25% of pair-detail sessions select a non-default chart period and at least 95% of successful period requests render two or more eligible venue series | First 30 days | `market_chart_period_selected`, chart capability-health telemetry |

## Scope

### Must have

- Support public spot market data from exactly three named exchanges: Indodax, Reku, and Tokocrypto.
- Support a configured launch set of direct IDR pairs that are currently tradable on all three exchanges. Validate availability from exchange metadata and expose the coverage state; do not assume the observed 18-pair list is permanent.
- Let the user select asset and side. A buy accepts an IDR budget; a sell accepts a base-asset quantity.
- Walk asks for buys and bids for sells to calculate filled quantity, gross weighted-average price, best-level price, gross slippage, and remaining unfilled amount.
- Display each venue's received-at time, source/event time when supplied, age, health state, and whether source freshness can be independently verified.
- Normalize exchange-specific symbol, side, precision, minimum-order, and order-book schemas while retaining the raw source identity for diagnostics.
- Apply a versioned public taker-fee assumption only when its source and effective/as-of date are recorded. Show gross results separately. If a fee is unknown or unverified, label it and do not declare a net-price winner.
- Rank only healthy, sufficiently liquid, comparable venues. A winner requires at least two eligible venues.
- Clearly label all results as estimates, state material exclusions, and provide a manual deep link to each exchange where feasible.
- Cover loading, partial-source, stale, schema-error, unsupported-pair, maintenance, empty-book, insufficient-depth, and all-sources-unavailable states.
- Collect the minimum analytics and data-quality signals needed to evaluate the success measures without collecting API keys, exchange credentials, or order details tied to an identified user.
- Provide a routable `/markets` page listing the union of verified active direct-IDR pairs across the three named exchanges. For every pair, show one last price per venue where the pair is active and healthy, its observation time/age, and a text status where unavailable, unsupported, or stale. Do not label the lowest last price as an executable winner.
- Provide a routable `/markets/{pair}` detail page for any pair in that Markets union catalog, with comparative pricing, order books, public market transaction activity, and historical OHLC data across Indodax, Reku, and Tokocrypto. Missing venue support remains visible rather than removing the pair.
- Require at least two healthy venues for comparative language. A one-venue pair may still have an observational detail page but cannot show a cross-venue winner, movement conclusion, or size-aware comparison claim. The existing size-aware flow retains its stricter three-venue intersection eligibility.
- In pair-detail pricing, show at minimum last price, best bid, best ask, absolute and basis-point spread, and source age per venue. Show 24-hour change, high, low, and volume only when their source window and units are verified; otherwise mark the metric unavailable rather than deriving an undocumented equivalent.
- In pair-detail order books, show comparable bid and ask views per venue with price, base quantity, cumulative base quantity, and cumulative IDR notional for a consistent configured depth. Preserve venue identity and snapshot freshness.
- Define “transaction activity” as public market trades, never account or user transactions. Show recent trade time, price, base quantity, IDR notional, and venue. Show aggressor side only when the source contract supplies an authoritative value; otherwise use `Unknown` and do not infer it from price movement.
- Render one Highcharts line-chart surface for price movement across the three exchanges. Each venue series plots the absolute IDR `close` of each accepted OHLC bucket; in this chart, “last price per interval” means that closed bucket's close price, not the live ticker, an executable quote, or an inferred trade. The three venue series use the same timestamp and IDR axes. A shared tooltip exposes venue, absolute open, high, low, close, and bucket time. Users can hide/show venue series without creating separate charts, and the chart must retain at least one visible series.
- Provide exactly four period presets: `1D`, `1W`, `1Y`, and `All`, with `1D` selected by default. Period and canonical resolution semantics are: `1D` = trailing 24 hours in closed 1-hour buckets; `1W` = trailing 7 times 24 hours in closed 4-hour buckets; `1Y` = trailing 365 times 24 hours in closed 1-day buckets; `All` = all approved retained history in closed 1-week buckets. Weekly buckets begin Monday at 00:00 UTC. All other buckets align to UTC epoch boundaries. The UI displays timestamps in WIB and discloses the active period and resolution.
- Bound every period to the latest fully closed canonical bucket at request time; do not plot an in-progress bucket. For `1D`, `1W`, and `1Y`, the inclusive start is the first bucket at or after the period duration before that end. `All` starts at the earliest accepted retained bucket available from any supported venue, so later venue listings appear as leading gaps rather than shortening the whole comparison. `All` is constrained by approved source retention and display rights and must state the earliest available date; it must not imply complete lifetime history when a source cannot supply it.
- Make chart gaps explicit: do not forward-fill, interpolate, or connect a line across a missing/stale bucket. A venue without enough valid history remains named with an unavailable/partial-history state.
- A coarser chart candle may be aggregated only from accepted closed canonical candles: open is the first valid open, high is the maximum high, low is the minimum low, and close is the last valid close in the target bucket. If any required constituent interval is absent, invalid, stale, duplicated with conflict, or still open, the target bucket is a gap; do not manufacture a close from a partial bucket. Volume aggregation is not required for the line chart.
- Selecting a period requests that bounded period and resolution, keeps the prior successful chart visible with a non-blocking loading status, and replaces it only after a valid response. The selected period and venue visibility survive background refresh. A failed period request shows a retry action and retains the last successful chart with its previous-period label so old data cannot be mistaken for the new selection. Concurrent responses cannot overwrite a newer user selection.

### Should/could have

- Preset buy budgets and a shareable comparison that expires or prominently preserves its snapshot time.
- Watchlists and alerts that trigger only after a threshold persists across multiple healthy snapshots.
- Historical spread and estimated-slippage charts with methodology and data gaps shown.
- A Pro packaging experiment for advanced alerts, longer history, export, and higher-frequency views.
- Derived-data API or embeddable widget for design partners after the data-rights and reliability gates pass.
- Additional Indonesian exchanges after demand, API quality, and data rights are validated.
- Search, sort, and filter controls on `/markets` beyond a minimal pair search; candidates include asset name, 24-hour movement, spread, volume, and data health after metric definitions are validated.
- A normalized percentage-return mode and a one-venue candlestick inspection mode within the same chart surface, after usability testing confirms that these do not obscure the default absolute-IDR three-venue close comparison.
- Custom date ranges, custom bucket sizes, sub-hour intervals, and additional presets after the fixed four-period capability, loading behavior, retention, and usage are validated.
- A direct path from pair detail into the existing size-aware comparison with the eligible pair preselected, after the landing route accepts and validates pair state from the URL. Until then, Markets must not imply that preselection is available.

### Non-goals

- Private APIs, user API keys, balances, portfolio reconciliation, order placement, cancellation, smart-order routing, bots, or automated arbitrage.
- Deposit, withdrawal, custody, fiat payment, or movement of user assets.
- Synthetic IDR prices derived from USDT or another quote asset.
- Guaranteed quotes, guaranteed fills, financial advice, profit claims, or a claim of complete Indonesian-market coverage.
- Incorporating transfer time, deposit/withdrawal status, withdrawal fees, account-specific fee tiers, tax circumstances, promotions, rebates, or the user's existing account balances into the MVP ranking.
- Futures, margin, staking, OTC, or non-spot products.
- A consolidated cross-exchange order book, synthetic “best book,” or aggregated recent-trade tape that hides venue identity.
- Inferring trades made by a user, exchange-wide unique trader counts, buy/sell intent, or aggressor side when the public source does not explicitly provide it.
- Presenting historical OHLC, ticker volume, last price, or a chart line as a guaranteed executable price or as proof of an arbitrage opportunity.
- Personalized watchlists, alerts, pair favorites, or historical data export as part of this Markets increment.
- Candlestick, area, volume, technical-indicator, drawing-tool, predictive, or streaming tick charts in this increment. The required historical comparison is a line chart of closed-bucket close prices only.
- Treating `All` as exchange-lifetime history when upstream retention, product retention, or display rights provide a shorter window; backfilling unavailable history from synthetic pairs or third-party prices is prohibited.

## User experience

The default view shows a short explanation, asset selector, Buy/Sell selector, and size input. After valid input, the user sees one comparable row per exchange with estimated receive/proceeds, gross weighted-average price, gross slippage, fee status, data age, liquidity status, and a plain-language explanation of eligibility. Ranking must remain understandable without relying on color.

For a buy, the primary outcome is estimated base asset received for the IDR budget. For a sell, it is estimated IDR proceeds for the base-asset quantity. Gross and fee-adjusted values must not be mixed. The interface should disclose the exact snapshot time and exclusions close to the result rather than hiding them in generic terms.

While data loads, preserve the user's input and identify which sources are pending. If one source fails or becomes stale, retain healthy results, mark the affected source, and recompute eligibility without silently using its last value. If fewer than two venues are eligible, show estimates but no winner. Recovery should occur automatically when valid fresh data returns, with a manual retry available.

The core flow must work with keyboard-only navigation, programmatic labels, announced validation and status changes, visible focus, adequate contrast, and 200% zoom. Mobile layouts must preserve venue identity, units, freshness, and the distinction between gross and net estimates. Purposeful motion must respect reduced-motion preferences.

### Markets list journey

The user opens `/markets`, sees a clear page title and “last traded price” methodology label, then scans or searches the verified union catalog. Each pair row/card keeps the base and quote assets visible and presents Indodax, Reku, and Tokocrypto in a stable order. Each venue cell includes the last price and freshness or a reason-coded state such as loading, stale, unavailable, unsupported, or schema error. The row links to the canonical pair route and is fully operable by keyboard. Mobile may stack venue values, but it must not detach a price from its venue or unit.

The page may retain healthy venue values during a partial-source failure, but must not silently reuse stale values as current. If no venue catalog can be validated, show an explanatory page-level error and retry. If the catalog is valid but contains no active direct-IDR pairs, show an empty state rather than an error. A last-price comparison is informational; it does not declare a best venue because it does not account for spread, depth, size, fees, or execution delay.

### Pair route semantics

- `{pair}` is one canonical, case-insensitive URL segment in `BASE-IDR` form; the canonical rendered URL is lowercase, for example `/markets/btc-idr`. The base asset must satisfy the approved canonical asset identifier and the quote is fixed to direct `IDR` for this release.
- Mixed/upper-case valid forms such as `/markets/BTC-IDR` redirect or replace history to `/markets/btc-idr` without losing query state. Exchange-native symbols (`btcidr`, `btc_idr`), slashes, stablecoin routes, and extra path segments are not accepted as aliases.
- A well-formed pair outside the current verified Markets union catalog shows an unsupported-pair state with a link back to `/markets` and does not substitute a synthetic price. A malformed pair shows the application not-found state. Both outcomes are distinguishable to assistive technology and analytics.
- Direct navigation and browser refresh render the same pair detail without requiring prior navigation through `/markets`.

### Pair-detail journey

The detail header names the canonical pair, supported venues, overall update time, and estimate disclosure. The user can compare pricing, then inspect venue-specific order-book depth and recent public trades without venue identity being lost. Pricing, order-book, and trade capabilities may continue to settle independently inside one aggregate detail snapshot; the selectable chart history has its own bounded period/resolution state so a `1Y` or `All` request cannot block primary pricing. One failed component or chart venue must not blank healthy data. Data timestamps and units remain adjacent to values.

The one shared Highcharts line chart defaults to `1D` and offers `1D`, `1W`, `1Y`, and `All` controls. Eligible venue close series share the same time and absolute-IDR axes, use a persistent legend plus non-color identifiers, and expose aligned absolute OHLC values in a keyboard-accessible equivalent to the pointer tooltip. A venue may start later than another venue and remains comparable wherever both have accepted buckets; leading, middle, and trailing gaps stay visible. The chart states that a line point is a closed-candle close and can differ from the live last-traded price shown in the pricing panel.

The chart must not visually bridge missing buckets. Initial loading uses accessible status text and does not imitate numeric data. Period changes keep the prior successful chart visible, label it with its actual period until replacement data is accepted, and announce progress without moving focus. Empty history, partial venue history, stale data, invalid history, all-sources-unavailable, period-query error, and retry/recovery states have specific copy. A manual retry refetches the currently selected chart period; retrying another aggregate detail component must not reset that period. Auto-refresh does not erase previously loaded healthy sections while replacement data is pending. Reduced-motion preference disables nonessential Highcharts and live-price transitions. Highcharts' accessibility features or an equivalent keyboard-accessible data table must make every rendered timestamp and venue close available without pointer hover.

## Acceptance criteria

- **AC-01 — supported scope:** Given the product is released, when a user opens the exchange coverage disclosure, then it names Indodax, Reku, and Tokocrypto and does not imply coverage of every Indonesian exchange.
- **AC-02 — eligible pair catalog:** Given exchange metadata fixtures, when a direct IDR asset is active on all three exchanges, then it is selectable; when it is unavailable, suspended, non-IDR, or synthetic on any exchange, then it is not presented as a three-exchange comparison.
- **AC-03 — buy calculation:** Given a deterministic ask book and an IDR buy budget spanning multiple levels, when the comparison runs, then filled base quantity, remaining IDR, weighted-average price, and gross slippage match the approved decimal reference result within the exchange's applicable tick/step precision.
- **AC-04 — sell calculation:** Given a deterministic bid book and a base-asset sell quantity spanning multiple levels, when the comparison runs, then gross IDR proceeds, unfilled base quantity, weighted-average price, and gross slippage match the approved decimal reference result within applicable precision.
- **AC-05 — insufficient liquidity:** Given a requested size larger than visible eligible depth, when the comparison runs, then the venue is marked insufficient, the filled and unfilled amounts are shown, and it cannot be ranked as winner.
- **AC-06 — fee transparency:** Given a versioned verified taker fee, when a result is shown, then gross and fee-adjusted estimates, fee source, and as-of date are distinguishable; given an unknown or expired fee assumption, then the UI says fee unverified and declares no net winner involving that venue.
- **AC-07 — freshness:** Given a source crosses the configured stale threshold or violates its update sequence, when the next evaluation occurs, then it is marked stale/gapped, excluded from ranking and alerts, and its old value is not presented as current.
- **AC-08 — partial availability:** Given exactly two healthy comparable venues and one failed venue, when results render, then the two estimates remain comparable, the failure is visible, and any winner is explicitly labeled as based on two of three venues.
- **AC-09 — no comparable winner:** Given fewer than two eligible venues, when results render, then no best-venue claim or alert is produced.
- **AC-10 — schema safety:** Given a response missing a required field, containing invalid numeric data, crossed books, or an unrecognized schema version, when it is normalized, then parsing fails closed for that source, telemetry records the non-sensitive reason, and the malformed value cannot affect ranking.
- **AC-11 — precision:** Given values beyond JavaScript safe integer or binary floating-point precision, when calculations run, then decimal-safe arithmetic preserves the approved fixture result and displayed values follow source tick/step rules without overstating precision.
- **AC-12 — estimate disclosure:** Given any comparison result, then “estimate—not an executable quote” and the exclusions for account-specific fees, tax, transfers, and execution delay are visible before the user follows an exchange link.
- **AC-13 — no credentials or execution:** Given any MVP route and network request, then there is no UI or backend capability to collect exchange API credentials, access private endpoints, place/cancel orders, or initiate deposits/withdrawals.
- **AC-14 — interaction and accessibility:** Given keyboard-only use at mobile width and 200% zoom, when a user selects a pair, enters a valid size, reviews venue states, and follows a venue link, then all steps are operable, labels/units remain available, focus is visible, and important state is not conveyed by color alone.
- **AC-15 — recovery:** Given an upstream source recovers with a valid fresh snapshot after an error, when the health check succeeds, then its estimate becomes eligible without losing the user's inputs and the recovery is announced without requiring a full-page reload.
- **AC-16 — legal/data gate:** Given any exchange lacks documented approval for the intended public commercial display, caching, and derived use, when release readiness is reviewed, then public monetization is blocked for that exchange; the product may proceed only as an internal/non-commercial evaluation approved by the product and legal owners.
- **AC-17 — Markets route and union coverage:** Given verified catalogs where a direct-IDR pair is active on one, two, or three named exchanges, when a user directly opens or refreshes `/markets`, then that pair appears once and its Indodax, Reku, and Tokocrypto cells show either current support or an explicit unsupported state in stable order.
- **AC-18 — last-price semantics:** Given a healthy last-trade/ticker fixture for each supported venue, when `/markets` renders a pair, then each venue's displayed last price, IDR unit, source/receive age, and venue identity match the normalized fixture; the UI labels the metric as last traded price and does not call the lowest value a winner or executable quote.
- **AC-19 — list partial and stale states:** Given one fresh venue, one venue beyond its approved stale threshold, and one unavailable venue, when the market row renders, then the fresh value remains visible, the stale and unavailable venues show distinct text statuses, neither unhealthy value is presented as current, and the row remains navigable.
- **AC-20 — canonical pair routing:** Given `BTC-IDR` is in the verified Markets catalog, when a user navigates to `/markets/BTC-IDR`, then the app canonicalizes the URL to `/markets/btc-idr` and renders BTC-IDR detail; when a user refreshes that canonical URL, the same detail is available without prior client-side navigation.
- **AC-21 — invalid and unsupported pair routing:** Given `/markets/btc-usdt` or `/markets/btc_idr`, when navigation is evaluated, then the malformed/non-IDR route shows not found; given well-formed `/markets/abc-idr` absent from the verified Markets catalog, then an unsupported-pair state and link to `/markets` are shown and no substitute price is requested or displayed.
- **AC-22 — comparative pricing:** Given normalized pricing fixtures, when pair detail renders, then last price, best bid, best ask, spread in IDR and basis points, metric age, and venue are correct for every healthy supported venue. Any unverified 24-hour metric is labeled unavailable and cannot be silently derived from a different window; fewer than two healthy venues produces no comparative claim.
- **AC-23 — order-book comparison:** Given deterministic order books with at least the configured display depth, when the order-book section renders, then bid/ask ordering, price, base quantity, cumulative base quantity, and cumulative IDR notional match decimal reference results per venue; a short, empty, or unsupported book is labeled without fabricating levels.
- **AC-24 — public transaction activity:** Given recent public trade fixtures, when the transaction section renders, then time, price, base quantity, IDR notional, and venue match the approved source ordering policy. Aggressor side appears only for an authoritative source value; otherwise the rendered and accessible value is `Unknown`.
- **AC-25 — single Highcharts close-price comparison:** Given valid aligned OHLC fixtures from at least two venues for the selected period, when the chart renders, then there is exactly one Highcharts line-chart surface with independently identifiable Indodax, Reku, and Tokocrypto series plotting closed-bucket `close` values on the same timestamp and absolute-IDR axes. A persistent legend, shared timestamp inspection, and accessible data equivalent expose each available venue's absolute O/H/L/C; the chart does not normalize, rank, or call any line an executable last price.
- **AC-26 — candle alignment, aggregation, and gaps:** Given source candles with different timezone labels, a missing constituent interval, a conflicting duplicate, and an in-progress candle, when normalization and any coarser aggregation complete, then accepted candles align to the required canonical UTC bucket starts, the open/high/low/close aggregation rule is deterministic, invalid or incomplete target buckets become visible discontinuous gaps, timestamps display in WIB, and no value is interpolated, forward-filled, or connected across a gap.
- **AC-27 — period and resolution contract:** Given a direct visit to pair detail, then `1D` is selected and requests trailing 24-hour history in closed 1-hour buckets. When the user selects `1W`, `1Y`, or `All`, then the request and disclosure respectively use trailing 7-day/4-hour, trailing 365-day/1-day, or earliest-retained/weekly semantics, with weekly buckets beginning Monday 00:00 UTC. No in-progress bucket or unapproved range/resolution is rendered, and `All` states the earliest available date and any retention limitation.
- **AC-28 — aggregate retry with independent component states:** Given pricing is healthy while one venue's order-book or trades component fails, when the aggregate detail snapshot renders, then healthy components and venues remain usable and the failure is identified at component-and-venue level; when the user retries that snapshot, then it is requested once, prior healthy data remains visible while pending, and a later fresh snapshot restores the recovered component without a full-page reload or resetting chart period state. Chart-history failure and retry follow AC-30 independently.
- **AC-29 — responsive and accessible market exploration:** Given keyboard-only use at mobile width and 200% zoom, when a user finds a pair, opens detail, compares all venue prices, navigates book/trade content, chooses each chart period, toggles series, and inspects chart values, then the flow is operable without a pointer, every rendered timestamp/venue close has a programmatic data equivalent, focus is visible, and venue/health/series distinctions do not rely on color alone.
- **AC-30 — chart period loading and race safety:** Given a successful `1D` chart is visible, when the user selects `1Y`, then the `1D` chart remains visible and labeled `1D` while `1Y` loading is announced. If `1Y` succeeds it atomically replaces the prior chart; if it fails, the prior chart remains labeled `1D`, an error and `1Y` retry are available, and no stale response from a subsequently abandoned period can replace the currently selected period.
- **AC-31 — partial history:** Given one venue has complete selected-period history, one has leading or middle gaps, and one returns no valid history, when the chart renders, then complete and partial series remain visible with explicit states, gaps remain discontinuous, the unavailable venue stays named with a reason, and the UI makes no three-venue movement conclusion. With fewer than two venues containing an overlapping valid timestamp, the chart is observational only and shows no comparative language.
- **AC-32 — period and visibility persistence:** Given the user selects a non-default period and hides one venue series, when background pricing/detail refresh occurs, then the period and visible-series choices remain unchanged, at least one venue series remains visible, and recovery or refresh is announced without moving focus.
- **AC-33 — chart semantics disclosure:** Given any chart period is displayed, then adjacent copy identifies the selected period, canonical resolution, timezone, earliest and latest rendered bucket, and the distinction between candle close, live ticker last trade, and executable price. `All` additionally discloses per-venue retention limitations or later listing dates where known.

## Dependencies and constraints

- Public endpoint contracts documented in the repository for Indodax, Reku, and Tokocrypto; upstream behavior can change without notice.
- A canonical symbol and market-rule registry with explicit mappings such as exchange-specific BTC/IDR identifiers.
- Decimal-safe calculations and deterministic normalized fixtures.
- A product-approved definition of freshness per transport/source. Received-at time must not be mislabeled as exchange event time.
- A versioned fee registry backed by approved public sources. Account-specific fees are out of scope.
- Data-rights/terms review for access, storage duration, redistribution, derived calculations, attribution, and monetization for every exchange.
- Security and privacy review confirming that only public market data and minimal analytics are processed.
- The launch gate requires at least 10 healthy, direct-IDR pairs common to all three exchanges. Falling below this threshold triggers scope/release review, not silent synthetic substitution.
- Product language and methodology must be available in clear Indonesian; currency, decimal, and time display use Indonesian conventions while preserving source precision.
- A normalized capability contract is required for per-venue ticker/last trade, order-book snapshot, recent public trades, and historical candles. A venue can be healthy for one capability and unhealthy for another.
- The Markets catalog is the union of verified active direct-IDR pairs across the named venues; the size-aware comparison catalog remains the intersection across all three. Both use the same canonical instrument registry and stable venue ordering.
- Historical candle generation requires approved bucket boundaries, duplicate/conflict policy, data retention, maximum gap, freshness threshold, and backfill limits. Source-native candles may be used only after semantics are contract-tested; otherwise canonical candles must be derived from accepted public trades without inventing missing buckets. The four chart contracts are fixed at `1D`/1-hour, `1W`/4-hour, `1Y`/1-day, and `All`/1-week; unsupported source intervals require deterministic server-side aggregation from complete accepted constituents.
- Route parsing cannot be used directly as an upstream venue symbol. The registry owns the mapping from canonical identity to each venue and market segment.
- Display depth and refresh cadence must respect per-venue rate limits and avoid UI updates so frequent that content becomes inaccessible. Concrete values are owned by the CTO after shadow measurement.
- Chart history needs a bounded period/resolution query contract with server-side allowlisting of the four presets, per-venue capability and retention metadata, cache keys that include canonical pair plus period/resolution, cancellation or stale-response protection, and response limits. Arbitrary client-supplied date ranges or intervals are rejected.
- Highcharts and its React integration must pass dependency, bundle-size, security, accessibility, and commercial-license review. A compatible paid license is a release dependency for any use that is not covered by Highcharts' current terms; library installation alone is not evidence of permission to ship.
- Pricing, order-book, and transaction components may continue to use the aggregate detail snapshot, but chart period selection may use a dedicated bounded history capability so a long-history request does not delay fresh primary pricing. The CTO owns the endpoint boundary and cache design while preserving the product behavior in AC-25 through AC-33.

## Risks and mitigations

| Risk                                                                               | Impact                                       | Likelihood          | Mitigation/owner                                                                                                              |
| ---------------------------------------------------------------------------------- | -------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Public data may not be licensed for commercial redistribution or long-term storage | Public/paid launch blocked or legal exposure | High until reviewed | Obtain exchange-by-exchange written or counsel-approved determination; minimize caching; Product/legal owner                  |
| Stale, unsynchronized, or sequenced-gap data produces a false winner               | User financial harm and loss of trust        | High                | Fail-closed health model, source/receive timestamps, sequence validation where available, no alerts on unhealthy data; CTO/QA |
| Fee schedules differ by user, tier, promotion, tax, or asset                       | Net ranking can be misleading                | High                | Separate gross from fee-adjusted result, version public assumptions, no net winner when unverified; Product                   |
| Thin visible depth or rapid movement makes estimate diverge from actual fill       | Poor decision quality                        | High                | Size-aware depth walk, insufficient-depth state, snapshot age, estimate disclaimer, no execution claim; Product/CTO           |
| Pair identity or decimal normalization is wrong                                    | Material calculation errors                  | Medium              | Explicit registry, metadata validation, decimal arithmetic, golden fixtures and contract tests; CTO/QA                        |
| Three exchanges are perceived as incomplete coverage                               | Weak acquisition or misleading positioning   | Medium              | Name all supported venues, validate demand before expansion, never use “all exchanges”; Product                               |
| Upstream schema/rate-limit changes interrupt service                               | Partial or total comparison outage           | High                | Per-source adapters, backoff, circuit breakers, schema telemetry, partial availability UI; CTO                                |
| Alert noise encourages chasing transient spreads                                   | Churn or harmful behavior                    | Medium              | Persistence threshold, cooldown, freshness gate, explain exclusions; Product/QA                                               |
| Analytics capture sensitive trading intent                                         | Privacy and trust harm                       | Medium              | Minimize/aggregate amount telemetry, avoid identified order-intent logs, define retention and access controls; Product/CTO    |
| Misaligned candle boundaries make venue movement appear different                  | Misleading historical comparison             | High                | Canonical UTC buckets, one common normalization point, deterministic conflict policy, gap visualization, and golden fixtures; CTO/QA |
| “Last price” is mistaken for an executable venue recommendation                    | Poor decision quality                         | High                | Explicit last-trade label, no winner treatment, adjacent age and execution disclaimer, and explanation of size-aware methodology; Product |
| Dense three-venue chart/order-book content becomes inaccessible on mobile           | Core journey unusable                         | Medium              | One chart surface, persistent venue labels, responsive tables/cards, keyboard-accessible data equivalent, accessibility testing; Frontend/QA |
| Historical storage or redistribution is not permitted by a venue                   | Chart scope or external release blocked       | High until reviewed | Per-venue rights decision and bounded retention; disable affected history without hiding current-data status; Product/legal |
| Highcharts is shipped without an applicable commercial license                     | Legal/commercial release blocked               | Medium until reviewed | Record license owner, applicable product/use, renewal process, and approved package version before external release; Product/legal/CTO |
| Long `1Y` or `All` requests exceed upstream limits or slow pair detail              | Timeout, rate limiting, or unusable chart      | High                | Dedicated bounded history query, canonical aggregation/cache, progressive non-blocking state, response limits, and shadow performance evidence; CTO/QA |
| Different venue listing dates or retention are mistaken for equal full history     | Misleading comparison                           | High                | Earliest-available disclosure, per-venue leading gaps and capability metadata, no synthetic backfill, and no three-venue conclusion without overlap; Product/CTO |
| Rapid period selection lets an older response replace the latest selection         | Wrong period displayed under the active label  | Medium              | Request identity/cancellation, atomic label-and-data update, deterministic race tests, and retained prior-chart labeling; Frontend/QA |

## Analytics and release readiness

Minimum product events:

- `comparison_requested`: anonymous/session ID, pair, side, coarse size bucket, and supported venue count; do not log raw identified order intent.
- `comparison_succeeded`: eligible venue count, excluded-source reason codes, winning venue if eligible, and comparison latency.
- `comparison_failed`: normalized non-sensitive failure category by source.
- `exchange_link_opened`: pair, side, venue, and result age.
- `upgrade_interest_submitted` and `usefulness_response` with explicit consent where user identity is collected.
- `markets_viewed`: anonymous/session ID, catalog health summary, pair count, and load latency.
- `market_pair_opened` / `market_pair_viewed`: canonical pair, entry source, supported and healthy capability counts by venue, and primary-data latency.
- `market_snapshot_retried`: canonical pair, component/venue reason-code summary from the failed aggregate, and retry outcome; do not log every automatic poll.
- `market_chart_period_selected`: canonical pair, previous and selected preset, available/partial/unavailable venue counts, request duration bucket, and outcome. Do not log free-form dates because custom ranges are out of scope.
- `market_chart_series_toggled`: canonical pair, selected period, venue, and resulting visible-series count; sampling is allowed and at least one visible series is enforced.

Rollout:

1. Internal shadow ingestion and deterministic fixture verification.
2. Internal dogfood with ranking visible but exchange links disabled until legal/data review.
3. Closed beta for a limited cohort after all release gates pass.
4. Public free beta, then a Pro pricing experiment only after the 30-day evidence review.

Release gates:

- Product and CTO approve the comparison methodology, freshness definition, and exclusions.
- QA records passing evidence for every acceptance criterion across all three source adapters and supported responsive viewports.
- Seven consecutive days of data-health evidence meet the proposed target, with outages and exclusions reported rather than omitted.
- At least 10 active direct-IDR launch pairs remain common to all three exchanges.
- Exchange-by-exchange data-rights, attribution, caching, and commercial-use decisions are documented and approved.
- Security/privacy review confirms there are no private API calls, credential inputs, or execution capabilities.
- Support playbook covers false-price reports, upstream outages, stale data, fee disputes, and takedown requests.
- Direct-load, canonical-route, partial-capability, aggregate retry, four-period chart alignment/aggregation/gap/race, responsive, and accessibility evidence passes AC-17 through AC-33 for the supported browser matrix.
- Historical storage/display rights and retention are approved per venue before that venue's chart is enabled outside internal evaluation; an unavailable chart cannot be represented as zero movement.
- An applicable Highcharts license and dependency approval are documented before any external or commercial deployment; absence of approval permits fixture-backed internal development only.
- Shadow evidence covers the largest approved `All` response and rapid period switching on representative mobile and desktop profiles without delaying primary pricing. Product and CTO approve response-time and payload thresholds before closed beta; until measured, passing functional tests alone does not clear this gate.

Rollback or ranking-disable triggers include a confirmed material miscalculation, stale data ranked as current, repeated sequence/schema corruption, unauthorized data use, or an upstream request to stop. The safe degraded state is to disable ranking/alerts for the affected source, retain transparent health information, and avoid substituting synthetic prices.

## Open questions and decisions

| Item                                                                                                      | Owner            | Due/status                           | Resolution |
| --------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------ | ---------- |
| Are public display, caching, derived calculations, attribution, and paid use permitted for each exchange? | Product/legal    | Blocking before closed external beta | Open       |
| What stale thresholds and minimum visible depth are defensible per exchange/transport?                    | CTO with QA      | Before architecture approval         | Open       |
| Which 10–18 common IDR pairs form the launch catalog based on sustained liquidity, not only availability? | Product with CTO | After seven-day shadow data          | Open       |
| Which public fee source and update process is acceptable for each exchange?                               | Product          | Before fee-adjusted ranking          | Open       |
| Should the first beta rank gross execution only until fee assumptions are validated?                      | Product          | Before beta UX sign-off              | Open       |
| What user segment and frequency threshold define a qualified design partner?                              | Product          | Before recruitment                   | Open       |
| Is shareable snapshot data allowed, and what expiration/retention is permitted?                           | Product/legal    | Before share feature                 | Open       |
| What Indonesian risk/disclaimer copy requires legal review?                                               | Product/legal    | Before external beta                 | Open       |
| Is last price sourced from a venue ticker or the latest accepted public trade when both exist, and how are disagreements resolved? | CTO with Product | Before Markets contract approval | Open; UI semantics remain “last traded price,” with provenance and freshness |
| What display depth, recent-trade count/window, refresh cadence, and stale threshold are safe and useful per capability? | CTO with QA | After shadow measurement | Open; Product requires comparable fields and explicit partial states, not identical upstream limits |
| What per-venue history start, retention, and redistribution rights can support `1Y` and `All`?            | Product/legal with CTO | Blocking before external chart release | Open; `All` must degrade honestly to approved retained history and expose per-venue limitations |
| Does the intended deployment require a paid Highcharts license, and who owns renewal/version compliance? | Product/legal with CTO | Blocking before external deployment | Open; fixture-backed internal development may proceed, but public/commercial release may not assume license eligibility |
| What payload-size and latency thresholds should gate `1Y` and `All` after shadow measurement?             | CTO with QA | Before closed-beta readiness | Open; Product requires non-blocking primary pricing and visible loading/partial states |
| Should selected chart period be URL-persisted and shareable?                                              | Product/design with CTO | Follow-up after four-presets ship | Deferred; session/component persistence is required, URL persistence is not required by AC-27 or AC-32 |
| Should a normalized percentage-return mode and single-venue candlestick mode follow the absolute close-line overlay? | Product/design | Post-comparison usability test | Deferred; not required for this Markets increment |

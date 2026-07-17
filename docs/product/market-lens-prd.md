# Product requirements: Komper Market Lens

## Status and ownership

- Status: Draft
- Product owner: `product_manager`
- Technical owner: `cto`
- Last updated: 2026-07-17
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

### Should/could have

- Preset buy budgets and a shareable comparison that expires or prominently preserves its snapshot time.
- Watchlists and alerts that trigger only after a threshold persists across multiple healthy snapshots.
- Historical spread and estimated-slippage charts with methodology and data gaps shown.
- A Pro packaging experiment for advanced alerts, longer history, export, and higher-frequency views.
- Derived-data API or embeddable widget for design partners after the data-rights and reliability gates pass.
- Additional Indonesian exchanges after demand, API quality, and data rights are validated.

### Non-goals

- Private APIs, user API keys, balances, portfolio reconciliation, order placement, cancellation, smart-order routing, bots, or automated arbitrage.
- Deposit, withdrawal, custody, fiat payment, or movement of user assets.
- Synthetic IDR prices derived from USDT or another quote asset.
- Guaranteed quotes, guaranteed fills, financial advice, profit claims, or a claim of complete Indonesian-market coverage.
- Incorporating transfer time, deposit/withdrawal status, withdrawal fees, account-specific fee tiers, tax circumstances, promotions, rebates, or the user's existing account balances into the MVP ranking.
- Futures, margin, staking, OTC, or non-spot products.

## User experience

The default view shows a short explanation, asset selector, Buy/Sell selector, and size input. After valid input, the user sees one comparable row per exchange with estimated receive/proceeds, gross weighted-average price, gross slippage, fee status, data age, liquidity status, and a plain-language explanation of eligibility. Ranking must remain understandable without relying on color.

For a buy, the primary outcome is estimated base asset received for the IDR budget. For a sell, it is estimated IDR proceeds for the base-asset quantity. Gross and fee-adjusted values must not be mixed. The interface should disclose the exact snapshot time and exclusions close to the result rather than hiding them in generic terms.

While data loads, preserve the user's input and identify which sources are pending. If one source fails or becomes stale, retain healthy results, mark the affected source, and recompute eligibility without silently using its last value. If fewer than two venues are eligible, show estimates but no winner. Recovery should occur automatically when valid fresh data returns, with a manual retry available.

The core flow must work with keyboard-only navigation, programmatic labels, announced validation and status changes, visible focus, adequate contrast, and 200% zoom. Mobile layouts must preserve venue identity, units, freshness, and the distinction between gross and net estimates. Purposeful motion must respect reduced-motion preferences.

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

## Analytics and release readiness

Minimum product events:

- `comparison_requested`: anonymous/session ID, pair, side, coarse size bucket, and supported venue count; do not log raw identified order intent.
- `comparison_succeeded`: eligible venue count, excluded-source reason codes, winning venue if eligible, and comparison latency.
- `comparison_failed`: normalized non-sensitive failure category by source.
- `exchange_link_opened`: pair, side, venue, and result age.
- `upgrade_interest_submitted` and `usefulness_response` with explicit consent where user identity is collected.

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

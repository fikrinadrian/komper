# Quality report: Komper Market Lens

## Release recommendation

**NO-GO for public beta or monetization. Conditional GO for internal, non-commercial evaluation only.**

The baseline build, deterministic suite, black-box API, current live public contracts, and core responsive browser flow are healthy. Final regression closed ML-001 through ML-006; no P0/P1 implementation defect remains open in the tested scope. Public release remains blocked by incomplete freshness/rate-limit architecture, missing shadow-ingestion evidence, and AC-16 because no product/legal approval evidence for commercial public-data use was observed.

## Environment and tested scope

- Date/time: 2026-07-17, Asia/Jakarta
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
| AC-07 | PARTIAL | A 16-second-old controlled snapshot became `STALE` and was excluded. There is no WebSocket sequence/gap state builder, no independently verified live freshness for the observed BTC checks, and upstream REST cache age is not propagated. |
| AC-08 | PASS | WIF fixture retains two healthy venues, exposes schema failure, and labels winner as 2 of 3. |
| AC-09 | PASS | DRX fixture with one eligible venue suppresses winner/ranking. No alert capability exists. |
| AC-10 | PARTIAL | Zod, crossed-book, invalid decimal, and misaligned/unverified rule failures now fail closed with the correct category. Explicit unknown canonical schema-version injection remains untested. |
| AC-11 | PASS | Domain arithmetic, increment lattice, beyond-safe-integer IDR, and 18-digit asset formatting pass without financial `Number` coercion. |
| AC-12 | PASS | Estimate/non-executable disclosure and fee/tax/transfer/execution-delay exclusions appear before venue links. |
| AC-13 | PASS | Source/route inventory and browser traffic found no credential form, private exchange request, or execution route; `/api/order`, `/api/wallet`, and `/api/private` return 404. |
| AC-14 | PARTIAL | Existing mobile keyboard flow, 320 px no-overflow probe, visible focus, text/symbol statuses, and reduced-motion CSS pass. Automated 200% browser zoom, screen-reader announcement, contrast, and axe coverage remain missing. |
| AC-15 | PARTIAL | Browser fail-then-recover retained input and recovered without reload. Adapter reconnect/resync and explicit recovery announcement are not implemented as persistent automated coverage. |
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

- The implementation is REST snapshot-only. It has no capability registry, versioned event envelope, connection epoch, bounded history, WebSocket state builders, sequence-gap recovery, periodic REST verification, or `UNSYNCED` producer described by the architecture.
- Live BTC snapshots were eligible while `freshnessIndependentlyVerified:false`; reported age was BFF receive age, not provable upstream book age. Indodax may serve cached public REST data, and cache provenance is not carried into health.
- `fetchPublicJson` has HTTPS host allowlists, a six-second timeout, redirect rejection, strict JSON parsing, and a two-megabyte limit. It does not implement the architecture's `Retry-After` handling, per-host budgets, circuit breaking, or 429/418/5xx telemetry. A controlled 429 produced one `upstream_http_429` error and discarded `Retry-After`.
- The fixture asserts 18 selectable assets but does not exercise each venue's status, min-notional, price increment, and quantity increment variants.
- The current fee registry is safely unverified. Before enabling net comparison, define expiry, rate bounds, fee asset/side semantics, version governance, and display rounding.
- There is no 72-hour shadow-ingestion report, 30-day reliability evidence, approved SLO, or runbook evidence. No reliability statement should be published.
- Automated cross-browser coverage is Chromium-only. Screen-reader behavior, contrast, 200% browser zoom, and WebKit/Firefox remain unverified.

## Required release actions

1. Preserve the ML-001–ML-006 regressions as mandatory release gates.
2. Treat this implementation as the documented internal REST prototype. Do not label it architecture-complete or freshness-verified; implement the health/sequence/rate-limit gates required for public beta.
3. Add fee-expiry/bounds/asset semantics before any `VERIFIED` registry entry.
4. Run the required 72-hour shadow evaluation and record schema acceptance, pair coverage, source/cache age, gaps, rate limits, and residual risk.
5. Obtain and record product/legal approval for public commercial display, caching, and derived data at each venue. Until then retain the internal evaluation label and do not monetize.

## Final QA decision

The final green commands and original-repro retests demonstrate build integrity and close the observed financial/eligibility defects. QA recommends **GO for internal, non-commercial evaluation** and **NO-GO for public beta, monetization, or reliability claims** until the remaining architecture, 72-hour shadow, and legal/data-rights gates are satisfied.

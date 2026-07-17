# Test strategy: Komper Market Lens

## Status and ownership

- Status: Active for internal evaluation
- QA owner: `senior_qa_engineer`
- Product owner: `product_manager`
- Technical owner: `cto`
- Last updated: 2026-07-17
- Related documents: [Market Lens PRD](../product/market-lens-prd.md), [architecture](../architecture/market-lens-architecture.md), and [ADR-001](../architecture/adr/ADR-001-market-data-ingestion-and-normalization.md)

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

## Frontend test approach

Playwright runs desktop Chromium and Pixel 5 against the production build with fixture data. Critical browser tests cover 3/3 buy, 2/3 partial availability, insufficient depth, and mobile keyboard sell. Targeted release checks additionally use 320 px reflow, reduced motion, horizontal-overflow detection, external-link focus, request inventory, and a simulated fail-then-recover response that must retain user input.

Before public beta, add persistent automated coverage for stale, all unavailable, no winner, fee verified/expired, schema error, empty book, recovery announcement, 200% browser zoom, and an automated accessibility scanner. Web-first assertions and user-facing roles/names are required; arbitrary sleeps and implementation selectors are prohibited.

## API and contract test approach

- Keep fast Vitest/Supertest coverage for validation, deterministic comparisons, and analytics schemas.
- Use Playwright `APIRequestContext` against the built BFF for black-box status, headers, buy/sell, validation, and absence of private routes.
- Mock venue transport at the adapter boundary for 429, 418, 5xx, `Retry-After`, timeout, invalid JSON, oversized body, redirect, and host allowlist cases.
- Store sanitized documented and observed fixtures for each adapter. Contract checks must include missing fields, unexpected fields, numeric strings/numbers, invalid decimal tokens, status flags, and Tokocrypto wrapper variants.
- Schemathesis and Pact are not justified because there is no owned OpenAPI contract or independently deployed consumer/provider pair. k6 is deferred until a load profile and SLO are approved.

## Test data and isolation

Fixture mode is the deterministic release oracle. It contains no user data, credentials, or private endpoints. Live checks use public GET endpoints only and must remain low-rate. Reproduction adapters are created in memory and must not modify product code. No raw order amount is accepted into analytics; emitted analytics use only pair, side, coarse size bucket, venue, and eligible count.

## Quality gates

| Gate | Command/evidence | Required threshold |
| --- | --- | --- |
| Formatting | `npm run format:check` | Zero unformatted files |
| Types | `npm run typecheck` | Zero errors |
| Lint | `npm run lint` | Zero errors/warnings |
| Unit/integration | `npm test` | All deterministic tests pass |
| Build | `npm run build` | Production client and server build |
| Browser | `npm run test:e2e` | All applicable projects pass; skips explained |
| Public contract | Low-rate live catalog plus one buy/sell BTC comparison | Schemas accepted or venue safely quarantined; not an uptime gate |
| Correctness | All AC-02–AC-11 financial/health regression tests | 100% pass; no P0/P1 defects |
| Legal | Venue rights evidence and explicit product/legal decision | Required for public monetization |
| Reliability | 72-hour shadow report; 30-day evidence before reliability claim | Required before beta expansion/claims |

## Defect management and exit criteria

P0 can cause loss, credential exposure, or active harmful execution; P1 can recommend the wrong/ineligible venue or materially misstate a financial value; P2 misleads state/diagnosis or breaks an important secondary path; P3 is minor. Every defect records deterministic repro, observed/expected result, affected AC, and retest evidence. P0/P1 defects cannot receive a QA release exception for public beta.

Internal evaluation may proceed with visible internal labeling, public data only, and no external monetization. Public beta requires all P0/P1 defects closed, every AC observed or explicitly accepted by its owner, legal approval, and the 72-hour shadow evidence. Public reliability claims additionally require the 30-day evidence and an approved SLO.

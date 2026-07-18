# ADR-001: Use capability-based venue adapters with canonical, health-gated market events

- Status: Accepted
- Date: 2026-07-18
- Owners: CTO
- Related PRD/architecture: [Market Lens PRD](../../product/market-lens-prd.md); [Komper Market Lens architecture](../market-lens-architecture.md)

## Context

Market Lens must compare effective order-book prices across Indodax, Reku, and Tokocrypto without implying that their APIs share one protocol or one reliability model.

The supplied collections expose materially different capabilities and schemas. Tokocrypto alone has multiple market segments and hosts: type 1 symbols require symbol transformation and support a documented REST-snapshot plus sequenced-delta workflow, while type 3 uses different REST and WebSocket routes. Its documentation also contains contradictory type and depth-limit descriptions. Reku and Indodax use different symbol, book, timestamp, and stream shapes. Some feeds expose monotonic update identifiers; others expose timestamps or snapshots without a documented sequence contract.

A direct mapping from all venues into one lowest-common-denominator client would hide the information needed to detect gaps and staleness. Passing raw venue payloads to product services would instead spread exchange-specific logic through the system and make schema drift a system-wide risk.

Market Lens initially uses only public data, canonical IDR instruments, and observational estimates. It needs to add or disable a venue, market segment, or capability without changing product contracts or compromising healthy venues.

## Decision drivers

- Preserve venue-specific synchronization and recovery semantics.
- Prevent stale, incomplete, or schema-invalid books from participating in rankings and alerts.
- Support three venues without coupling product code to their raw schemas.
- Represent Tokocrypto routing and capabilities by market segment rather than treating it as one uniform API.
- Retain sequence, time, provenance, and connection metadata needed for audit and diagnosis.
- Use exact decimal arithmetic for price and quantity calculations.
- Limit rate pressure and isolate venue failures.
- Permit incremental delivery and rollback by venue, segment, instrument, or capability.

## Options considered

### Option A: One lowest-common-denominator exchange interface

Each venue implements a single interface such as `getSymbols`, `getOrderBook`, and `subscribeOrderBook`; all results are immediately reduced to common bids and asks.

- Benefits:
  - Small initial interface and straightforward product-service integration.
  - Fast to prototype for a few hand-selected pairs.
- Costs/risks:
  - Hides whether an update is a snapshot or delta and whether continuity can be proven.
  - Cannot accurately represent Tokocrypto segment-specific routing or asymmetric private/public capabilities.
  - Encourages unsupported fallback behavior and venue-wide assumptions.
  - Loses provenance needed to explain staleness and invalidation.

### Option B: Capability-based adapters and versioned canonical events

Model discovery, snapshots, deltas, ticker/trades, account history, execution, and private events as separate capabilities. Register them per venue and market segment. Adapters own wire protocols and emit versioned canonical events carrying sequence, source/receive times, and connection epoch. Independent state builders enforce the synchronization policy for each capability before publishing health-gated book state.

- Benefits:
  - Preserves stronger contracts such as Tokocrypto `lastUpdateId` and `U/u` without requiring unsupported semantics from other venues.
  - Localizes routing, schema drift, throttling, and recovery.
  - Allows product services to consume stable contracts and explicit health states.
  - Supports disabling one segment or capability without removing an entire venue.
  - Creates reusable boundaries for a later portfolio product without bringing credentials into public workers.
- Costs/risks:
  - More components, runtime schemas, and adapter tests.
  - Requires explicit capability and health modeling.
  - Canonical contracts need versioning and migration discipline.

### Option C: Use a third-party unified exchange library as the domain boundary

Use a library such as CCXT to normalize symbols and order books, and let product services consume its unified models.

- Benefits:
  - Broad exchange support and reduced initial protocol code.
  - Familiar unified APIs for common market operations.
- Costs/risks:
  - The repository's Tokocrypto collection identifies CCXT as an authorized SDK provider, but that does not establish completeness for every documented segment or field.
  - Library normalization may omit venue-specific sequence, tax, filter, execution-rule, and health metadata.
  - Upgrade timing and breaking behavior become an external operational dependency.
  - It does not remove the need for runtime validation, freshness policy, and local-book correctness tests.

## Decision

Adopt **Option B: capability-based adapters and versioned canonical events**.

The capability registry is keyed by `venue` and `marketSegment`. A `VenueInstrument` preserves the venue symbol and metadata while mapping to a separate canonical base/quote identity. Tokocrypto type 1 and type 3 are distinct segments with independent routing, subscriptions, health, and rollout controls.

Adapters terminate exchange protocols and validate raw payloads. They emit a versioned `MarketEvent<T>` envelope containing venue, segment, symbol identity, optional source time, required receive/process times, optional sequence or snapshot identifiers, and a connection epoch. Prices and quantities remain decimal strings at the boundary and are converted only through an arbitrary-precision decimal library.

Adapters also normalize trading increments into provenance-bearing rules, not bare numeric fields. A rule records whether its source is a literal step size or a decimal-place count, the original field/value, the exact positive normalized decimal step, metadata version, verification time, and state (`VERIFIED`, explicitly `DISABLED`, or `UNVERIFIED`). Converting a decimal count `n` to `10^-n` is permitted only for fields whose venue-specific contract declares decimal-count semantics. Integer-shape heuristics and cross-venue guessing are prohibited. Zero is treated as disabled only when explicitly documented; ambiguity fails closed.

Order-book state is published only by a state builder appropriate to the documented capability:

- snapshot-plus-delta builders buffer events, establish a REST synchronization point, prove continuity, and invalidate on gaps;
- full-snapshot builders atomically replace state and periodically verify it through REST when necessary;
- feeds without documented delta semantics are never inferred to be deltas.

Freshness and synchronization are first-class state. Query and alert services consume only canonical books with an eligible health status. A connected socket alone never makes a book `LIVE`.

For MVP market estimates, both buy and sell quantities are floored to the venue's verified market quantity step with exact decimal arithmetic. A buy first derives a raw base quantity from its IDR budget, floors the aggregate quantity, and re-walks asks so actual spend cannot exceed the budget. A sell floors its requested base quantity before walking bids so it cannot exceed the request or holdings. Minimum quantity and notional rules are checked after quantization. Existing book prices and active aggregate quantities must already align with their verified increments; the quote engine never rounds venue book data into validity. Weighted average prices are derived analytics and are not tick-quantized.

A venue/instrument with an ambiguous required increment, or a book level that violates a verified increment, receives `UNVERIFIED_RULES` and cannot rank or trigger an alert. Responses disclose the original rule source/value and semantics, normalized step, metadata version, rounding mode, requested amount, executable base quantity, actual consumed quote amount, and quantization remainder. If an IDR sell input is converted to a base target, the shared reference price and its provenance are also returned.

WebSocket is preferred for continuous updates; REST is used for discovery, initial snapshots, recovery, periodic verification, and feeds without a suitable stream. Each adapter implements conservative per-host rate budgets and adjusts behavior using documented response headers and `Retry-After`.

CCXT may be used later as an adapter implementation detail or comparison oracle if tests establish adequate field and behavior coverage. It is not the canonical domain contract or sole correctness boundary.

### Accepted WebSocket amendment (2026-07-18)

The first live release is public spot order books only. The capability assignments are binding:

- Indodax is a Centrifugo-compatible, server-side **full-snapshot** feed with server epoch/offset tracking and same-epoch contiguous offset recovery. Failed or unproven recovery invalidates state and falls back to a clean subscription, fresh snapshot, and REST correlation.
- Reku is a server-side Phoenix Channels **full-snapshot** feed. Each `order:{coinId}` message replaces atomically; reconnect invalidates; no sequence/source time is invented; REST verifies periodically.
- Tokocrypto type 1 uses the documented REST `lastUpdateId` plus exact `U/u` sequence algorithm and gap-triggered bootstrap. Start at the normal depth cadence; `@100ms` needs later load evidence.
- Tokocrypto type 3 remains **REST polling only** until an independently observed and replay-tested WebSocket contract is approved. Type-1 semantics cannot be reused.

Canonical state is a process-local, single-writer `LiveBookStore` of immutable full records carrying local revision, connection epoch, transport, provenance, synchronization, and health. It is non-durable and starts empty after restart. Only synchronized/live records can rank. This constrains the first deployment to one ingestion owner.

The BFF delivers complete comparison replacements with same-origin **SSE**. Coalescing occurs only after canonical books are built. Reconnect recomputes current state; event IDs do not promise durable replay. Existing REST comparison remains bootstrap/rollback. Browsers never connect to exchanges.

## Consequences

Positive consequences:

- Market Lens can compare three venues through stable product contracts while retaining venue-specific correctness evidence.
- Tokocrypto's sequenced book can use its stronger synchronization guarantee without fabricating equivalent guarantees for Reku or Indodax.
- Schema drift or an outage can quarantine one venue segment while other comparisons continue.
- Every estimate can report source/receive time, health, and assumptions.
- Every ranked estimate is aligned to verified venue quantity rules and discloses the adjustment from requested to executable size.
- Additional exchanges can be added by registering verified capabilities instead of expanding conditionals in product services.

Negative consequences and follow-up work:

- The team must implement and maintain runtime schemas, canonical mappings, per-capability state builders, and replay fixtures.
- The product cannot show a three-venue winner when any required book is stale or unsynchronized; availability is intentionally traded for correctness.
- Venue catalog aliases and fee schedules need governed, versioned data rather than ad hoc constants.
- Each adapter needs explicit fixtures for whether Reku, Indodax, and Tokocrypto metadata fields represent literal steps or decimal-place counts; unverified mappings reduce temporary product coverage.
- Historical event volume and retention cost must be measured before long-term storage is enabled.
- Private portfolio and execution adapters require a separate trust boundary and future ADR; they cannot be added to public workers merely because the capability registry can describe them.
- Process-local live state prevents horizontal ingestion replicas until ownership and state distribution are designed.
- Type 3 has explicit lower-cadence `REST_POLL` behavior rather than false WebSocket parity.
- SSE cannot replay intermediate states durably; complete replacement on reconnect makes that acceptable for this read-only product.

Operationally, dashboards and alerts must be labeled by venue and segment. On-call runbooks must distinguish transport connection, schema validity, book synchronization, and product eligibility.

## Migration and rollback

1. Define canonical identity, event envelope, health states, and runtime schemas without changing user-visible behavior.
2. Implement catalog and REST snapshot capabilities for each venue in shadow mode.
3. Add WebSocket capabilities one segment at a time. Start Tokocrypto type 1 only after snapshot/depth-limit behavior is contract-tested; keep type 3 behind a separate flag.
4. Compare normalized shadow results with direct venue snapshots and record freshness, gaps, and rejected schemas.
5. Enable an allowlist of verified IDR instruments for read-only beta.
6. Expand by capability and instrument only after the evidence gate passes.

Feature flags exist at venue, market segment, capability, and instrument level. Rollback disables the failing producer and invalidates its current books. Canonical consumers continue serving remaining eligible venues. A canonical schema rollback requires stopping incompatible producers first and retaining a reader for the previous version until stored events age out or are migrated.

## Validation

- Indodax: handshake/subscription/ping, full replacement, server epoch/offset, contiguous recovery, failure invalidation, and REST-correlated clean recovery.
- Reku: Phoenix join/error/heartbeat, full replacement, coin identity, reconnect invalidation, no fabricated source time, and REST mismatch quarantine.
- Tokocrypto: deterministic type-1 `lastUpdateId`/`U/u` bootstrap and fault replay; configuration rejects any type-3 WebSocket registration.
- Live store: one writer, atomic revisions, old-epoch rejection, health eligibility, shutdown, and empty restart.
- Browser: SSE initial/update/reconnect/backpressure/accessibility behavior and no exchange URL/token exposure.

- Contract tests cover documented and observed response variants for all three venues.
- Canonical identity tests prove that symbol casing, separators, aliases, quote assets, and Tokocrypto segment types cannot collide.
- Decimal property tests demonstrate that calculations do not pass through binary floating point.
- Increment contract tests distinguish literal steps from decimal-place counts and reject integer-shape inference, conflicting metadata, and undocumented zero semantics.
- Buy and sell property tests prove `executableQuantity % normalizedStep == 0`, buy spend does not exceed its budget, sell quantity does not exceed its request, and remainders/provenance are returned.
- Order-book validation tests reject non-aligned active prices and quantities rather than silently rounding them.
- Replay tests inject duplicates, gaps, overlap, reordering, reconnects, and timestamp regression.
- Tokocrypto type 1 tests enforce `lastUpdateId` and `U/u` bootstrap and continuity rules and invalidate immediately on a gap.
- Full-snapshot adapters prove atomic replacement and REST refresh behavior without inventing delta semantics.
- Fault tests cover malformed payloads, unknown fields/types, HTTP 429/418/5XX, `Retry-After`, timeouts, connection expiry, and reconnect storms.
- Health-policy tests prove that stale, unsynchronized, unverified, and unavailable books cannot rank or trigger alerts.
- A minimum 72-hour shadow run reports catalog overlap, schema acceptance, freshness distributions, resynchronization counts, rate-limit behavior, and residual risks before beta.
- Reliability or availability claims require 30 days of observed production-like evidence and explicit SLO approval.

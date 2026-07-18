# ADR-002: Live market data and browser delivery

- Status: Accepted
- Date: 2026-07-18
- Owners: CTO
- Related PRD/architecture: [Market Lens PRD](../../product/market-lens-prd.md); [Komper Market Lens architecture](../market-lens-architecture.md); [ADR-001](./ADR-001-market-data-ingestion-and-normalization.md)

## Context

Market Lens currently fetches one public REST order-book snapshot per venue for every comparison and the browser polls every 15 seconds. The next release needs lower-latency order books without exposing venue protocols to the browser or weakening the existing decimal, schema, increment, freshness, and ranking gates.

The three venue contracts are asymmetric:

- Indodax uses a Centrifugo-compatible protocol. Its order-book publication is a complete book with an offset; subscription state exposes recoverability and a server epoch.
- Reku uses Phoenix Channels. Each `order:{coinId}` message is documented as a complete book without a source sequence or event timestamp.
- Tokocrypto type 1 documents a REST `lastUpdateId` snapshot plus diff-depth events with `U/u` continuity.
- Tokocrypto type 3 uses separate hosts, but the repository does not prove that type-1 WebSocket semantics apply.

The implementation needs one canonical current-state boundary, deterministic failure behavior, and a one-way BFF-to-browser update channel. This phase remains public-data-only and must not collect exchange or user credentials.

## Decision drivers

- Preserve each venue's real synchronization guarantees without inventing parity.
- Prevent stale, gapped, partially applied, or old-connection state from ranking.
- Keep exchange URLs, tokens, protocol frames, and recovery logic server-side.
- Reuse the existing comparison calculation and REST contract during migration and rollback.
- Bound memory, reconnect load, browser update rate, and slow-consumer impact.
- Deliver incrementally with deterministic replay and a 72-hour shadow gate.

## Options considered

### Option A: Keep browser polling public REST comparisons

- Benefits:
  - Lowest implementation complexity and preserves the current deployment.
  - No long-lived server or browser connections.
- Costs/risks:
  - Up to 15 seconds of avoidable product latency.
  - Repeats upstream work per browser and does not create a shared canonical book.
  - Cannot use Tokocrypto's sequence guarantees or distinguish transport continuity well.

### Option B: Connect each browser directly to venue WebSockets

- Benefits:
  - Low server bandwidth and direct updates.
  - Fast prototype for one venue.
- Costs/risks:
  - Exposes venue URLs, Indodax protocol token, schemas, limits, and recovery behavior.
  - Multiplies venue connections per user and makes rate/subscription limits harder to control.
  - Pushes financial normalization and health correctness into untrusted clients.
  - Produces inconsistent behavior across tabs, versions, and devices.

### Option C: Server-side venue WebSockets, canonical in-memory store, and BFF SSE

- Benefits:
  - One controlled venue connection layer and one canonical correctness boundary.
  - Allows protocol-specific snapshot/delta builders and fail-closed health.
  - SSE matches one-way full-result delivery and works with ordinary same-origin HTTP infrastructure.
  - Existing REST API remains a bootstrap and rollback path.
- Costs/risks:
  - Requires connection supervisors, state builders, replay fixtures, and long-lived BFF responses.
  - Process-local state limits the first deployment to one ingestion owner.
  - SSE event replay is not durable, so reconnect must send current full state.

### Option D: Server-side venue WebSockets with Redis or a streaming broker immediately

- Benefits:
  - Supports multiple BFF replicas and durable or distributed consumption.
  - Separates ingestion from delivery processes.
- Costs/risks:
  - Adds ordering, serialization, deployment, cost, and operational failure modes before scale requires them.
  - Does not remove the venue-specific state-builder work.

## Decision

Adopt **Option C**.

### Venue protocol assignments

The release covers public spot order books for the configured direct-IDR allowlist only.

1. **Indodax:** connect server-side to `wss://ws3.indodax.com/ws/`, perform the documented static public-token handshake, subscribe with method `1`, unsubscribe with method `2`, and use method `7` for ping. Treat every order-book publication as a complete snapshot. Track server epoch, publication offset, local connection epoch, and receive time. After disconnect, attempt same-server-epoch recovery from the last accepted offset and accept only contiguous increasing recovered offsets. If recovery is non-recoverable, changes epoch, gaps/regresses, or fails validation, invalidate the book, subscribe cleanly, require a fresh complete snapshot, and correlate with REST before eligibility. Observed order-book offset recovery is a release gate because the repository example is on another channel.

2. **Reku:** connect server-side with Phoenix Channels to `wss://ws.reku.id/socket`, join `order:{coinId}`, correlate join/error refs, maintain heartbeat, and leave removed channels. Treat each `bs` payload as a complete snapshot and atomically replace; never merge. Verify the payload coin ID. Any close, channel error, heartbeat failure, or rejoin creates a new connection epoch and invalidates the old book until a valid new snapshot. Do not invent a source sequence or source time. Periodically correlate with REST and expose `freshnessIndependentlyVerified:false`. Respect 10 connections/IP, 50 channels/connection, and 100 messages/second.

3. **Tokocrypto type 1:** use the documented type-1 diff-depth route with lowercase transformed symbol and the normal `<symbol>@depth` cadence. Buffer events before fetching REST depth. Discard `u <= lastUpdateId`; require the first accepted event to satisfy `U <= lastUpdateId + 1 <= u`; require each later event to satisfy `U == previous.u + 1`. Apply absolute quantities and delete zero levels. A gap, reorder, overflow, invalid frame, symbol mismatch, reconnect, or epoch change invalidates and restarts bootstrap. Handle ping/pong and renew before 24 hours. The `@100ms` stream stays disabled until load and backpressure evidence passes.

4. **Tokocrypto type 3:** use scheduled REST snapshots only and mark transport `REST_POLL`. No type-3 WebSocket is enabled. It remains lower-confidence/`UNVERIFIED` when its cadence or contract cannot satisfy the freshness gate. Enabling its WebSocket requires observed frames, an independent contract and builder, replay evidence, and an ADR amendment; type-1 semantics cannot be reused.

### Canonical live-book store

Use a process-local `LiveBookStore`, keyed by venue, market segment, and venue symbol, with one writer per key. State builders construct and validate complete next state privately, then atomically publish an immutable record containing:

- local monotonic revision and connection epoch;
- transport (`WS_FULL_SNAPSHOT`, `WS_SEQUENCED_DELTA`, or `REST_POLL`);
- optional source time, source sequence/offset, and server epoch;
- required receive/process times;
- synchronization and health state with a bounded reason;
- the complete canonical book only when valid.

Reject old-epoch writes. Readers never observe partially applied deltas. Only `SYNCHRONIZED + LIVE` records may rank or alert. A connected socket does not imply health. `GAPPED`, `RECONNECTING`, or `SYNCHRONIZING` map to public `UNSYNCED`; stale maps to `STALE`; unavailable/stopped maps to `UNAVAILABLE`.

The store is non-durable. Restart starts empty, creates new epochs, and bootstraps again. The first deployment has one ingestion owner; do not add horizontal ingestion replicas until a later decision introduces ownership/leader election and state distribution.

### Health, reconnect, and shutdown

Connection supervisors own protocol handshake, subscription, heartbeat/silence detection, bounded exponential backoff with jitter, and a new epoch per connection. Failure count resets only after protocol readiness and a valid data frame, not merely TCP open. Invalid state fails closed immediately.

Graceful shutdown marks readiness false, rejects new live subscriptions, invalidates live books, unsubscribes/leaves when possible, closes sockets, and terminates. Restart never bridges epochs.

### BFF-to-browser delivery

Expose same-origin SSE at `GET /api/live/comparisons?asset=<asset>&side=<side>&amount=<decimal>` using the existing validation schema.

- Send a full `ComparisonResponse` immediately and full replacement comparison events after relevant book or health revisions.
- Add transport, synchronization, health reason, and a process-local stream revision additively.
- Coalesce only after canonical publication at a configurable UI cadence. Never coalesce exchange deltas before their builder.
- Send comment heartbeats and use `Cache-Control: no-store`; disable proxy buffering where available.
- Treat `Last-Event-ID` as advisory. Reconnect recomputes and sends current full state; no durable replay is promised.
- Keep one replaceable pending result per client; disconnect slow consumers instead of building an unbounded queue.
- Preserve user input and update the TanStack Query cache. Retain `/api/comparisons` for initial load and feature-flag rollback. A REST fallback cannot make an unhealthy live book eligible.

The browser must never connect to venue WebSockets or receive exchange protocol tokens. The Indodax static public token is server configuration and is redacted from logs.

## Consequences

Positive:

- Venue correctness is centralized and observable.
- Indodax/Reku full snapshots and Tokocrypto type-1 deltas use appropriate independent builders.
- Browser delivery is low-latency without creating venue connection fan-out.
- REST compatibility provides a reversible rollout.

Negative and follow-up:

- One ingestion owner is an explicit availability/scaling limit.
- Type 3 cannot claim WebSocket parity and may be excluded by health.
- SSE cannot replay intermediate states durably; full replacement on reconnect is therefore mandatory.
- Operators need per-protocol metrics and runbooks for reconnect, recovery, gap loops, slow consumers, and shutdown.

## Migration and rollback

1. Add clocks/schedulers, connection epochs, the store, health state machine, and replay harness while REST remains user-visible.
2. Add Indodax and Reku workers in shadow mode.
3. Add Tokocrypto type-1 builder in shadow mode; retain type 3 REST polling.
4. Add SSE and client cache replacement behind venue/pair feature flags.
5. Complete deterministic gates and the 72-hour shadow run, then enable one pair at a time.

Rollback disables the affected pair/capability, invalidates its store record, closes its subscription, and returns the UI to explicitly labeled REST behavior. Rollback never preserves an old live book as current.

## Validation

- Indodax: handshake, subscribe/ping, atomic full replacement, epoch/offset, duplicate/regression, contiguous recovery, and clean fallback.
- Reku: Phoenix join/leave/error/heartbeat, coin identity, full replacement, reconnect invalidation, receive-time disclosure, and REST mismatch quarantine.
- Tokocrypto type 1: snapshot race, stale/overlap/duplicate/gap/reorder `U/u`, zero deletion, overflow, reconnect, ping/pong, and scheduled renewal.
- Tokocrypto type 3: configuration proves no WebSocket or type-1 builder can register.
- Store: single writer, atomic revision, old-epoch rejection, health mapping, shutdown invalidation, and empty restart.
- SSE/browser: initial/update/reconnect, bounded coalescing/backpressure, partial availability, stale/gap removal, preserved input/focus, accessibility, and no exchange URLs/tokens.
- Release: all deterministic tests pass, zero unhealthy books rank, no open P0/P1, and the QA 72-hour shadow evidence is accepted.

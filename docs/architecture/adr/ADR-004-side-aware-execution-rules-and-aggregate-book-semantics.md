# ADR-004: Separate side-aware execution rules from aggregate book semantics

- Status: Accepted for internal evaluation
- Date: 2026-07-19
- Owners: CTO
- Related PRD/architecture: [Market Lens PRD](../../product/market-lens-prd.md); [Komper Market Lens architecture](../market-lens-architecture.md); [ADR-001](ADR-001-market-data-ingestion-and-normalization.md)

## Context

ADR-001 assumed one base-quantity increment could both quantize buy/sell estimates and validate every aggregate order-book quantity. Reku disproves that assumption. Its public book tuple is `[IDR total, price, coin total]`; live aggregate coin totals are derived from notional and price and therefore need not align to an order-entry lattice. Reku's `volume_decimals=0` describes displayed market volume, not a one-coin order step.

The official Reku advanced-trade client captured on 2026-07-19 accepts whole-IDR buy input, base sell input with eight decimal places, floors buy outcome estimates to eight decimal places, and derives price movement from `digits`. The reviewed bundle is `pages/trade/[symbol]-734b58cded9e0058.js`, SHA-256 `f70980ea71240a3c9abeb080fb8707fd065714a24b8986a73fc04094634a943b`. This is operational client evidence, not a documented matching-engine guarantee.

## Decision drivers

- Do not exclude valid aggregate liquidity by applying an unrelated order-entry rule.
- Keep input denomination and rounding explicit for each side.
- Preserve fail-closed price, schema, freshness, synchronization, and rule validation.
- Avoid presenting inferred blockchain precision as an executable lot-size contract.

## Options considered

### Option A: Map `volume_decimals` or `/v2/coins.decimals` to one quantity step

- Benefits: Small adapter-only change.
- Costs/risks: `volume_decimals=0` conflicts with live books; `coins.decimals` follows asset/network precision and is not an order-step contract; buy input is IDR rather than base quantity.

### Option B: Separate execution input/output rules from book quantity semantics

- Benefits: Matches side and denomination behavior, retains aggregate liquidity, and keeps provenance visible.
- Costs/risks: Adds contract fields and venue-specific policy; official-client evidence must be reviewed when the bundle changes and does not guarantee backend acceptance.

## Decision

Choose Option B and partially supersede ADR-001's single-quantity-step assumption.

- Books declare whether level quantities are executable-step aligned or derived from notional. Derived Reku levels skip only the quantity-modulo check; price alignment and all structural checks remain mandatory.
- Reku buy input uses a versioned whole-IDR rule and walks the IDR budget directly. It is not re-walked as a fabricated base-order input.
- Reku buy outcome is conservatively floored to eight decimals using the observed official-client rule. Average price and slippage are recalculated from consumed IDR and the conservative outcome.
- Reku sell input is floored to eight base-asset decimals before walking bids.
- The response exposes the applicable input rule/denomination separately from the output/base quantity rule.
- These Reku rules carry `OFFICIAL_WEB_CLIENT_OBSERVED` evidence, source URL, capture date, bundle version, and content hash.

## Consequences

Reku can participate in internal gross comparisons without false `UNVERIFIED_RULES` exclusions caused by aggregate quantities. Existing venues retain the original strict quantity-alignment default. Public claims of guaranteed executability remain prohibited until Reku confirms the API semantics or authenticated non-destructive boundary testing validates them across representative assets and minimum-order cases.

## Migration and rollback

The new canonical book and response fields are additive. Removing the Reku observed rule registry entry or marking it unverified restores fail-closed exclusion without affecting other venues. A changed official-client bundle requires rule review before its semantics replace the recorded version.

## Validation

- Adapter tests verify `volume_decimals=0` is not used as an order step and assert provenance for the reviewed client rules.
- Domain tests accept derived fractional aggregate quantities while continuing to reject price misalignment and default venue quantity misalignment.
- Comparison tests cover quote-denominated Reku buys and eight-decimal Reku sells.
- A point-in-time live BTC buy/sell smoke must return Reku `ELIGIBLE` with all three venues eligible.

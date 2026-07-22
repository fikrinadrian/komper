# ADR-005: Use semantic tokens and shared primitives for the cyberpunk presentation

- Status: Accepted for implementation
- Date: 2026-07-21
- Owners: CTO, Frontend engineering
- Related PRD/architecture: [Market Lens PRD](../../product/market-lens-prd.md); [Komper Market Lens architecture](../market-lens-architecture.md); [Market Lens design system](../../../design-system/market-lens/MASTER.md)

## Context

Market Lens has four browser route states: the comparison landing page, markets overview, market detail, and not found. They currently share a light Tailwind palette, but presentation decisions are repeated as concrete utility colors and Highcharts literals across route and component files. The approved direction is to rework every page into a dark, data-dense cyberpunk visual language while preserving the product's financial semantics, disclosures, accessibility, and existing API/query/route contracts.

The design direction introduces dark surfaces, restrained cyan primary and magenta secondary accents, technical display typography, grid/scanline texture, glow, and purposeful motion. Exact color values remain subject to contrast and design approval. Applied independently per page, these effects can create contrast failures, inconsistent states, animation jank, and a second source of truth for chart colors. A runtime theme system or animation framework would add complexity even though this scope ships one visual mode and requires no user-selectable theme.

## Decision drivers

- Apply one coherent theme across every current route and state without duplicating styling decisions.
- Keep price, venue, freshness, eligibility, warning, and comparison meaning readable without relying on color alone.
- Preserve keyboard, screen-reader, zoom, touch-target, reduced-motion, chart-table, and responsive behavior.
- Avoid changes to market-data contracts, routing, server boundaries, or persisted data.
- Keep the change incremental, measurable, and easy to roll back.
- Avoid new runtime or third-party asset dependencies unless an observed interaction requirement justifies them.

## Options considered

### Option A: Restyle each page with concrete Tailwind utilities

- Benefits: Fast local edits and no new abstraction.
- Costs/risks: Repeats palette and state decisions, makes Highcharts diverge, produces inconsistent loading/error/focus states, and makes rollback or later palette adjustment expensive.

### Option B: Semantic CSS tokens, Tailwind aliases, and shared React primitives

- Benefits: One source for theme roles, consistent route states, direct CSS-first implementation, explicit Highcharts adaptation, no runtime theme engine, and a small rollback surface.
- Costs/risks: Requires an ordered migration and discipline around token/component boundaries; chart code still needs explicit values because it cannot rely on CSS inheritance alone.

### Option C: Add a runtime theme/component system and animation framework

- Benefits: Built-in theme switching and richer choreography.
- Costs/risks: Solves unrequested multi-theme and transition problems, increases bundle/maintenance cost, can conflict with existing Tailwind styles, and expands accessibility and reduced-motion review.

## Decision

Choose Option B.

- CSS custom properties are the runtime source of truth for primitive and semantic presentation values. Tailwind configuration exposes semantic names; route components consume semantic/component styles rather than palette literals.
- Shared React/CSS primitives own the page frame, navigation, panels, actions, fields, status badges, tables, disclosures, and focus/state behavior. This is a local presentation layer, not a new general-purpose component framework.
- The shipped cyberpunk appearance is one dark mode with `color-scheme: dark`. Token indirection exists for consistency and rollback; this decision does not add a user theme preference, persistence, or hydration logic.
- Orbitron is restricted to display headings and short labels. Readable sans-serif remains the prose face; JetBrains Mono is reserved for numeric data and compact technical labels, with fallbacks and tabular numerals. Mobile body text is at least 16 CSS pixels with 1.5 line height. Fonts are self-hosted with `font-display: swap`/`optional`, or the app uses local fallbacks; no remote font origin is added.
- Cyberpunk texture and glow are bounded, non-interactive decorative layers. They cannot obscure text, focus, chart marks, or status. Structural controls use consistent SVG icons rather than emoji or decorative glyphs.
- Motion is CSS-first, uses shared 150-300 ms tokens, and is limited to purposeful `transform`/`opacity` transitions where practical. Reduced motion disables nonessential animation and smooth scrolling. Continuous effects, layout animation, and GSAP-style route overlays are excluded. A later animation library requires a separate measured justification, not a new ADR unless it changes this boundary.
- Highcharts maps semantic tokens into explicit background, label, axis, grid, tooltip, focus, and series options at the chart boundary. Chart animation remains disabled. Series identity uses labels plus a non-color distinction, and the semantic OHLC table remains available.
- Existing route identity, navigation destinations, query keys, labels, disclosures, focus behavior, and loading/empty/error/partial/success semantics are compatibility constraints. Presentation code must not select, suppress, or reinterpret market data.
- WCAG 2.2 AA is a release gate: 4.5:1 normal text, 3:1 large text and essential UI graphics, visible focus, color-independent meaning, semantic roles/states, 44-by-44 CSS-pixel targets with at least 8 CSS pixels between adjacent targets where practical, 200% text zoom, reduced motion, and no document-level horizontal overflow at supported widths.

## Consequences

All browser routes gain a consistent, reversible visual contract without changing server or shared-domain interfaces. Review becomes simpler because palette, motion, and state decisions have explicit owners. Highcharts needs a small adapter instead of inheriting route styles. Some current page-level utility classes and chart literals must be replaced, but the migration does not justify a theme provider, global React context, GSAP, or a new component package.

The design-system master remains a visual input; this ADR and the architecture document are authoritative for technical, performance, security, and accessibility constraints. If a visual recommendation conflicts with these constraints, the technical constraint wins until the owners record a reviewed change.

## Migration and rollback

1. Define and contrast-check primitive/semantic tokens, typography, focus, state, motion, and chart roles without changing component behavior.
2. Migrate shared page frame/navigation/footer and reusable controls, then the landing, markets overview, market detail, and not-found states.
3. Map Highcharts through the semantic theme boundary and remove superseded light-theme literals only after chart accessibility and no-data/error states pass.
4. Remove obsolete concrete aliases after repository search confirms no active consumer; keep the migration in frontend-only commits with no contract or data change.

Rollback restores the prior token map and component styling or reverts the presentation commits. No database migration, server deployment coupling, API compatibility window, or cache invalidation is required. A feature flag is not warranted for this internal presentation-only change; add one only if staged audience rollout becomes a product requirement.

## Validation

- Run format, type-check, lint, unit, Playwright, and production-build gates for the affected frontend.
- Exercise all routes and loading, empty, error, partial, and success states at 320, 375, 768, 1024, and 1440 CSS pixels, landscape mobile, plus 200% text zoom.
- Verify keyboard-only navigation, visible focus, screen-reader names/status, 44-by-44 targets, reduced motion, browser zoom, and absence of document-level horizontal overflow.
- Automate or record contrast evidence for semantic foreground/background, focus, state, chart, and disabled pairs; verify status and series meaning in grayscale or color-vision simulation.
- Confirm the Highcharts Accessibility module and OHLC table remain available, chart animation remains off, and series are identifiable without color alone.
- Compare production bundle/chunk output with the pre-theme baseline and verify no runtime theme engine, route-animation framework, or external font/asset origin was introduced.
- Search active route components for raw theme color literals and page-local duration/easing values; documented chart-boundary conversion is the only permitted explicit color mapping.

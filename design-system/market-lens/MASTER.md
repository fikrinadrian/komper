# Design System Master File

> **LOGIC:** When building a specific page, first check
> `design-system/market-lens/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Market Lens
**Generated:** 2026-07-21 21:43:26
**Category:** Fintech/Crypto
**Design Dials:** Variance 8/10 (Bold / Asymmetric) | Motion 6/10 (Standard) | Density 7/10 (Standard)

---

## Accepted Project Override

The generated recommendations below are retained as design-search provenance. The reviewed Market
Lens PRD and ADR-005 override conflicting recommendations with this implemented contract:

- Deep-navy canvas/surfaces (`#050812`, `#0B1224`, `#13213D`) with off-white foreground
  (`#F2F8FF`) and muted text (`#A6BCD3`).
- Cyan primary/focus (`#22D3EE`, `#67E8F9`), restrained magenta accent (`#F472B6`), and amber
  reserved for warnings (`#FBBF24`).
- Orbitron for short display headings, readable system sans-serif for prose, and JetBrains Mono for
  numeric/technical data. Orbitron and JetBrains Mono are bundled through `@fontsource`; no runtime
  Google Fonts origin is used.
- Market-comparison/data-dashboard information architecture, not the generated newsletter pattern.
- CSS-first 160-220ms interaction motion with reduced-motion support; no GSAP route overlay.
- Stable HUD panels, static grid/scanline texture, SVG structural icons, 44px controls, and semantic
  tokens shared by every route and Highcharts.

This override is the active source of truth; exact runtime values live in `src/client/styles.css`.

---

## Global Rules

### Color Palette

| Role        | Hex       | CSS Variable          |
| ----------- | --------- | --------------------- |
| Primary     | `#F59E0B` | `--color-primary`     |
| On Primary  | `#0F172A` | `--color-on-primary`  |
| Secondary   | `#FBBF24` | `--color-secondary`   |
| Accent/CTA  | `#8B5CF6` | `--color-accent`      |
| Background  | `#0F172A` | `--color-background`  |
| Foreground  | `#F8FAFC` | `--color-foreground`  |
| Muted       | `#272F42` | `--color-muted`       |
| Border      | `#334155` | `--color-border`      |
| Destructive | `#EF4444` | `--color-destructive` |
| Ring        | `#F59E0B` | `--color-ring`        |

**Color Notes:** Gold trust + purple tech

### Typography

- **Heading Font:** Orbitron
- **Body Font:** JetBrains Mono
- **Mood:** cyberpunk, neon, glitch, hud, sci-fi, dark, matrix green, magenta, chamfered, tactical
- **Google Fonts:** [Orbitron + JetBrains Mono](https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Orbitron:wght@700;900&display=swap)

**CSS Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Orbitron:wght@700;900&display=swap');
```

### Spacing Variables

_Density: 7/10 — Standard_

| Token         | Value             | Usage                     |
| ------------- | ----------------- | ------------------------- |
| `--space-xs`  | `4px` / `0.25rem` | Tight gaps                |
| `--space-sm`  | `8px` / `0.5rem`  | Icon gaps, inline spacing |
| `--space-md`  | `16px` / `1rem`   | Standard padding          |
| `--space-lg`  | `24px` / `1.5rem` | Section padding           |
| `--space-xl`  | `32px` / `2rem`   | Large gaps                |
| `--space-2xl` | `48px` / `3rem`   | Section margins           |
| `--space-3xl` | `64px` / `4rem`   | Hero padding              |

### Shadow Depths

| Level         | Value                          | Usage                       |
| ------------- | ------------------------------ | --------------------------- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`   | Subtle lift                 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)`    | Cards, buttons              |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)`  | Modals, dropdowns           |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #8b5cf6;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #f59e0b;
  border: 2px solid #f59e0b;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0f172a;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #f59e0b;
  outline: none;
  box-shadow: 0 0 0 3px #f59e0b20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Bento Grids

**Keywords:** Apple-style, modular, cards, organized, clean, hierarchy, grid, rounded, soft

**Best For:** Product features, dashboards, personal sites, marketing summaries, galleries

**Key Effects:** Hover scale (1.02), soft shadow expansion, smooth layout shifts, content reveal

### Page Pattern

**Pattern Name:** Newsletter / Content First

- **Conversion Strategy:** Single field form (Email only). Show 'Join X, 000 readers'. Read sample link.
- **CTA Placement:** Hero inline form + Sticky header form
- **Section Order:** 1. Hero (Value Prop + Form), 2. Recent Issues/Archives, 3. Social Proof (Subscriber count), 4. About Author

---

## Motion

**Page Transition** (Standard) — Trigger: route change | Duration: 400-600ms | Easing: `power2.inOut`

```js
const tl = gsap.timeline();
tl.to('.transition-overlay', { yPercent: 0, duration: 0.4, ease: 'power2.inOut' })
  .call(navigate)
  .to('.transition-overlay', { yPercent: -100, duration: 0.4, ease: 'power2.inOut', delay: 0.1 });
```

**Framework notes:** Keep the overlay element mounted at the layout root (outside the page component) so it survives the route swap

- ✅ Show a lightweight loading indicator if the destination route's data fetch outlasts the overlay
- ❌ Don't tie the overlay's reveal directly to data-fetch completion without a max-wait timeout; a slow API stalls the whole transition
- ⚡ Prefer CSS transform (yPercent) over top/left to keep the overlay animation on the compositor thread

---

## Anti-Patterns (Do NOT Use)

- ❌ Playful design
- ❌ Unclear fees
- ❌ AI purple/pink gradients

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

# GigBPM — Logo Design Specification

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

The GigBPM logo replaces the plain text title at the top of the default (performance) screen. It is a single-color SVG mark using `currentColor`, designed for a dark stage UI.

---

## The Mark

**Concept:** Syncopated beat bars — five filled vertical bars with asymmetric heights reflecting a 2-and-4 accent pattern (bars 2 and 4 are the tallest, like a jazz snare hit). Reads as a captured waveform moment rather than a static EQ icon.

**File:** `src/assets/logo.svg`  
**ViewBox:** `0 0 32 32`  
**Color:** `currentColor` — inherits from the parent element's CSS `color` property  
**Recommended display size:** 32–40px tall in the app header

---

## Usage in Svelte

### Option A — Inline SVG (recommended)

Renders as a DOM element. Inherits `color` from CSS, so it responds to theme changes without extra work.

```svelte
<script>
  import logo from '$lib/assets/logo.svg?raw';
</script>

<header>
  <span class="logo" aria-label="GigBPM">{@html logo}</span>
</header>

<style>
  .logo {
    display: flex;
    align-items: center;
    color: white;
  }

  .logo :global(svg) {
    height: 36px;
    width: auto;
  }
</style>
```

### Option B — `<img>` tag

Simpler but the SVG cannot inherit `color` from CSS. Only use this if the logo is always white and never needs to change.

```svelte
<img src="/assets/logo.svg" alt="GigBPM" style="height: 36px;" />
```

---

## Vite path alias

If using Option A, ensure `$lib` is aliased in `vite.config.ts` (default in SvelteKit). For a plain Vite + Svelte project, import via relative path:

```svelte
import logo from '../assets/logo.svg?raw';
```

The `?raw` suffix tells Vite to return the SVG file as a plain string rather than a URL.

---

## Accessibility

Always pair the logo with an accessible label. Since the SVG has no embedded `<title>`, provide one on the wrapper:

```svelte
<!-- Inline SVG -->
<span role="img" aria-label="GigBPM">{@html logo}</span>

<!-- img tag -->
<img src="/assets/logo.svg" alt="GigBPM" />
```

---

## Color

The mark uses `currentColor` throughout (`fill="currentColor"`). Set the color on the wrapper:

| Context | CSS |
|---|---|
| Stage UI (dark background) | `color: #ffffff` |
| Light background (e.g. splash screen) | `color: #000000` or brand color |

---

## Design Files

Exploration variants are in `logo-design/` at the project root (not shipped). The approved file is `src/assets/logo.svg`.

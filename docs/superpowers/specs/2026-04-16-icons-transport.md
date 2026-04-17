# GigBPM — Transport Control Icons

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

Four solid filled SVG icons for the transport controls on the performance screen. All icons use `currentColor`, are 24×24 viewBox, and have no stroke — consistent with a solid/filled icon style.

---

## Files

| File | Control | Shape |
|---|---|---|
| `src/assets/icon-play.svg` | Play | Right-pointing filled triangle |
| `src/assets/icon-pause.svg` | Pause | Two filled vertical bars |
| `src/assets/icon-next.svg` | Next song | Filled triangle + bar on right (skip forward) |
| `src/assets/icon-prev.svg` | Previous song | Bar + filled triangle on left (skip back) |

---

## Usage in Svelte

Import each icon as a raw string using Vite's `?raw` suffix, then render inline with `{@html}`.

```svelte
<script>
  import iconPlay  from '$lib/assets/icon-play.svg?raw';
  import iconPause from '$lib/assets/icon-pause.svg?raw';
  import iconNext  from '$lib/assets/icon-next.svg?raw';
  import iconPrev  from '$lib/assets/icon-prev.svg?raw';
</script>

<div class="transport">
  <button aria-label="Previous song">{@html iconPrev}</button>
  <button aria-label="Play">{@html iconPlay}</button>
  <button aria-label="Pause">{@html iconPause}</button>
  <button aria-label="Next song">{@html iconNext}</button>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: white;
  }

  .transport button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    line-height: 0;
  }

  .transport button :global(svg) {
    width: 28px;
    height: 28px;
  }
</style>
```

### Toggling play/pause

Show one or the other based on metronome state — do not show both simultaneously:

```svelte
<button aria-label={isPlaying ? 'Pause' : 'Play'} on:click={togglePlay}>
  {@html isPlaying ? iconPause : iconPlay}
</button>
```

---

## Sizing

Icons are 24×24 viewBox. Set the display size via CSS on the wrapping element — the SVG scales to fill it. Recommended sizes for the performance screen:

| Context | CSS |
|---|---|
| Standard button | `width: 28px; height: 28px` |
| Primary action (play/pause) | `width: 36px; height: 36px` |
| Secondary actions (next/prev) | `width: 24px; height: 24px` |

---

## Color

Icons inherit `color` from their parent. On the dark stage UI:

```css
color: #ffffff;          /* active / enabled */
color: rgba(255,255,255,0.3);  /* disabled */
```

---

## Accessibility

Always provide an `aria-label` on the `<button>`. The SVG has no embedded title.

```svelte
<button aria-label="Next song">{@html iconNext}</button>
```

If the icon is inside a button that already has visible text, add `aria-hidden="true"` on the SVG to avoid duplicate announcements. Since these are icon-only buttons, `aria-label` on the button is sufficient.

---

## Vite path alias

With SvelteKit, `$lib` maps to `src/lib/`. For a plain Vite + Svelte project without that alias, use a relative path:

```svelte
import iconPlay from '../assets/icon-play.svg?raw';
```

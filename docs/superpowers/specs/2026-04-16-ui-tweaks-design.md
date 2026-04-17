# UI Tweaks — Design Spec

**Date:** 2026-04-16

## Context

Four targeted fixes identified during mobile testing:
1. Bottom action buttons scroll off-screen behind browser navigation bars on iPhone/Android.
2. Undo-delete toast appears but tapping it does nothing.
3. Performance screen: BPM ring sits too low; needs to shift up.
4. Performance screen: Next button is too small for reliable stage use.

---

## 1. Bottom Button Visibility

**Problem:** `body` uses `min-height: 100vh`, which on mobile browsers is the full viewport including the browser toolbar area. When a toolbar is visible, content is clipped and the bottom action buttons scroll below the visible area. Additionally, no screen uses `env(safe-area-inset-bottom)` for iPhone home-indicator padding.

**Fix:** Two-part change.

**`src/app.css`**
- Change `body { min-height: 100vh }` → `min-height: 100dvh` (`dvh` = dynamic viewport height, accounts for browser toolbar).

**Bottom-actions padding** (three files — replace existing `padding` shorthand):

- `PerformanceScreen.svelte` `.screen`: replace `padding: 24px 20px 36px` → `padding: 24px 20px calc(36px + env(safe-area-inset-bottom, 0px))`
- `SetlistEditor.svelte` `.bottom-actions`: replace `padding: 16px` → `padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px))`
- `SetlistList.svelte` `.bottom-actions`: same replacement as SetlistEditor

---

## 2. Undo Delete Bug

**Problem:** `Toast.svelte` uses `{onclick}` shorthand on the button: `<button {onclick}>`. This passes the `onclick` prop directly as the DOM event attribute. When `onclick` is `undefined` (no undo available), the button has no click handler. While this case is guarded by `{#if show}` mounting the component fresh, the pattern is fragile — if `onclick` is ever `undefined` at tap time (e.g., a timing edge case where `undoSong` has already been cleared by the 3-second auto-dismiss timer), the tap silently does nothing.

**Fix:** `Toast.svelte` — replace `{onclick}` with an arrow-function wrapper that safely handles the `undefined` case:

```svelte
<!-- before -->
<button class="toast" class:clickable={!!onclick} {onclick}>

<!-- after -->
<button class="toast" class:clickable={!!onclick} onclick={() => onclick?.()}>
```

No other changes to Toast or SetlistEditor.

---

## 3 & 4. Performance Screen Layout Redesign

**Goal:** Move PREV/PAUSE above the BPM ring so NEXT stands alone at the bottom as a large, easy-to-hit target. Shrink the ring slightly to create breathing room.

### New layout order (top → bottom inside `.screen` flex column)

```
.top-row               (TTS toggle + exit — unchanged)
.song-info             (position counter + song name — unchanged)
.secondary-controls    (PREV + PAUSE, horizontal row — moved above ring)
.bpm-ring              (10% smaller)
.next-btn              (25% larger, standalone)
```

The existing `justify-content: space-between` on `.screen` distributes five children evenly — no additional spacing changes needed.

### Song info

No changes — the existing styles are already correct:
- `.position`: `font-size: 11px`, `letter-spacing: 2px`, `text-transform: uppercase`
- `.song-name`: `font-size: 22px`, `font-weight: 700`

These are confirmed as-is for the spec record.

### BPM ring

Update the existing `width` and `height` properties from `min(72vw, 280px)` → `min(72vw, 252px)`, and update `max-width`/`max-height` from `280px` → `252px`. (−10%)

All other styles (border, glow, transition, background) unchanged.

### Secondary controls (PREV + PAUSE)

Rename the existing `.controls` div in markup to `.secondary-controls`. Remove NEXT button from this div. Update CSS:

```css
/* rename .controls → .secondary-controls, remove old .controls block entirely */
.secondary-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}
```

The old `.controls { display: flex; align-items: center; gap: 24px }` CSS block must be deleted.

Button sizes unchanged:
- `.prev-btn`: 48 × 48px
- `.pause-btn`: 64 × 64px

### Next button

Update the existing `.next-btn` size from `96px` → `120px` (width and height). (+25%)

Extract `<button class="next-btn">` from the controls div; render it as a direct child of `.screen`, after `.bpm-ring`.

All other styles (color, glow, label) unchanged.

### Updated markup structure (PerformanceScreen.svelte)

```svelte
<div class="screen">
  <div class="top-row">...</div>
  <div class="song-info">...</div>
  <div class="secondary-controls">
    <button class="prev-btn">...</button>
    <button class="pause-btn">...</button>
  </div>
  <div class="bpm-ring" ...>...</div>
  <button class="next-btn" ...>...</button>
</div>
```

---

## Files to Modify

| File | Change |
|---|---|
| `src/app.css` | `min-height: 100dvh` on body |
| `src/components/Toast.svelte` | Arrow-function onclick wrapper |
| `src/components/PerformanceScreen.svelte` | Layout restructure + size changes + safe-area padding |
| `src/components/SetlistEditor.svelte` | Safe-area bottom padding on `.bottom-actions` |
| `src/components/SetlistList.svelte` | Safe-area bottom padding on `.bottom-actions` |

---

## Verification

1. **Bottom buttons** — open the app on an iPhone with Safari toolbar visible. Confirm "Add Song", import/export buttons, and the NEXT button are all fully visible without scrolling.
2. **Undo delete** — delete a song in SetlistEditor; tap the toast within 3 seconds. Confirm the song reappears. Also wait for the toast to auto-dismiss, then confirm no errors.
3. **Performance layout** — enter performance mode. Confirm visual order top→bottom: song name, PREV/PAUSE row, BPM ring, NEXT. Confirm NEXT is larger than PREV/PAUSE and sits at the bottom of the screen.
4. **Ring size** — confirm the BPM ring is visibly smaller than before and the layout feels balanced.

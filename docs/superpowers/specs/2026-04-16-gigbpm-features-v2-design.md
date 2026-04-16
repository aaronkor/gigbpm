# GigBPM Features v2 Design

**Date:** 2026-04-16  
**Status:** Approved

## Overview

Three targeted UI improvements to GigBPM following the initial Codex implementation:

1. **Setlist row expand/collapse** — replace always-visible action buttons with a ▼/▲ toggle arrow
2. **TTS toggle in performance view** — quick on/off speaker icon without leaving the screen
3. **Previous track button** — add PREV to the performance controls row

---

## Feature 1: Setlist Row Expand / Collapse

### Problem

The current implementation shows Rename / Export / Delete buttons inline below every setlist row at all times. This consumes vertical space and adds visual noise — the spec called for a reveal mechanic (long-press or swipe), but those interactions are hard to discover on mobile.

### Design

Each setlist row gains a small **▼ arrow button** on the right side of the row header. Tapping the arrow expands the action strip (Rename / Export / Delete); the arrow flips to **▲** to signal it can be collapsed. Tapping ▲ collapses the strip.

**Accordion behaviour:** only one row can be expanded at a time. Expanding a second row automatically collapses the previously-open one.

**Rename interaction:** when Rename is tapped, `expandedId` is set to `null` (row collapses back into normal mode) and `renamingId` is set as before. The rename input replaces the row header.

### State

`SetlistList.svelte` tracks `expandedId: string | null` as `$state`. Arrow click: if `expandedId === row.id` set to `null` (collapse); otherwise set to `row.id` (expand, auto-collapsing the previous).

### Visual

- Arrow button: `background: none`, `border: none`, `var(--text-muted)` colour when collapsed
- Arrow colour becomes `var(--indigo)` when that row is expanded
- Action strip border-top separator unchanged from current implementation

---

## Feature 2: TTS Toggle in Performance View

### Problem

TTS (announce song name) is only configurable in Settings. A musician mid-performance has no way to quickly mute or unmute announcements without exiting.

### Design

The performance screen's top row currently has a single exit button (`align-self: flex-end`). Replace this single-button top row with a **full-width flex row** (`justify-content: space-between`) containing:

- **Left:** TTS icon button (`align-self: flex-start`)
- **Right:** Exit (✕) button (unchanged)

The TTS icon is the Unicode speaker character **🔊** (or a text `♪` fallback). Visual states are controlled by CSS opacity only — no `filter: grayscale` (emoji rendering is inconsistent with CSS filters):

- **Off:** `opacity: 0.25`
- **On:** `opacity: 1.0`

If `isTTSAvailable()` returns `false`, the TTS button is **not rendered** (use `{#if isTTSAvailable()}`). This avoids showing a non-functional control on iOS Safari.

Tapping calls `settingsStore.setAnnounceSongName(!settingsStore.announceSongName)`. The change takes effect on the next song transition — it does **not** trigger an immediate announcement.

### Layout change

```
Before: [screen flex-col]
  <button class="exit-btn" align-self: flex-end>✕</button>
  ...

After: [screen flex-col]
  <div class="top-row">   ← new wrapper, width:100%, flex, justify-content:space-between
    <button class="tts-btn">🔊</button>
    <button class="exit-btn">✕</button>
  </div>
  ...
```

The `.exit-btn` `align-self: flex-end` rule is removed (no longer needed — positioning is handled by the wrapper).

---

## Feature 3: Previous Track Button

### Problem

Performers can only move forward through a setlist. If they accidentally advance or need to restart the current song, they must exit and re-enter performance mode.

### Design

A **PREV circular button** is added to the controls row, to the **left of the Pause button**.

**Button sizing hierarchy** (actual pixel values from current CSS):

| Button | Diameter | Notes |
|--------|----------|-------|
| PREV   | 48 px    | New — less critical, smallest target |
| PAUSE  | 64 px    | Unchanged |
| NEXT   | 96 px    | Unchanged — most important, dominant |

**Icons and labels:** `◀◀` icon + `PREV` label, matching the style of existing buttons (`btn-icon` + `btn-label` classes).

**Behaviour:**
- Calls `performanceStore.prev()`
- `prev()` computes `prevIndex = (songIndex - 1 + totalSongs) % totalSongs` — wraps from song 1 to last song
- Sets metronome BPM immediately via `metronome.setBpm()`
- Calls `maybeAnnounce(prevSong)` — announces if TTS is on
- Works while paused — switches song, metronome stays paused
- Works while running — switches song, metronome continues without stopping

### Store change

Add `prev(): void` to `performanceStore` in `src/stores/performance.ts`:

```ts
prev(): void {
  const state = get(store)
  if (!state.setlist || state.setlist.songs.length === 0) return
  const prevIndex = (state.songIndex - 1 + state.setlist.songs.length) % state.setlist.songs.length
  const prevSong = state.setlist.songs[prevIndex] ?? null
  if (!prevSong) return
  metronome.setBpm(prevSong.bpm)
  maybeAnnounce(prevSong)
  store.set(createState(state.setlist, prevIndex, state.running, state.paused))
},
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/SetlistList.svelte` | Add `expandedId` state; gate `.row-actions` on `expandedId === row.id`; add ▼/▲ arrow button; collapse on rename |
| `src/components/PerformanceScreen.svelte` | Wrap exit button in `.top-row` div; add TTS icon button (left side, conditional on `isTTSAvailable()`); add PREV button to controls row; import `isTTSAvailable` and `settingsStore` |
| `src/stores/performance.ts` | Add `prev()` method |

No new files needed. No changes to types, storage, or other stores.

---

## Verification

- `npm run check` — 0 errors, 0 warnings
- `npm test` — all tests pass

**Setlist expand:**
  - Tap ▼ on a row → action strip appears, arrow becomes ▲
  - Tap ▲ → strip hides, arrow becomes ▼
  - Expand row B while A is open → A collapses automatically
  - Tap Rename → row collapses (no action strip visible), rename input appears

**TTS toggle:**
  - Enter performance; TTS icon visible top-left, dimmed if `announceSongName` is false
  - Tap icon → opacity changes immediately; `settingsStore.announceSongName` flips; persisted to localStorage
  - Advance track — announcement fires (or not) per new setting
  - On a browser with `speechSynthesis` unavailable (`isTTSAvailable()` returns `false`): TTS button is not rendered; `isTTSAvailable` can be tested by calling it with `speechSynthesis` deleted from `window`

**PREV button:**
  - On song 1, tap PREV → jumps to last song; BPM ring updates immediately
  - On song N (not first), tap PREV → goes to song N−1
  - While paused: PREV changes song, ring stays red (paused), does not auto-resume
  - Unit test for `performanceStore.prev()` added to the store test suite covering: normal wrap-down, wrap-around from index 0, no-op on empty setlist

**Build:**
  - `npm run build` completes without errors

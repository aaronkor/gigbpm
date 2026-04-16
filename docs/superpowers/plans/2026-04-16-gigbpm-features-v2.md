# GigBPM Features v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expand/collapse arrows to setlist rows, a TTS toggle icon to the performance screen, and a PREV track button.

**Architecture:** Three independent changes touching three files. The store change (`prev()`) is pure logic; the two component changes are UI-only. TDD order: store first (testable in isolation), then components (manual verification).

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest — commands: `npm test`, `npm run check`, `npm run build`

**Spec:** `docs/superpowers/specs/2026-04-16-gigbpm-features-v2-design.md`

---

## Chunk 1: Store method + Setlist UI

### Task 1: `performanceStore.prev()`

**Files:**
- Modify: `src/stores/performance.ts`
- Create: `src/tests/performance.test.ts`

---

- [ ] **Step 1: Write failing tests for `prev()`**

Create `src/tests/performance.test.ts`:

```ts
import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'

import { performanceStore } from '../stores/performance'
import type { Setlist } from '../lib/types'

const makeSetlist = (songCount: number): Setlist => ({
  id: 'sl1',
  name: 'Test Set',
  songs: Array.from({ length: songCount }, (_, i) => ({
    id: `s${i}`,
    name: `Song ${i + 1}`,
    bpm: 100 + i * 10,
  })),
})

describe('performanceStore.prev()', () => {
  beforeEach(() => {
    // Reset store state before each test
    performanceStore.exit()
  })

  it('does nothing when no setlist is loaded', () => {
    performanceStore.prev()
    expect(get(performanceStore).songIndex).toBe(0)
  })

  it('wraps from first song to last song', () => {
    const setlist = makeSetlist(3)
    performanceStore.enter(setlist)
    expect(get(performanceStore).songIndex).toBe(0)
    performanceStore.prev()
    expect(get(performanceStore).songIndex).toBe(2)
  })

  it('goes back one song from a middle song', () => {
    const setlist = makeSetlist(3)
    performanceStore.enter(setlist)
    performanceStore.next() // → index 1
    performanceStore.prev() // → index 0
    expect(get(performanceStore).songIndex).toBe(0)
  })

  it('preserves paused state when going back', () => {
    const setlist = makeSetlist(3)
    performanceStore.enter(setlist)
    performanceStore.next()     // → index 1
    performanceStore.pause()
    performanceStore.prev()     // → index 0, still paused
    const state = get(performanceStore)
    expect(state.songIndex).toBe(0)
    expect(state.paused).toBe(true)
    expect(state.running).toBe(false)
  })

  it('does nothing on an empty setlist', () => {
    const setlist = makeSetlist(0)
    performanceStore.enter(setlist)
    performanceStore.prev()
    expect(get(performanceStore).songIndex).toBe(0)
  })

  it('wraps to itself on a single-song setlist', () => {
    const setlist = makeSetlist(1)
    performanceStore.enter(setlist)
    performanceStore.prev()
    expect(get(performanceStore).songIndex).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- src/tests/performance.test.ts
```

Expected: FAIL — `performanceStore.prev is not a function`

- [ ] **Step 3: Add `prev()` to `performanceStore`**

Open `src/stores/performance.ts`. Inside `createPerformanceStore()`, add `prev()` after the closing brace of `resume()` and before the closing brace of the `return { … }` object (currently the last method before the closing `}`). In the current file, `resume()` ends at line 198 — insert `prev()` on line 199, pushing the closing `}` down:

```ts
    prev(): void {
      const state = get(store)

      if (!state.setlist || state.setlist.songs.length === 0) {
        return
      }

      const prevIndex =
        (state.songIndex - 1 + state.setlist.songs.length) % state.setlist.songs.length
      const prevSong = state.setlist.songs[prevIndex] ?? null

      if (!prevSong) {
        return
      }

      metronome.setBpm(prevSong.bpm)
      maybeAnnounce(prevSong)
      store.set(createState(state.setlist, prevIndex, state.running, state.paused))
    },
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- src/tests/performance.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Run full suite and type check**

```bash
npm test && npm run check
```

Expected: all tests pass, 0 errors, 0 warnings

- [ ] **Step 6: Commit**

```bash
git add src/stores/performance.ts src/tests/performance.test.ts
git commit -m "feat: add performanceStore.prev() with wrap-around"
```

---

### Task 2: Setlist row expand/collapse

**Files:**
- Modify: `src/components/SetlistList.svelte`

No new unit test needed — this is a UI-only state change on a component that has no test file. Manual verification steps are at the end of this task.

---

- [ ] **Step 1: Add `expandedId` state**

In `SetlistList.svelte`, in the `<script>` block, add after the existing `let renameInput` line:

```ts
let expandedId = $state<string | null>(null)
```

- [ ] **Step 2: Update `startRename` to collapse the expanded row**

Replace the existing `startRename` function:

```ts
function startRename(setlist: Setlist): void {
  expandedId = null
  renamingId = setlist.id
  renameValue = setlist.name
}
```

- [ ] **Step 3: Replace the always-visible `.row-actions` with conditional expand**

In the template, find the block inside `{:else}` (after the rename input `{#if}`). It currently looks like:

```svelte
{:else}
  <button class="row-main" onclick={() => onOpenSetlist(setlist)}>
    <span class="row-name">{setlist.name}</span>
    <span class="row-meta">
      {setlist.songs.length} song{setlist.songs.length !== 1 ? 's' : ''}
    </span>
  </button>
  <div class="row-actions">
    <button onclick={() => startRename(setlist)}>Rename</button>
    <button onclick={() => handleExport(setlist)}>Export</button>
    <button class="danger" onclick={() => setlistsStore.remove(setlist.id)}>Delete</button>
  </div>
{/if}
```

Replace it with:

```svelte
{:else}
  <div class="row-header">
    <button class="row-main" onclick={() => onOpenSetlist(setlist)}>
      <span class="row-name">{setlist.name}</span>
      <span class="row-meta">
        {setlist.songs.length} song{setlist.songs.length !== 1 ? 's' : ''}
      </span>
    </button>
    <button
      class="arrow-btn"
      class:open={expandedId === setlist.id}
      onclick={() => { expandedId = expandedId === setlist.id ? null : setlist.id }}
      aria-label={expandedId === setlist.id ? 'Collapse actions' : 'Expand actions'}
    >
      {expandedId === setlist.id ? '▲' : '▼'}
    </button>
  </div>
  {#if expandedId === setlist.id}
    <div class="row-actions">
      <button onclick={() => startRename(setlist)}>Rename</button>
      <button onclick={() => handleExport(setlist)}>Export</button>
      <button class="danger" onclick={() => setlistsStore.remove(setlist.id)}>Delete</button>
    </div>
  {/if}
{/if}
```

- [ ] **Step 4: Update CSS — add `.row-header` and `.arrow-btn` rules**

In the `<style>` block, replace the existing `.row-main` rule (which has `width: 100%`) with:

```css
  .row-header {
    display: flex;
    align-items: center;
  }

  .row-main {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }

  .arrow-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    padding: 14px 14px;
    flex-shrink: 0;
    line-height: 1;
  }

  .arrow-btn.open {
    color: var(--indigo);
  }
```

- [ ] **Step 5: Type check**

```bash
npm run check
```

Expected: 0 errors, 0 warnings

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

Open the app. Verify:
- All rows show ▼ by default (no action buttons visible)
- Tapping ▼ on a row reveals Rename / Export / Delete, arrow becomes ▲ (indigo)
- Tapping ▲ hides actions, arrow reverts to ▼ (muted)
- Opening row B while row A is expanded → row A collapses automatically
- Tapping Rename → actions strip disappears, rename input appears

- [ ] **Step 7: Commit**

```bash
git add src/components/SetlistList.svelte
git commit -m "feat: add expand/collapse arrow to setlist rows"
```

---

## Chunk 2: Performance Screen

### Task 3: TTS toggle + PREV button in PerformanceScreen

**Files:**
- Modify: `src/components/PerformanceScreen.svelte`

No unit test — component relies on DOM/audio environment. Verified manually.

---

- [ ] **Step 1: Add imports**

In `PerformanceScreen.svelte`, at the top of the `<script>` block, add two imports after the existing `performanceStore` import:

```ts
import { isTTSAvailable } from '../lib/tts'
import { settingsStore } from '../stores/settings'
```

- [ ] **Step 2: Wrap the exit button in a `.top-row` div**

In the template, find:

```svelte
<div class="screen">
  <button class="exit-btn" onclick={handleExit} aria-label="Exit performance">✕</button>
```

Replace with:

```svelte
<div class="screen">
  <div class="top-row">
    {#if isTTSAvailable()}
      <button
        class="tts-btn"
        onclick={() => settingsStore.setAnnounceSongName(!$settingsStore.announceSongName)}
        aria-label={$settingsStore.announceSongName ? 'Disable song announcement' : 'Enable song announcement'}
        style="opacity: {$settingsStore.announceSongName ? '1' : '0.25'}"
      >🔊</button>
    {:else}
      <div></div>
    {/if}
    <button class="exit-btn" onclick={handleExit} aria-label="Exit performance">✕</button>
  </div>
```

**Important:** Use `$settingsStore.announceSongName` (with the `$` prefix) everywhere you read the value in the template — this is Svelte's auto-subscription syntax and is required for the button to re-render when the value changes. Calling the setter `settingsStore.setAnnounceSongName(…)` (no `$`) is correct — you only use `$` when reading.

Note: the empty `<div>` in the `{:else}` branch keeps `justify-content: space-between` working — the exit button stays right-aligned even when TTS is unavailable.

- [ ] **Step 3: Add the PREV button to the controls row**

Find the `<div class="controls">` block:

```svelte
  <div class="controls">
    <button
      class="pause-btn"
      ...
    >
```

Add the PREV button before the pause button:

```svelte
  <div class="controls">
    <button class="prev-btn" onclick={() => performanceStore.prev()} aria-label="Previous song">
      <span class="btn-icon">◀◀</span>
      <span class="btn-label">PREV</span>
    </button>
    <button
      class="pause-btn"
      ...
```

- [ ] **Step 4: Update CSS**

In the `<style>` block:

**Add `.top-row`** (after `.screen` rule):

```css
  .top-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
```

**Remove `align-self: flex-end`** from `.exit-btn` — it is now positioned by `.top-row`. Find the exact existing rule:

```css
  .exit-btn {
    align-self: flex-end;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
  }
```

Replace with (drop `align-self: flex-end`):

```css
  .exit-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
  }
```

**Add `.tts-btn`** immediately after the `.exit-btn` rule:

```css
  .tts-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    transition: opacity 0.15s ease;
  }
```

**Add `.prev-btn`** after the `.pause-btn.is-paused { border-color: var(--danger); }` rule:

```css
  .prev-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    color: var(--text);
  }
```

- [ ] **Step 5: Type check**

```bash
npm run check
```

Expected: 0 errors, 0 warnings

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass (at least 45 + the 6 new ones from Task 1 = 51 total; no regressions)

- [ ] **Step 7: Manual smoke test — TTS toggle**

```bash
npm run dev
```

- Open a setlist, tap Play to enter performance mode
- Verify 🔊 icon appears top-left at ~25% opacity (TTS off by default)
- Tap 🔊 → icon goes full opacity; open DevTools → localStorage `gigbpm_settings` → `announceSongName: true`
- Tap NEXT — song name is announced
- Tap 🔊 again → icon dims; tap NEXT — no announcement
- Exit performance, open Settings → TTS toggle reflects the updated value

- [ ] **Step 8: Manual smoke test — PREV button**

- Enter performance on a 3-song setlist
- Tap NEXT → song 2; tap PREV → back to song 1; BPM ring updates
- On song 1, tap PREV → jumps to song 3 (wrap-around); BPM updates
- Tap PAUSE, then PREV → song changes, ring stays red (paused), not auto-resumed

- [ ] **Step 9: Commit**

```bash
git add src/components/PerformanceScreen.svelte
git commit -m "feat: add TTS toggle and PREV button to performance screen"
```

---

## Final Verification

- [ ] `npm run check` — 0 errors, 0 warnings
- [ ] `npm test` — all 51 tests pass (45 existing + 6 added in Task 1)
- [ ] `npm run build` — build completes without errors

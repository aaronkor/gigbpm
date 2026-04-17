# Performance Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single "Performance Mode" setting that keeps the screen on and shows a Do Not Disturb reminder banner while on the Performance screen.

**Architecture:** Three additive changes — data model (types + store), Settings UI toggle, and PerformanceScreen enhancements (wake lock `$effect` + dismissible DND banner). No new files are needed; all changes extend existing modules.

**Tech Stack:** Svelte 5, TypeScript, Vitest, Web Wake Lock API (`navigator.wakeLock`)

**Spec:** `docs/superpowers/specs/2026-04-17-performance-mode-design.md`

---

## Chunk 1: Data model — types and settings store

### Task 1: Add `performanceMode` to `AppSettings` and `DEFAULT_SETTINGS`

**Files:**
- Modify: `src/lib/types.ts`
- Test: `src/tests/storage.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/tests/storage.test.ts` inside the existing `describe('loadSettings', ...)` block:

```ts
it('defaults performanceMode to false when field is missing from stored data', () => {
  localStorage.setItem('gigbpm_settings', JSON.stringify({ announceSongName: true }))
  expect(loadSettings().performanceMode).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/storage.test.ts
```

Expected: FAIL — `performanceMode` is `undefined`, not `false`

- [ ] **Step 3: Add `performanceMode` to `AppSettings` and `DEFAULT_SETTINGS` in `src/lib/types.ts`**

```ts
export interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean        // ADD
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  performanceMode: false,         // ADD
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/storage.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/tests/storage.test.ts
git commit -m "feat: add performanceMode field to AppSettings"
```

---

### Task 2: Add `performanceMode` to `settingsStore`

**Files:**
- Modify: `src/stores/settings.ts`
- Test: `src/tests/storage.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/tests/storage.test.ts` as a new top-level `describe` block:

```ts
describe('settingsStore.setPerformanceMode', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsStore.setPerformanceMode(false)
  })

  it('defaults performanceMode to false', () => {
    expect(settingsStore.performanceMode).toBe(false)
  })

  it('updates performanceMode and persists it', () => {
    settingsStore.setPerformanceMode(true)
    expect(settingsStore.performanceMode).toBe(true)
    expect(
      JSON.parse(localStorage.getItem('gigbpm_settings') ?? '{}').performanceMode,
    ).toBe(true)
    settingsStore.setPerformanceMode(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/storage.test.ts
```

Expected: FAIL — `settingsStore.setPerformanceMode` is not a function

- [ ] **Step 3: Update `src/stores/settings.ts`**

Add `performanceMode` to `SettingsState`, update `createState()`, and add the getter and setter:

```ts
interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean        // ADD
  midi: AppSettings['midi']
}

function createState(all: AppSettings): SettingsState {
  return {
    all,
    announceSongName: all.announceSongName,
    clickSound: all.clickSound,
    performanceMode: all.performanceMode,   // ADD
    midi: all.midi,
  }
}
```

In the returned store object, add after `get clickSound()`:

```ts
get performanceMode() {
  return get(store).performanceMode
},
```

And add after `setClickSound()`:

```ts
setPerformanceMode(value: boolean): void {
  updateSettings((settings) => ({ ...settings, performanceMode: value }))
},
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/settings.ts src/tests/storage.test.ts
git commit -m "feat: add performanceMode to settingsStore"
```

---

## Chunk 2: Settings UI

### Task 3: Add Performance section to Settings screen

**Files:**
- Modify: `src/components/Settings.svelte`

No new unit tests needed — this is a UI-only change. Verify visually by running the dev server.

- [ ] **Step 1: Add Performance section to `src/components/Settings.svelte`**

Locate the closing `</section>` of the Audio section. Insert the new Performance section **immediately after it and before the `{#if ttsAvailable}` block** (the Performance section renders unconditionally, unlike the TTS and MIDI sections):

```svelte
<section>
  <h2>Performance</h2>
  <div class="row">
    <div class="row-text">
      <div class="row-title">Performance Mode</div>
      <div class="row-desc">Keeps screen on and reminds you to enable Do Not Disturb</div>
    </div>
    <label class="toggle" aria-label="Toggle performance mode">
      <input
        type="checkbox"
        checked={$settingsStore.performanceMode}
        onchange={(event) => settingsStore.setPerformanceMode((event.target as HTMLInputElement).checked)}
      />
      <span class="slider"></span>
    </label>
  </div>
</section>
```

Note: use `class="row-text"` on the text wrapper (matches every other row in the file) and `(event.target as HTMLInputElement).checked` to match the existing toggle pattern and pass type check.

The `$settingsStore` import and `settingsStore` import are already present in `Settings.svelte`. No new imports needed.

- [ ] **Step 2: Run dev server and verify**

```bash
npm run dev
```

Open Settings. Confirm:
- "Performance" section appears below Audio
- Toggle starts unchecked
- Toggling on/off persists (reload page — toggle state should be remembered)
- `aria-label="Toggle performance mode"` on the label (inspect element)

- [ ] **Step 3: Run type check**

```bash
npm run check
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/Settings.svelte
git commit -m "feat: add Performance Mode toggle to Settings"
```

---

## Chunk 3: Performance screen — wake lock and DND banner

### Task 4: Add wake lock `$effect` to PerformanceScreen

**Files:**
- Modify: `src/components/PerformanceScreen.svelte`

The Wake Lock API is not easily unit-testable in jsdom. Verify by running the dev server on a real device or Chrome with DevTools.

- [ ] **Step 1: Add wake lock variables and `$effect` to `PerformanceScreen.svelte`**

In the `<script>` block, after the existing `$effect` for click sound (line ~76–78), add:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wakeLock: any = null

$effect(() => {
  const enabled = $settingsStore.performanceMode
  if (!enabled) return

  async function requestLock() {
    try {
      // @ts-ignore — WakeLockSentinel not in all TS lib targets
      wakeLock = await navigator.wakeLock?.request('screen') ?? null
    } catch {
      // silently ignore: API unavailable or request rejected
    }
  }
  requestLock()

  function onVisibility() {
    if (document.visibilityState === 'visible' && $settingsStore.performanceMode) {
      requestLock()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    wakeLock?.release().catch(() => {})
    wakeLock = null
  }
})
```

- [ ] **Step 2: Run type check**

```bash
npm run check
```

Expected: no errors

- [ ] **Step 3: Verify manually in Chrome**

```bash
npm run dev
```

1. Open Settings → enable Performance Mode
2. Navigate to Performance screen
3. Open Chrome DevTools → Application → Service Workers. In the Console, run:

```js
navigator.wakeLock.request('screen').then(s => console.log('lock acquired', s))
```

Alternatively, leave the Performance screen open for 30+ seconds and confirm the screen does not dim (test on Android Chrome or a device with short screen timeout).

4. Navigate back to home — confirm no JS errors in console
5. Toggle Performance Mode off mid-session on Performance screen — confirm no JS errors

- [ ] **Step 4: Commit**

```bash
git add src/components/PerformanceScreen.svelte
git commit -m "feat: add wake lock to Performance screen when Performance Mode is on"
```

---

### Task 5: Add DND reminder banner to PerformanceScreen

**Files:**
- Modify: `src/components/PerformanceScreen.svelte`

- [ ] **Step 1: Add dismissed state and banner markup**

In the `<script>` block, add after `let beatActive = $state(false)`:

```ts
let dndDismissed = $state(false)
```

In the template, insert the banner between `<div class="top-row">...</div>` and `<div class="song-info">`:

```svelte
{#if $settingsStore.performanceMode && !dndDismissed}
  <div class="dnd-banner">
    <span>Enable Do Not Disturb on your device for uninterrupted performance</span>
    <button
      class="dnd-dismiss"
      onclick={() => { dndDismissed = true }}
      aria-label="Dismiss Do Not Disturb reminder"
    >✕</button>
  </div>
{/if}
```

Note: `{#if}` removes the element from the DOM when dismissed, which collapses the layout gap identically to `display: none` — the result is the same. This is idiomatic Svelte.

- [ ] **Step 2: Add banner styles**

In the `<style>` block, add:

```css
.dnd-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 13px;
}

.dnd-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
```

Note: `width: 100%` is required because `.screen` uses `align-items: center` — without it the banner shrinks to content width and `justify-content: space-between` won't push the dismiss button to the right edge.

- [ ] **Step 3: Run type check**

```bash
npm run check
```

Expected: no errors

- [ ] **Step 4: Verify manually**

```bash
npm run dev
```

1. Performance Mode **off**: navigate to Performance screen — confirm no banner
2. Performance Mode **on**: navigate to Performance screen — confirm banner appears above song info
3. Tap ✕ — confirm banner disappears
4. Navigate away and back — confirm banner reappears (dismissed state is per-visit)
5. Inspect element: confirm `aria-label="Dismiss Do Not Disturb reminder"` on ✕ button
6. Test on a narrow viewport (320px) — confirm banner doesn't overflow or obstruct ring

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/PerformanceScreen.svelte
git commit -m "feat: add DND reminder banner to Performance screen"
```

---

## Done

All four files touched, all tasks committed. The feature is complete when:

- [ ] `performanceMode: false` appears in `DEFAULT_SETTINGS`
- [ ] `settingsStore.setPerformanceMode(true/false)` works and persists
- [ ] Settings screen shows a "Performance" section with a working toggle
- [ ] Performance screen holds a wake lock when mode is on
- [ ] Performance screen shows a dismissible DND banner when mode is on
- [ ] All existing tests continue to pass (`npx vitest run`)
- [ ] Type check passes (`npm run check`)

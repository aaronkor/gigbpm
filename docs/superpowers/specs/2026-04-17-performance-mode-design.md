# GigBPM — Feature Spec: Performance Mode

**Date:** 2026-04-17
**Status:** Approved

---

## Overview

Performance Mode is a single app setting that activates two behaviours designed for live stage use:

1. **Wake Lock** — keeps the screen on while the Performance screen is active, so the musician never has to unlock the device mid-gig
2. **DND Reminder Banner** — shows a dismissible prompt on each visit to the Performance screen, reminding the musician to enable Do Not Disturb on their device

The app cannot programmatically suppress OS-level sounds (phone ring, notifications) — that is controlled by the OS. Performance Mode instead surfaces a clear reminder to do so manually, and eliminates the separate problem of the screen going dark.

---

## Data Model

`AppSettings` gains one new boolean field. Both the interface and `DEFAULT_SETTINGS` in `src/lib/types.ts` must be updated:

```ts
interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean   // NEW — default: false
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  performanceMode: false,    // NEW
  midi: { enabled: false, advance: null, pauseStop: null },
}
```

`SettingsState` is a private interface inside `src/stores/settings.ts` (not exported from `types.ts`). It gains a matching field:

```ts
interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean   // NEW
  midi: AppSettings['midi']
}
```

`settingsStore` gains:
- `get performanceMode()` accessor
- `setPerformanceMode(value: boolean)` action

Both follow the existing pattern used by `announceSongName`. The private `createState()` function inside `settings.ts` must also be updated to map `all.performanceMode` into the returned state object — omitting this will cause a TypeScript error when `SettingsState` is updated.

### Migration

`loadSettings()` in `src/lib/storage.ts` already merges stored data onto `DEFAULT_SETTINGS` via object spread (`{ ...defaults, ...stored }`). Existing localStorage payloads that lack `performanceMode` will automatically receive the default value of `false` — no migration code is needed.

---

## Settings UI

A new **Performance** section is added to `Settings.svelte`, positioned after the Audio section. This section renders unconditionally — it is not gated behind any feature-detection check (unlike the MIDI section, which is hidden when Web MIDI is unavailable).

It contains a single toggle row:

- **Label:** Performance Mode
- **Subtitle:** Keeps screen on and reminds you to enable Do Not Disturb
- **Control:** toggle (boolean, same pattern as Announce Song Name)
- **Accessibility:** `aria-label="Toggle performance mode"` on the wrapping `<label>`, matching the pattern of `aria-label="Toggle announce song name"` and `aria-label="Toggle MIDI"` used in the same file

---

## Wake Lock

When `performanceMode` is enabled and the user is on the Performance screen, the app holds a Screen Wake Lock via `navigator.wakeLock.request('screen')`.

### Lifecycle

| Event | Behaviour |
|---|---|
| Enter Performance screen (mode on) | Request wake lock |
| Page hidden (tab switch, phone lock) | Browser releases lock automatically |
| Page becomes visible again | Re-request wake lock |
| Navigate away from Performance screen | Release lock explicitly |
| `performanceMode` toggled off mid-session | Release lock immediately |

### Implementation

`PerformanceScreen.svelte` already uses `onMount`, `onDestroy`, and a `$effect` for click sound. The wake lock logic is an **additive `$effect`** — the existing `onMount` must not be modified or merged with this new effect.

The `WakeLockSentinel` reference is stored in a component-level `let` variable outside the `$effect`, so the cleanup function and the `visibilitychange` handler both close over the same instance. TypeScript's `lib.dom.d.ts` does not include `WakeLockSentinel` in all tsconfig targets — declare it as `any` or cast as needed, or annotate with `// @ts-ignore`:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wakeLock: any = null
```

`settingsStore` is a Svelte writable store. Reading `$settingsStore.performanceMode` at the top level of `$effect` subscribes to the whole store — consistent with how the existing click-sound effect reads `$settingsStore.clickSound`. Any settings change will re-run the effect, but this is acceptable: the cleanup releases the lock and the re-run immediately re-acquires it if the mode is still on. This matches the existing codebase pattern.

`$settingsStore.performanceMode` inside the `onVisibility` nested function is a live getter call (reads the current store value at call time), not a reactive subscription. This is correct: we want the current value at the moment visibility changes, not at effect-creation time.

```ts
$effect(() => {
  const enabled = $settingsStore.performanceMode
  if (!enabled) return

  async function requestLock() {
    try { wakeLock = await navigator.wakeLock?.request('screen') ?? null }
    catch { /* silently ignore */ }
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

Key points:
- `onVisibility` reads `$settingsStore.performanceMode` as a live getter call — if mode was toggled off while the page was hidden, the re-request is skipped
- Cleanup removes the listener before releasing the lock to prevent a race
- All `wakeLock.request()` calls are in try/catch; all `.release()` calls use `.catch(() => {})`
- If `navigator.wakeLock` is `undefined`, the optional chain (`?.request`) returns `undefined` silently

### Browser Support

`navigator.wakeLock` is supported on Chrome/Android and Safari 16.4+. If `navigator.wakeLock` is `undefined`, the request is skipped entirely.

---

## DND Reminder Banner

When `performanceMode` is enabled, a dismissible banner is shown at the top of the Performance screen on each visit.

### Content

> Enable Do Not Disturb on your device for uninterrupted performance  &nbsp; ✕

The ✕ dismiss button must have `aria-label="Dismiss Do Not Disturb reminder"`, consistent with other icon-only buttons in the app (e.g. `aria-label="Exit performance"` on the exit button).

### Behaviour

- **Dismissed state** is local component state (`let dismissed = $state(false)`), not persisted to localStorage
- Dismissing hides the banner for the current visit only; it reappears the next time the user enters the Performance screen
- If `performanceMode` is off, the banner is never rendered

### Visual Style & DOM Placement

The banner is inserted between `top-row` and `song-info` in `PerformanceScreen.svelte`. The `.screen` container is `flex-direction: column` with `gap: var(--screen-section-gap)`. The banner occupies a full gap slot when visible, shifting the ring downward. To avoid layout shift, it must use `display: none` (not `visibility: hidden`) when dismissed — this collapses the element and restores the original layout.

The banner reuses the `.row` markup pattern from `Settings.svelte`: a `display: flex; align-items: center; justify-content: space-between` container with `var(--surface)` background, `var(--text-muted)` text, `var(--border)` border, and `var(--radius-sm)` border radius. The dismiss ✕ button is a trailing flex item, right-aligned.

---

## Files Affected

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `performanceMode: boolean` to `AppSettings`; update `DEFAULT_SETTINGS` |
| `src/stores/settings.ts` | Add `performanceMode` to `SettingsState`; add `get performanceMode()` and `setPerformanceMode()` |
| `src/components/Settings.svelte` | Add Performance section with single toggle row |
| `src/components/PerformanceScreen.svelte` | Add DND banner with local dismissed state; add wake lock `$effect` |

---

## Out of Scope

- Programmatic suppression of OS-level sounds (not possible from a PWA)
- Per-setlist or per-song performance mode overrides
- Visual indicator in the Settings icon or app header showing Performance Mode is active

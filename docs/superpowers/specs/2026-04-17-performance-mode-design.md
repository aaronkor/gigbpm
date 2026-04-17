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

`AppSettings` gains one new boolean field:

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
```

`DEFAULT_SETTINGS` is updated to include `performanceMode: false`.

`SettingsState` gains a matching field:

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

Both follow the existing pattern used by `announceSongName`.

---

## Settings UI

A new **Performance** section is added to `Settings.svelte`, positioned after the Audio section.

It contains a single toggle row:

- **Label:** Performance Mode
- **Subtitle:** Keeps screen on and reminds you to enable Do Not Disturb
- **Control:** toggle (boolean, same pattern as Announce Song Name)

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

All wake lock logic lives in `PerformanceScreen.svelte` using a Svelte 5 `$effect`:

- On mount: if `performanceMode` is on, request wake lock
- `visibilitychange` listener: re-request when `document.visibilityState === 'visible'` and mode is still on
- Cleanup function releases the lock and removes the listener

### Browser Support

`navigator.wakeLock` is supported on Chrome/Android and Safari 16.4+. If the API is unavailable, the request is silently skipped — no error is shown to the user.

---

## DND Reminder Banner

When `performanceMode` is enabled, a dismissible banner is shown at the top of the Performance screen on each visit.

### Content

> Enable Do Not Disturb on your device for uninterrupted performance  &nbsp; ✕

### Behaviour

- **Dismissed state** is local component state (`let dismissed = $state(false)`), not persisted to localStorage
- Dismissing hides the banner for the current visit only; it reappears the next time the user enters the Performance screen
- If `performanceMode` is off, the banner is never rendered

### Visual Style

- Positioned above the BPM ring
- Muted styling consistent with non-critical UI (subdued text, no bright accent colours)
- Does not obstruct the ring, BPM display, or transport controls

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

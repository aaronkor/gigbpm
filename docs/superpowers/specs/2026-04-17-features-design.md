# GigBPM — Feature Spec: Install Prompt, Click Sounds, Share, Inline Name Edit

**Date:** 2026-04-17
**Status:** Approved

---

## Overview

This spec covers four incremental features added to GigBPM after the initial v1 design:

1. **Add to Home Screen prompt** — guide users to install the PWA
2. **Click sound selection** — choose between 3 synthesized click sounds
3. **Share a setlist** — share via native share sheet (Web Share API)
4. **Inline setlist name editing** — edit the name directly from the Setlist Editor

All features respect the existing constraints: fully offline, no backend, localStorage only, dark stage-optimised UI.

---

## Feature 1 — Add to Home Screen Prompt

### Goal

Surface the PWA install capability to users who would otherwise miss it, both proactively on first visit and persistently via Settings.

### Data

A new localStorage key `gigbpm_install_dismissed` (boolean, independent of `AppSettings`) tracks whether the user has permanently dismissed the install banner. It is never stored inside `AppSettings` because it is not a user preference — it is UI state.

### Banner

- Rendered in `App.svelte`, below the active screen
- Shown on first load if:
  - The `beforeinstallprompt` event has fired (Chrome/Android), **or** the browser is iOS Safari (detected via user-agent)
  - AND `gigbpm_install_dismissed` is not `true`
  - AND the app is not already running in standalone mode (`window.matchMedia('(display-mode: standalone)').matches`)
- The banner contains: a short install message, an "Add" button, and a dismiss (✕) button
- Tapping **Add** on Chrome/Android: triggers the deferred `BeforeInstallPromptEvent.prompt()`; on outcome (accepted or dismissed by OS), hides the banner
- Tapping **Add** on iOS: opens a small bottom sheet with manual instructions: *"Tap the Share icon in Safari, then choose Add to Home Screen"*
- Tapping **✕**: sets `gigbpm_install_dismissed = true` in localStorage, hides banner permanently
- Once the app is installed (standalone mode on next load), the banner is never shown

### Settings

A new **App** section is added at the top of the Settings screen with a single "Install App" row:

- On Chrome/Android: button triggers the deferred `beforeinstallprompt`; if no prompt is available (already installed or browser doesn't support), the row shows "Already installed" and is disabled
- On iOS Safari: button opens the same manual-instructions bottom sheet as the banner
- On other browsers (no `beforeinstallprompt`, not iOS): row is hidden

### iOS Detection

```ts
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
```

### Edge Cases

| Scenario | Handling |
|---|---|
| User dismisses banner, later wants to install | Settings row always available |
| App already installed (standalone mode) | Banner never shown; Settings row disabled |
| Browser doesn't support install (e.g. Firefox) | Banner and Settings row both hidden |
| `beforeinstallprompt` fires after banner is already dismissed | Prompt deferred but not shown |

---

## Feature 2 — Click Sound Selection

### Goal

Let users choose a click sound that suits their preference or hearing environment. All sounds are synthesized via Web Audio API — no audio files, no added bundle size.

### Sounds

| Key | Name | Synthesis |
|---|---|---|
| `'wood'` | Wood | Current implementation: white noise burst, exponential decay (~150 rate), 40ms — warm, percussive |
| `'beep'` | Beep | Sine oscillator at 880 Hz, 60ms, linear ramp to zero — clean, electronic |
| `'tick'` | Tick | White noise burst through a high-pass filter (~8 kHz cutoff), 25ms — short, sharp, hi-hat-like |

### Data Model

`AppSettings` gains one new field:

```ts
interface AppSettings {
  announceSongName: boolean
  clickSound: 'wood' | 'beep' | 'tick'   // NEW — default: 'wood'
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}
```

`DEFAULT_SETTINGS` is updated to include `clickSound: 'wood'`.

A new exported type alias is added to `types.ts`:

```ts
export type ClickSound = 'wood' | 'beep' | 'tick'
```

### Metronome Engine

`createMetronome()` gains one new method:

```ts
setClickSound(sound: ClickSound): void
```

Internally, `clickBuffer` is nulled when the sound changes, forcing a lazy rebuild on the next scheduled click. Each sound variant has its own `buildClickBuffer(sound)` path. The current `buildClickBuffer()` becomes the `'wood'` branch.

The metronome factory accepts an optional initial sound:

```ts
export function createMetronome(ctx: AudioContext, initialSound?: ClickSound): Metronome
```

### Settings UI

In the Settings screen, the Audio section gains a "Click Sound" row:

- A 3-button segmented control: **Wood | Beep | Tick**
- The active selection is highlighted (indigo border/background, matching the app's accent)
- A **Preview** button below the control fires one click immediately using the currently selected sound (without starting the metronome)
- Selecting a sound saves immediately via `settingsStore.setClickSound()`

### settingsStore

A new action is added:

```ts
setClickSound(value: ClickSound): void
```

---

## Feature 3 — Share a Setlist

### Goal

Let users share a setlist to another device or person via the native OS share sheet (iOS share sheet, Android share sheet), sharing the setlist as a JSON file.

### Implementation

A new function `shareSetlist(setlist: Setlist): Promise<void>` is added to `src/lib/importexport.ts`:

```ts
export async function shareSetlist(setlist: Setlist): Promise<void> {
  const payload = buildExportPayload(setlist)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `setlist-${setlist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  const file = new File([blob], filename, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: setlist.name })
  } else {
    exportSetlist(setlist)
  }
}
```

- `navigator.canShare({ files })` guards against browsers that support `navigator.share` but not file sharing
- If the user cancels the share sheet, `navigator.share` rejects with `AbortError` — this is swallowed silently (no toast needed)
- Other errors are caught and shown as a toast: "Couldn't share setlist"
- Falls back to `exportSetlist()` (file download) on unsupported browsers

### SetlistList UI

The expanded row actions grow from 3 to 4 items: **Rename | Share | Export | Delete**

- **Share** calls `shareSetlist()` — native share sheet
- **Export** calls `exportSetlist()` — direct file download (unchanged)
- Both are kept separate: Share is the recommended mobile action; Export remains for desktop/unsupported browsers

### Edge Cases

| Scenario | Handling |
|---|---|
| User cancels share sheet | `AbortError` swallowed silently |
| `navigator.share` unavailable | Falls back to `exportSetlist()` |
| File sharing not supported (e.g. desktop Chrome) | Falls back to `exportSetlist()` |

---

## Feature 4 — Inline Setlist Name Editing

### Goal

Allow renaming a setlist directly from the Setlist Editor header, without returning to the home screen.

### SetlistEditor Header

The header `<h1>{current.name}</h1>` is replaced with a tap-to-edit pattern:

**View mode** (default):
- Title text rendered in a `<button>` or `<span>` with `cursor: text`
- No explicit edit icon — the title itself is the tap target

**Edit mode** (activated by tapping the title):
- An `<input>` replaces the title, pre-filled with `current.name`, auto-focused
- Saves on `blur` or `Enter` key: calls `setlistsStore.rename(current.id, trimmedValue)` if the value is non-empty; reverts to original if empty
- Cancels (reverts to original without saving) on `Escape`

**State** (local to `SetlistEditor.svelte`):
```ts
let editingName = $state(false)
let nameValue = $state('')
```

### Coexistence with Home Screen Rename

The **Rename** action in `SetlistList.svelte`'s expanded row actions is kept unchanged. Both paths call `setlistsStore.rename()` — they are equivalent. Users who discover inline editing in the editor will use that; users who rename from the list can still do so.

### Edge Cases

| Scenario | Handling |
|---|---|
| User clears the name and blurs | Reverts to previous name without saving |
| User types a name and presses Escape | Reverts to previous name |
| Very long name | Input scrolls within the fixed-width header area |

---

## Files Affected

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `ClickSound` type; add `clickSound` to `AppSettings`; update `DEFAULT_SETTINGS` |
| `src/lib/metronome.ts` | Add `setClickSound()` method; add `'beep'` and `'tick'` synthesis branches |
| `src/lib/importexport.ts` | Add `shareSetlist()` function |
| `src/stores/settings.ts` | Add `setClickSound()` action; expose `clickSound` in state |
| `src/components/Settings.svelte` | Add App section (install row); add Click Sound segmented control + Preview |
| `src/components/SetlistList.svelte` | Add Share action to row actions |
| `src/components/SetlistEditor.svelte` | Replace static title with tap-to-edit input |
| `src/App.svelte` | Add install banner; manage `beforeinstallprompt` event; add iOS detection |

---

## Out of Scope

- Time signatures, accent beats, or per-beat sound variation
- Cloud-based setlist sharing (no backend)
- Wake lock during performance
- Android-specific PWA shortcuts or shortcuts API

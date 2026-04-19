# Custom Click Sound — Design Spec

**Date:** 2026-04-18
**Branch:** feature/custom-click-sound
**Status:** Approved

## Overview

Add a "Custom" option to the Click Sound setting that lets the user synthesise their own metronome click by tweaking four parameters: source waveform, pitch, duration, and decay. The existing Wood / Beep / Tick presets are unchanged.

## Goals

- Give musicians a single custom sound slot they can tune to taste.
- Keep the UI fast to operate on stage (no modals, no navigation).
- Leave the metronome timing path completely untouched.

## Non-goals

- Multiple saved custom presets.
- File-based or sampled sounds.
- Per-song sound overrides.

---

## Data Model

### New types (`src/lib/types.ts`)

```ts
export type ClickSoundSource = 'sine' | 'square' | 'noise'

export interface CustomSoundParams {
  source: ClickSoundSource
  pitch: number    // Hz, range 100–2000; ignored when source = 'noise'
  duration: number // ms, range 10–200
  decay: number    // exponential decay coefficient, range 50–600 (higher = faster fade)
}
```

### Updated types

```ts
export type ClickSound = 'wood' | 'beep' | 'tick' | 'custom'

export interface AppSettings {
  // ... existing fields ...
  customSound: CustomSoundParams
}

export const DEFAULT_CUSTOM_SOUND: CustomSoundParams = {
  source: 'sine',
  pitch: 440,
  duration: 40,
  decay: 200,
}
```

`DEFAULT_SETTINGS` gains `customSound: DEFAULT_CUSTOM_SOUND`.

### Storage migration

`loadSettings` merges stored data with `DEFAULT_SETTINGS`, so existing localStorage records lacking `customSound` automatically get the default values on first load.

---

## Metronome (`src/lib/metronome.ts`)

### `buildClickBuffer` signature change

```ts
function buildClickBuffer(
  sound: ClickSound,
  ctx: AudioContext,
  customParams?: CustomSoundParams,
): AudioBuffer
```

When `sound === 'custom'` and `customParams` is provided:

| source | synthesis |
|--------|-----------|
| `sine` | `Math.sin(2π · pitch · t) · (1 − t / duration)` |
| `square` | sign of sine, same linear decay envelope |
| `noise` | `(Math.random() * 2 − 1) · exp(−t · decay)` |

The three existing preset cases (`wood`, `beep`, `tick`) are unchanged.

### `Metronome` interface addition

```ts
setCustomSoundParams(params: CustomSoundParams): void
// Sets internal customParams and invalidates the clickBuffer cache
```

### `previewClick` signature change

```ts
export function previewClick(sound: ClickSound, customParams?: CustomSoundParams): void
```

---

## Settings Store (`src/stores/settings.ts`)

- Add `customSound: CustomSoundParams` to `SettingsState` (derived from `all.customSound`).
- Add `setCustomSound(params: CustomSoundParams): void` — calls `updateSettings` and persists to localStorage.

---

## Settings UI (`src/components/Settings.svelte`)

### Segmented control

Add `{ key: 'custom', label: 'Custom' }` to the `sounds` array. The control now has four segments: Wood / Beep / Tick / Custom.

### Inline parameter panel

Rendered directly inside the Audio section card, below the segmented control, when `$settingsStore.clickSound === 'custom'`. Uses CSS `{#if}` — no animation required.

**Controls (top to bottom):**

1. **Source** — three-segment mini control: Sine / Square / Noise. Updates `customSound.source`.
2. **Pitch** — range slider, 100–2000 Hz, step 10. Displays current value as `"{n} Hz"`. Disabled (opacity 0.4, pointer-events none) when source is `'noise'`.
3. **Duration** — range slider, 10–200 ms, step 5. Displays `"{n} ms"`.
4. **Decay** — range slider, 50–600, step 10. Displays qualitative label: ≤150 → "slow", 151–350 → "medium", >350 → "fast".

Each slider change calls `settingsStore.setCustomSound({ ...current, [field]: value })`.

The existing **Preview** button already calls `previewClick($settingsStore.clickSound)` — it gains the custom params by passing `$settingsStore.customSound` as the second argument.

### Note

Pitch slider is disabled (not hidden) when source is Noise, to preserve its position for when the user switches back to Sine/Square.

---

## Wiring in PerformanceScreen

In the `$effect` that reacts to `$settingsStore.clickSound`, also call:

```ts
metronome.setCustomSoundParams($settingsStore.customSound)
```

A separate `$effect` watching `$settingsStore.customSound` ensures live parameter updates propagate to the running metronome (useful if settings are somehow accessible mid-performance, or for future use).

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ClickSoundSource`, `CustomSoundParams`, extend `ClickSound`, extend `AppSettings`, add `DEFAULT_CUSTOM_SOUND` |
| `src/lib/metronome.ts` | Update `buildClickBuffer`, `previewClick`, add `setCustomSoundParams` to interface and implementation |
| `src/lib/storage.ts` | Add `customSound` to `DEFAULT_SETTINGS`, ensure migration on load |
| `src/stores/settings.ts` | Add `customSound` to state, add `setCustomSound` method |
| `src/components/Settings.svelte` | Add Custom to sound list, add inline parameter panel |
| `src/stores/performance.ts` | Wire `setCustomSoundParams` into metronome reactivity (if metronome wiring lives here) |

---

## Testing

- Unit tests for `buildClickBuffer` covering all three custom sources.
- Unit test: `setCustomSoundParams` invalidates the buffer cache.
- Unit test: `previewClick('custom', params)` does not throw.
- Storage test: loading legacy settings (no `customSound`) returns default params.
- Manual: switch to Custom, move sliders, hit Preview — hear the change immediately.
- Manual: switch away and back to Custom — previous params are restored.

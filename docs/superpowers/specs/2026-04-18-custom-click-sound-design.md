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
  duration: number // ms (user-facing), range 10–200; converted to seconds at synthesis time
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

`loadSettings` must deep-merge `customSound` the same way it already deep-merges `midi`:

```ts
return {
  ...defaults,
  ...stored,
  midi: { ...defaults.midi, ...stored.midi },
  customSound: { ...defaults.customSound, ...stored.customSound },
}
```

This ensures existing localStorage records lacking `customSound` (or having only partial keys) always get valid defaults.

`cloneDefaultSettings()` in `storage.ts` must also spread `customSound` to avoid shared-reference mutation:

```ts
{ ...DEFAULT_SETTINGS, midi: { ...DEFAULT_SETTINGS.midi }, customSound: { ...DEFAULT_SETTINGS.customSound } }
```

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

When `sound === 'custom'` and `customParams` is provided, convert duration to seconds first:

```ts
const durationSec = customParams.duration / 1000
```

All three custom sources use **exponential decay** with the `decay` coefficient, consistent with existing presets:

| source | synthesis (`t` is time in seconds) |
|--------|--------------------------------------|
| `sine` | `Math.sin(2π · pitch · t) · exp(−t · decay)` |
| `square` | `(sin(2π · pitch · t) > 0 ? 1 : −1) · exp(−t · decay)` |
| `noise` | `(Math.random() * 2 − 1) · exp(−t · decay)` |

Buffer length: `Math.floor(ctx.sampleRate * durationSec)`.

The three existing preset cases (`wood`, `beep`, `tick`) are unchanged. Note: `beep` uses a linear envelope `(1 - time / duration)` while `tick` and `wood` use exponential — this is intentional and not being changed.

### Updated `Metronome` interface

```ts
export interface Metronome {
  start(bpm: number): void
  stop(): void
  pause(): void
  resume(): void
  setBpm(bpm: number): void
  setClickSound(sound: ClickSound): void
  setCustomSoundParams(params: CustomSoundParams): void  // NEW
  onBeat(callback: () => void): void
  readonly isRunning: boolean
  readonly isPaused: boolean
}
```

`setCustomSoundParams` stores the params internally and sets `clickBuffer = null` to invalidate the cache. `createNoopMetronome()` in `src/stores/performance.ts` must also implement this as a no-op.

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

Rendered directly inside the Audio section card, below the segmented control, when `$settingsStore.clickSound === 'custom'`. Uses `{#if}` — no animation required.

**Controls (top to bottom):**

1. **Source** — three-segment mini control: Sine / Square / Noise. Updates `customSound.source`.
2. **Pitch** — range slider, 100–2000 Hz, step 10. Displays current value as `"{n} Hz"`. Disabled (opacity 0.4, pointer-events none) when source is `'noise'`.
3. **Duration** — range slider, 10–200 ms, step 5. Displays `"{n} ms"`.
4. **Decay** — range slider, 50–600, step 10. Displays qualitative label: ≤150 → "slow", 151–350 → "medium", >350 → "fast".

Each slider change calls `settingsStore.setCustomSound({ ...current, [field]: value })`.

The existing **Preview** button passes `$settingsStore.customSound` as the second argument:
```ts
previewClick($settingsStore.clickSound, $settingsStore.customSound)
```

### Note

Pitch slider is disabled (not hidden) when source is Noise, to preserve its position for when the user switches back to Sine/Square.

---

## Wiring in `src/stores/performance.ts`

The metronome is owned by `performance.ts`, not a component. Wiring happens via store subscriptions, not `$effect`. Add a subscription (or extend the existing `clickSound` subscriber) to call:

```ts
metronome.setCustomSoundParams(settingsStore.customSound)
```

whenever `settingsStore.clickSound` changes to `'custom'`, and also whenever `settingsStore.customSound` changes (to propagate live slider adjustments).

Svelte store `subscribe` calls fire synchronously with the current value on first subscription, so subscribing before the metronome is first used is sufficient to handle the initial sync on app load — no separate startup call is needed. The subscription must be established before `metronome.start()` is ever called.

`createNoopMetronome()` must implement `setCustomSoundParams` as a no-op to satisfy the `Metronome` interface.

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ClickSoundSource`, `CustomSoundParams`, extend `ClickSound`, extend `AppSettings`, add `DEFAULT_CUSTOM_SOUND` |
| `src/lib/metronome.ts` | Update `buildClickBuffer` (unit conversion + exp decay for all sources), `previewClick`, add `setCustomSoundParams` to interface and implementation |
| `src/lib/storage.ts` | Add `customSound` to `DEFAULT_SETTINGS`; deep-merge `customSound` in `loadSettings`; spread `customSound` in `cloneDefaultSettings` |
| `src/stores/settings.ts` | Add `customSound` to state, add `setCustomSound` method |
| `src/components/Settings.svelte` | Add Custom to sound list, add inline parameter panel, pass `customSound` to `previewClick` |
| `src/stores/performance.ts` | Add `setCustomSoundParams` no-op to `createNoopMetronome`; subscribe to `customSound` changes to propagate to live metronome |

---

## Testing

- Unit tests for `buildClickBuffer` covering all three custom sources (verify buffer length matches `duration / 1000 * sampleRate`).
- Unit test: `setCustomSoundParams` invalidates the buffer cache (clickBuffer becomes null).
- Unit test: `previewClick('custom', params)` does not throw.
- Storage test: loading legacy settings (no `customSound`) returns full default params.
- Storage test: loading partial `customSound` (missing one key) fills missing key from defaults.
- Manual: switch to Custom, move sliders, hit Preview — hear the change immediately.
- Manual: switch away and back to Custom — previous params are restored.

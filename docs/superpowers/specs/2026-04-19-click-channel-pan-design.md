# Click Channel Pan — Design Spec

**Date:** 2026-04-19  
**Status:** Approved

## Overview

Allow the user to route the metronome click sound to the left ear, right ear, or both (default). Configurable in app settings and persisted to localStorage.

TTS song-name announcements use the Web Speech API (`SpeechSynthesis`), which does not expose an audio stream for Web Audio routing. Channel pan therefore applies to the metronome click only.

## Type: `ClickChannel`

Add to `src/lib/types.ts`:

```ts
export type ClickChannel = 'left' | 'right' | 'both'
```

Add `clickChannel: ClickChannel` to `AppSettings` with default `'both'`. Storage migration: any loaded settings object missing this field defaults to `'both'`.

## Metronome (`src/lib/metronome.ts`)

### Interface change

Add to the `Metronome` interface:

```ts
setClickChannel(channel: ClickChannel): void
```

### Internal change — `scheduleClick`

Currently: `source → destination`

New: `source → StereoPannerNode → destination`

The panner is created fresh per click (same lifetime as the `BufferSourceNode`). Pan value mapping:

| `ClickChannel` | `pan` |
|---|---|
| `'left'` | `-1` |
| `'right'` | `+1` |
| `'both'` | `0` |

`setClickChannel` stores the value; takes effect on the next scheduled click.

### `previewClick`

Add optional `channel: ClickChannel = 'both'` parameter. Apply the same panner in the preview path.

## Settings Store (`src/stores/settings.ts`)

- Add `clickChannel: ClickChannel` to `SettingsState`.
- Expose `get clickChannel()` getter.
- Add `setClickChannel(value: ClickChannel): void` method following the existing `updateSettings` pattern.

## Settings (`src/components/Settings.svelte`)

In the **Audio** section, add a "Channel" row below the Click Sound row. Use a 3-button segment control matching the existing `sound-seg` / `seg-btn` pattern:

```
[ Left ]  [ Both ]  [ Right ]
```

"Both" is the active default. The Preview button passes the current `clickChannel` to `previewClick`.

## Storage (`src/lib/storage.ts`)

`loadSettings` applies a migration: if the loaded object lacks `clickChannel`, set it to `'both'` before returning.

## Error handling

`StereoPannerNode` is universally supported in all target browsers (Chrome, Firefox, Safari, Edge). No fallback needed.

## Testing

- Unit test: `setClickChannel` correctly maps to pan values on the panner node.
- Unit test: `previewClick` accepts the channel param without error.
- Manual: verify left/right/both routing with headphones on a real device.

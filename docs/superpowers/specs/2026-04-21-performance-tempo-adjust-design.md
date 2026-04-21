# Performance Tempo Adjustment - Design Spec

**Date:** 2026-04-21  
**Status:** Draft

## Overview

Allow musicians to adjust the current song tempo while already in Performance Mode, without leaving the stage screen. The edited BPM takes effect immediately in the live metronome and is saved immediately to the source setlist in localStorage.

The control is intentionally hidden behind a long press on the BPM number so the primary Performance Mode interaction stays unchanged: tapping the BPM ring pauses or resumes the metronome.

## Goals

- Let a performer correct a song's tempo during rehearsal or a live set.
- Apply tempo changes immediately to the running metronome.
- Persist every adjustment immediately to the saved setlist.
- Preserve the existing ring tap behavior for pause/resume.
- Keep the Performance Screen dark, high-contrast, and usable with large touch targets.

## Non-goals

- Undo or revert for live tempo edits.
- A "saved" toast, badge, or confirmation message.
- MIDI, hardware media key, or keyboard bindings for tempo changes.
- Per-performance temporary BPM overrides.
- Editing any field other than BPM from Performance Mode.
- Changing every duplicate appearance of a song. A live edit only updates the currently loaded song entry by ID.

---

## Product Decisions

| Question | Decision |
|---|---|
| Persistence timing | Save immediately on every tempo step. |
| Saved scope | Update the source song in the setlist immediately. |
| Entry point | Long-press the BPM number/ring to open a compact tempo editor. |
| Step size | 1 BPM per adjustment. |
| BPM ring tap | Keep tap-to-pause/resume behavior. |
| Running metronome behavior | Apply BPM changes immediately with `metronome.setBpm()`. |
| Paused behavior | Allow BPM edits while paused; resume later at the edited tempo. |
| Undo/revert | None. |
| Save indication | None. |
| Hardware/MIDI | Not included. |

---

## Performance Screen UX

### Default state

The Performance Screen remains visually the same on entry:

- BPM ring remains the central pause/resume control.
- Tapping the ring pauses or resumes playback.
- Current BPM is displayed inside the ring.

### Opening the tempo editor

Long-pressing the BPM number/ring opens a compact tempo editor. The long-press target should be the existing BPM ring button area so it is easy to hit on stage, but the gesture should be described in code and tests as opening the editor from the BPM display.

Recommended threshold: about 2000 ms.

The implementation must prevent the long-press release from toggling pause/resume. A completed long press opens the editor only.

### Compact editor layout

Render the editor directly in Performance Screen, near the BPM ring, without navigating away or covering the whole screen.

Recommended shape:

```text
[ - ]   124 BPM   [ + ]
```

Requirements:

- `-` and `+` controls are large touch targets, at least 44 px in both dimensions.
- The current BPM remains visible while editing.
- Step size is always 1 BPM.
- Controls clamp to `BPM_MIN` and `BPM_MAX` from `src/lib/types.ts`.
- Disable the decrement control at `BPM_MIN`.
- Disable the increment control at `BPM_MAX`.
- The editor can be dismissed by tapping outside it, pressing Escape, exiting Performance Mode, or changing songs.

No explicit Save, Done, Undo, Revert, or Saved state is shown.

### While running

Each `-` or `+` tap:

1. Calculates the clamped BPM.
2. Updates the current Performance Store song state.
3. Calls `metronome.setBpm(nextBpm)` immediately.
4. Persists the updated song to `setlistsStore` / localStorage immediately.

The metronome engine already supports seamless tempo changes via `setBpm`. The scheduling model is unchanged: timers may drive scheduler polling, but audible clicks continue to be scheduled on Web Audio time.

### While paused

Tempo editing works the same way while paused, except the metronome remains paused. When playback resumes, the metronome resumes at the edited BPM.

### Song navigation

When the user taps PREV or NEXT:

- Close the compact tempo editor.
- Navigate to the target song.
- Use that target song's latest persisted BPM.

If the current song was edited before navigation, the new BPM remains saved.

---

## State And Persistence

### Source of truth

The persisted setlist remains the source of truth for song BPM. Performance Mode should not create a separate temporary override model.

### `setlistsStore`

Add a focused helper for updating only a song's BPM:

```ts
updateSongBpm(setlistId: string, songId: string, bpm: number): void
```

This helper should:

- Clamp BPM to `BPM_MIN` / `BPM_MAX`, or receive an already-clamped value from the caller and still avoid invalid data.
- Find the matching setlist by ID.
- Find the matching song by ID.
- Replace only that song object with `{ ...song, bpm }`.
- Persist through the existing `updateAll()` path.
- Leave all other setlists and songs unchanged.

Using a narrow helper avoids reconstructing a full song object in Performance Mode and makes the persistence intent obvious.

### `performanceStore`

Add a method similar to:

```ts
adjustCurrentSongBpm(delta: number): void
```

Responsibilities:

- No-op when no setlist or current song is loaded.
- Clamp the next BPM to `BPM_MIN` / `BPM_MAX`.
- No-op if the clamped BPM equals the current BPM.
- Call `metronome.setBpm(nextBpm)` immediately.
- Persist with `setlistsStore.updateSongBpm(setlist.id, song.id, nextBpm)`.
- Update the in-memory performance state so the displayed BPM changes immediately.
- Preserve `songIndex`, `running`, and `paused`.

The store should update its loaded setlist snapshot after persistence so subsequent PREV/NEXT navigation uses the adjusted BPM without requiring a full app reload.

### Data model

No new persisted fields are required. The existing `Song.bpm` field is updated in place.

---

## Component Changes

### `src/components/PerformanceScreen.svelte`

Add local UI state for the compact editor:

- `tempoEditorOpen`
- long-press timer handle

Add pointer/touch handling to the BPM ring:

- Start a long-press timer on pointer down.
- Cancel the timer on pointer cancel, pointer leave, or short pointer up.
- If the timer completes, open the editor and suppress the following click/pause action.

Keep the existing `onclick={handlePauseResume}` behavior for normal taps.

Add editor controls that call:

```ts
performanceStore.adjustCurrentSongBpm(-1)
performanceStore.adjustCurrentSongBpm(1)
```

Use `BPM_MIN` and `BPM_MAX` to calculate disabled states.

### Styling

The editor should inherit the dark Performance Screen tone:

- No bright card or modal.
- High contrast text.
- Large circular or square icon buttons.
- Stable dimensions so opening the editor does not push critical controls off-screen on small mobile viewports.

The editor should not obscure PREV/NEXT or the pause/resume ring.

---

## Accessibility

- BPM ring keeps an accessible label for pause/resume.
- Tempo editor buttons use explicit labels:
  - `aria-label="Decrease tempo"`
  - `aria-label="Increase tempo"`
- Disabled min/max controls must use actual `disabled` attributes.
- Escape closes the tempo editor.
- The BPM value should remain readable by assistive technology while editing.

Long press is not very discoverable, but it keeps the stage UI clean. Because this feature is an advanced live adjustment, the tradeoff is acceptable for the first version.

---

## Edge Cases

- Empty setlist: long press and tempo adjustment no-op.
- Missing current song: no-op.
- BPM at 20: decrement disabled/no-op.
- BPM at 300: increment disabled/no-op.
- Paused metronome: BPM persists and is used on resume.
- Duplicate song names or repeated entries: update only the current song ID.
- Exiting Performance Mode with editor open: close editor as part of component teardown.
- Unsupported AudioContext: persistence still updates state, but the noop metronome remains silent as today.

---

## Files To Change

| File | Change |
|---|---|
| `src/stores/setlists.ts` | Add `updateSongBpm(setlistId, songId, bpm)` helper. |
| `src/stores/performance.ts` | Add `adjustCurrentSongBpm(delta)` and keep performance state synchronized with persisted setlist updates. |
| `src/components/PerformanceScreen.svelte` | Add long-press handling and compact tempo editor UI. |
| `src/tests/performance.test.ts` | Add focused store tests for live BPM adjustment and paused behavior. |
| `src/tests/storage.test.ts` or new store test | Add persistence test for `setlistsStore.updateSongBpm`. |

No changes are required in `src/lib/metronome.ts` because `setBpm()` already exists.

---

## Testing

### Unit tests

- `performanceStore.adjustCurrentSongBpm(1)` updates the displayed current song BPM.
- `performanceStore.adjustCurrentSongBpm(-1)` updates the displayed current song BPM.
- Adjustment persists to `localStorage` through the setlists store.
- Adjustment clamps at `BPM_MIN` and `BPM_MAX`.
- Adjustment while paused preserves `paused: true` and `running: false`.
- Adjustment on an empty setlist no-ops.
- PREV/NEXT after an adjustment sees the latest edited BPM when returning to the song.

### Manual checks

- Enter Performance Mode on a mobile-sized viewport.
- Tap the BPM ring: metronome pauses/resumes as before.
- Long-press the BPM ring: compact tempo editor opens and playback does not toggle.
- Tap `+`: audible tempo increases immediately and the BPM display increments by 1.
- Tap `-`: audible tempo decreases immediately and the BPM display decrements by 1.
- Pause playback, adjust tempo, resume: playback resumes at the edited tempo.
- Exit Performance Mode and reopen the setlist: edited BPM is still present.
- Reload the app offline: edited BPM is still present.

### Verification commands

For implementation:

```bash
npm run check
npm test -- --run
```

Run `npm run build` if the implementation touches PWA, Vite, or production-bundle-sensitive paths. This feature is expected to avoid those areas.

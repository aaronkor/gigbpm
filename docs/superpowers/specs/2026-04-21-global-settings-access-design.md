# Global Settings Access - Design Spec

**Date:** 2026-04-21  
**Status:** Draft

## Overview

Make the full app Settings screen available from every primary screen in GigBPM:

- Setlist List
- Setlist Editor
- Performance Screen

The Settings screen remains the existing full-screen settings experience. The new behavior adds a consistent top-right gear entry point on every screen and preserves the user's originating screen when they leave Settings.

Settings continue to apply immediately. In Performance Mode, the metronome keeps running while the user visits Settings, and any live-relevant settings such as click sound, click channel, performance mode, TTS, or MIDI take effect as soon as they are changed.

## Goals

- Provide a consistent settings entry point from every screen.
- Keep the Settings UI as the full existing screen for this version.
- Return users to the same originating screen after closing Settings.
- Preserve live performance continuity: entering Settings from Performance Screen must not stop, pause, reset, or exit the metronome.
- Apply all settings immediately, matching current Settings behavior.
- Present the full settings set regardless of where Settings was opened from.

## Non-goals

- Redesigning Settings as a modal, drawer, bottom sheet, or reusable panel.
- Creating a reduced or stage-only settings subset for Performance Screen.
- Adding Done, Save, Cancel, or revert behavior to Settings.
- Adding confirmation prompts before opening Settings from Performance Screen.
- Changing the settings data model.
- Persisting additional navigation state beyond what is needed to return from Settings.

---

## Product Decisions

| Question | Decision |
|---|---|
| Entry point | Gear/settings button appears at the top-right corner on all primary screens. |
| Settings presentation | Use the existing full Settings screen. |
| Settings scope | Show all settings regardless of originating screen. |
| Apply behavior | Settings apply immediately on change. |
| Closing Settings | Return to the same originating screen. |
| Performance metronome | Keep running while Settings is open. |
| Performance state | Do not stop, pause, reset, or exit Performance Mode when opening Settings. |
| Install settings | Continue showing install-related settings when supported, regardless of origin. |
| Accidental-touch protection | None for this version. |

---

## Navigation Model

### Current model

`src/App.svelte` currently uses a single `screen` state:

```ts
type Screen =
  | { name: 'setlist-list' }
  | { name: 'setlist-editor'; setlist: Setlist }
  | { name: 'performance' }
  | { name: 'settings' }
```

The current Settings route does not remember where it was opened from. Its back action always returns to Setlist List.

### New model

Settings should remember the originating screen. Recommended shape:

```ts
type PrimaryScreen =
  | { name: 'setlist-list' }
  | { name: 'setlist-editor'; setlist: Setlist }
  | { name: 'performance' }

type Screen =
  | PrimaryScreen
  | { name: 'settings'; returnTo: PrimaryScreen }
```

Opening Settings should set:

```ts
screen = { name: 'settings', returnTo: currentPrimaryScreen }
```

Closing Settings should set:

```ts
screen = screen.returnTo
```

This keeps the Settings screen full-screen while preserving the user's prior app context.

### State preservation

Returning from Settings should restore the same primary screen. The required preservation level is:

- Setlist List: return to Setlist List.
- Setlist Editor: return to the same setlist editor instance.
- Performance Screen: return to Performance Screen with the current performance store state.

Local component UI state that is destroyed by full-screen navigation does not need special preservation for this version. Examples include expanded accordions, transient inline editors, temporary popovers, and similar component-local UI state.

The important live state is owned by stores and must remain intact:

- current performance setlist
- current song index
- running/paused state
- current BPM, including any already-persisted live tempo edits
- metronome instance state

---

## Screen UX

### Shared top-right gear behavior

Every primary screen should expose a settings button in the top-right corner.

Requirements:

- Use a consistent gear affordance across screens.
- Use `aria-label="Settings"`.
- Keep the button target stage-friendly, at least 44 px in both dimensions where layout allows.
- Opening Settings must not mutate app data.
- Opening Settings must not trigger install prompts, audio preview, MIDI learn, or any other side effect.

### Setlist List

The Setlist List already has a top-right Settings gear. Behavior changes only in routing:

- Opening Settings stores `returnTo: { name: 'setlist-list' }`.
- Closing Settings returns to Setlist List.

### Setlist Editor

Add a top-right Settings gear to the Setlist Editor header.

Recommended header shape:

```text
[ Back ]        [ setlist title ]        [ gear ]
```

Requirements:

- The existing back control remains available.
- The setlist title editing behavior remains unchanged.
- Opening Settings should not save or cancel unrelated song edits unless current component behavior already does so during unmount.
- Closing Settings returns to the same setlist editor route for the same setlist.

### Performance Screen

Add the Settings gear at the top-right corner of the Performance Screen.

Because the top-right corner is currently occupied by the Exit button, the Performance Screen top row should be adjusted to include both Settings and Exit while keeping Settings consistently top-right.

Recommended top row:

```text
[ TTS ]        [ logo ]        [ exit ] [ gear ]
```

The Settings gear should be the rightmost top-row control. The Exit button remains visible near it.

Requirements:

- Keep the existing TTS toggle available when `speechSynthesis` is supported.
- Keep the existing Exit control available.
- Do not open Settings as a modal overlay.
- Do not pause or stop the metronome when Settings opens.
- Do not release Performance Mode state on Settings open.
- If Performance Mode wake lock is enabled, keep the current behavior as stable as browser APIs allow. Returning from Settings should not require the performer to restart Performance Mode.

---

## Settings Screen Behavior

The Settings screen continues to display all currently supported sections:

- App / Install App, when applicable
- Audio
- Performance
- General / Announce song name, when TTS is available
- MIDI, when Web MIDI is available

No sections are hidden based on origin. For example, opening Settings from Performance Screen still shows install settings when the browser supports them.

### Immediate application

Every settings control continues to persist and apply immediately:

- TTS toggle updates `announceSongName` immediately.
- Click Sound updates the live metronome immediately.
- Custom click sound changes update the live metronome immediately.
- Click Channel updates the live metronome immediately.
- Performance Mode updates wake-lock and DND reminder behavior immediately.
- MIDI enabled/bindings update MIDI behavior immediately.

Settings close/back behavior does not commit or cancel anything. It only navigates back to the origin screen.

### Live metronome behavior

When Settings is opened from Performance Screen:

- The metronome keeps running if it was running.
- The metronome remains paused if it was paused.
- Changing click sound/channel/custom sound affects subsequent scheduled clicks through the existing settings-to-metronome synchronization.
- Exiting Settings returns to the same Performance Screen session.

The implementation must preserve the metronome timing constraint from the main product spec: audible clicks continue to be scheduled using Web Audio API time. Navigation to Settings must not introduce `setInterval` or `setTimeout` click scheduling.

---

## Component Changes

### `src/App.svelte`

Update screen routing to store the Settings return target.

Add a helper such as:

```ts
function openSettings(returnTo: PrimaryScreen): void {
  screen = { name: 'settings', returnTo }
}
```

When rendering Settings:

```svelte
<Settings
  onBack={() => {
    screen = screen.returnTo
  }}
  installPromptEvent={installPrompt}
/>
```

The exact implementation can vary, but the invariant is that Settings back returns to the captured primary screen.

### `src/components/SetlistList.svelte`

Keep the existing top-right Settings button. It should call the app-level open-settings handler with Setlist List as the return target.

### `src/components/SetlistEditor.svelte`

Add an `onOpenSettings` prop.

Render a top-right Settings gear in the editor header. The header should remain usable on narrow mobile screens and should not break tap-to-edit setlist title behavior.

### `src/components/PerformanceScreen.svelte`

Add an `onOpenSettings` prop.

Render a top-right Settings gear in the top row. Since Exit currently occupies the right slot, adjust the top row so both Exit and Settings are reachable and Settings is visually rightmost.

Opening Settings must not call:

- `performanceStore.exit()`
- `performanceStore.pause()`
- `performanceStore.stop()`
- `onExit()`

### `src/components/Settings.svelte`

No behavior redesign is required.

Optional naming refinement: the current `onBack` prop can remain, or it can be renamed later if a broader navigation vocabulary is introduced. For this feature, keeping `onBack` is sufficient.

---

## Styling Requirements

- Settings gear placement should be visually consistent: top-right corner on each primary screen.
- Top-right controls must not overlap safe-area insets on mobile.
- Performance Screen must remain dark, high-contrast, and stage-readable.
- Adding the Performance Screen gear must not crowd or obscure:
  - TTS toggle
  - logo
  - Exit button
  - DND banner
  - song info
  - BPM ring
  - PREV/NEXT controls
- On narrow mobile widths, header controls should maintain stable dimensions and avoid text overlap.

---

## Accessibility

- Every Settings entry point uses `aria-label="Settings"`.
- The Settings screen back control should continue to be reachable by keyboard and screen readers.
- Performance Screen must preserve accessible labels for TTS, Exit, BPM pause/resume, PREV, and NEXT.
- The new gear button must be keyboard-focusable.
- Focus management can follow existing full-screen route behavior for this version; explicit focus restoration is not required unless the implementation introduces a modal or custom focus trap.

---

## Edge Cases

| Case | Expected behavior |
|---|---|
| Open Settings from Performance while running | Metronome continues running. |
| Open Settings from Performance while paused | Metronome remains paused. |
| Change click sound while Performance is running | Subsequent clicks use the new sound immediately. |
| Change custom sound sliders while Performance is running | Subsequent clicks reflect updated custom params immediately. |
| Change click channel while Performance is running | Subsequent clicks use the new channel immediately. |
| Toggle Performance Mode off while in Settings from Performance | Wake lock is released by existing Performance Screen behavior; returning to Performance keeps the session active. |
| Toggle Performance Mode on while in Settings from Performance | Wake lock behavior activates if supported; returning to Performance keeps the session active. |
| Browser lacks TTS | Announce setting remains hidden as today. |
| Browser lacks Web MIDI | MIDI settings remain hidden as today. |
| Browser does not support install prompt | Install setting behavior remains as today. |
| Press Settings then Back from Setlist Editor | Return to the same setlist editor route. |
| Press Settings then Back from Performance | Return to the same active Performance Screen session. |

---

## Testing

### Unit / component-level coverage

Add focused tests if existing component test infrastructure supports it. Priorities:

- App routing captures Settings return target from each primary screen.
- Settings back returns to Setlist List when opened from Setlist List.
- Settings back returns to Setlist Editor with the same setlist when opened from Setlist Editor.
- Settings back returns to Performance without calling `performanceStore.exit()`.

### Existing store tests

No new settings storage fields are required. Existing storage tests should continue to pass.

### Verification commands

Run:

```sh
npm run check
npm test -- --run
```

Run `npm run build` if implementation touches PWA config, install prompt behavior, or production bundle assumptions beyond component routing.

### Manual browser checks

Manual inspection is required because this is navigation and UI placement work:

- Mobile-sized viewport: Setlist List shows Settings at top-right and returns correctly.
- Mobile-sized viewport: Setlist Editor shows Settings at top-right, title remains usable, and back returns to editor.
- Mobile-sized viewport: Performance Screen shows Settings at top-right without crowding Exit or TTS.
- Start Performance Mode, confirm metronome is running, open Settings, change Click Sound, return to Performance, and confirm the session did not reset.
- While Performance is running, change Click Channel and Custom sound params from Settings and confirm subsequent clicks reflect the changes.

---

## Implementation Notes

- Prefer routing changes in `src/App.svelte` over duplicating Settings component instances inside individual screens.
- Keep `src/lib/metronome.ts` unchanged unless a bug is discovered; this feature should rely on existing settings-to-metronome synchronization.
- Avoid adding new persisted state.
- Avoid introducing network dependencies or backend behavior.
- Do not edit generated `dist/` output.

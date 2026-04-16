# GigBPM Dev Log

## Session Summary

This session implemented GigBPM from the provided spec and plan through Chunk 6.

Completed work:

- Chunk 1 / Foundation
  - Scaffolded the app with Svelte 5, Vite, TypeScript, Vitest, and `vite-plugin-pwa`
  - Added shared product-model types in `src/lib/types.ts`
  - Added localStorage persistence in `src/lib/storage.ts` with tests
- Chunk 2 / Core engines
  - Added `src/lib/metronome.ts` with Web Audio lookahead scheduling
  - Added `src/lib/tts.ts`
  - Added `src/lib/midi.ts`
  - Added tests for metronome, TTS, and MIDI
- Chunk 3 / App state and routing
  - Added `src/stores/setlists.ts`
  - Added `src/stores/settings.ts`
  - Added `src/stores/performance.ts`
  - Replaced the single scaffold view with screen switching in `src/App.svelte`
- Chunk 4 / Core screens
  - Added `src/components/Toast.svelte`
  - Implemented `src/components/SetlistList.svelte`
  - Implemented `src/components/SetlistEditor.svelte`
  - Implemented `src/components/SongEditor.svelte` with tap tempo
- Chunk 5 / Performance and settings UI
  - Implemented `src/components/PerformanceScreen.svelte`
  - Implemented `src/components/Settings.svelte`
  - Fixed `App.svelte` performance exit flow so the store is not stopped twice
- Chunk 6 / Import-export and PWA assets
  - Added `src/lib/importexport.ts`
  - Added `src/tests/importexport.test.ts`
  - Wired real import/export into `src/components/SetlistList.svelte`
  - Added `public/icons/192.png`, `public/icons/512.png`, and `public/icons/icon.svg`
  - Verified production build output and PWA artifacts

User-reported validation:

- The Task 19 smoke test was run by the user after implementation.

## Key Decisions

- Stayed on Svelte 5 + Vite + TypeScript as required.
- Used no router library. `src/App.svelte` switches screens via a reactive `screen` variable.
- Kept business logic out of Svelte components where possible:
  - metronome logic in `src/lib/metronome.ts`
  - MIDI logic in `src/lib/midi.ts`
  - TTS logic in `src/lib/tts.ts`
  - import/export logic in `src/lib/importexport.ts`
  - persistence in `src/lib/storage.ts`
- Used Svelte stores in plain `.ts` modules instead of the plan's `$state`-style pseudocode for stores. This was necessary because the plan sketch was not valid as framework-independent TypeScript store code.
- Kept metronome click scheduling on `AudioContext.currentTime` with lookahead scheduling. No timer-based click scheduling was introduced.

## Important Learnings

### 1. Plan mismatches existed and had to be resolved carefully

- Chunk 4's Setlist List sketch referenced import/export logic before the plan actually introduced that module in Chunk 6.
- The safe approach was:
  - first keep the UI working without dragging later business logic forward
  - then wire the real import/export module in Chunk 6 once the plan reached it

### 2. Store design matters more than the plan pseudocode

- Plain `.ts` files should use real Svelte stores, not rune-like pseudocode from design notes.
- The current store design is stable and compile-safe:
  - `setlistsStore` persists all setlist mutations
  - `settingsStore` persists feature flags and MIDI bindings
  - `performanceStore` owns metronome, current setlist state, pause/resume, looping next-song behavior, and MIDI enablement for performance mode

### 3. Performance screen cleanup is important

- `PerformanceScreen` must unregister its beat callback and media session handler on destroy.
- `App.svelte` should not also call `performanceStore.exit()` if `PerformanceScreen` already does it before `onExit()`.

### 4. MIDI learn mode needs explicit cleanup

- The settings screen must cancel learn mode if the user disables MIDI while learning.
- The learn-only MIDI controller in `Settings.svelte` should also be disabled on component destroy.

### 5. Svelte 5 warnings were worth fixing immediately

- Initial screen implementations surfaced warnings around:
  - captured initial values
  - autofocus usage
  - non-reactive `bind:this` targets
- Fixing those early kept `npm run check` clean and prevented avoidable rework later.

### 6. Local environment/tooling constraints affected implementation

- `vite-plugin-pwa@1.2.0` was not compatible with Vite 8, so the project was pinned to Vite 7 while keeping the required stack intact.
- PWA icon generation needed local-tool adaptation:
  - `magick` and `inkscape` were unavailable
  - `sips` could not rasterize the SVG directly
  - `qlmanage` successfully generated a PNG thumbnail, which was then resized with `sips`

### 7. Sandbox behavior matters for verification

- Some localhost serve checks and process control required elevated permissions.
- Preview/build verification succeeded, but localhost reachability sometimes had to be tested from the same elevated side that started the process.

## Verification Performed

Repeatedly verified throughout the session with:

- `npm run check`
- `npx vitest run`
- `npx vitest run src/tests/importexport.test.ts`
- `npm run build`
- `npm run preview -- --host 127.0.0.1`

Verified build artifacts included:

- `dist/manifest.webmanifest`
- `dist/sw.js`
- Workbox output

Verified the served preview returned `200` for:

- `/`
- `/sw.js`
- `/manifest.webmanifest`

## Notable Commits From This Session

- `280a7bf` `feat: add Toast component`
- `c17ff21` `feat: add SetlistList screen`
- `594ddf8` `feat: add SetlistEditor screen`
- `c98ff36` `feat: add SongEditor bottom sheet with tap tempo`
- `e8c0c5a` `fix: resolve Chunk 4 Svelte warnings`
- `a2cc51a` `feat: add PerformanceScreen with beat halo and controls`
- `f9cd9b8` `feat: add Settings screen with TTS and MIDI CC learn`
- `0d7954a` `feat: add import/export module with JSON validation`
- `561b7f4` `feat: add PWA icons and verify installable offline build`

## Reference For Future Sessions

- Keep all new business logic in framework-independent modules unless there is a strong reason not to.
- Preserve the no-router architecture in `App.svelte`.
- Preserve localStorage-only persistence unless the product direction changes explicitly.
- Do not replace the metronome scheduler with `setInterval` or `setTimeout`-driven click timing.
- When touching performance flow, test:
  - enter performance
  - next song BPM switch
  - loop from last song to first
  - pause/resume
  - exit cleanup
- When touching settings, test:
  - persistence across reload
  - MIDI learn start/cancel/clear
  - hidden sections on unsupported browsers
- When touching import/export, test:
  - malformed JSON rejection
  - imported IDs regenerated
  - export payload strips IDs

## Current State At End Of Session

- Chunks 1 through 6 are implemented.
- User reported running the Task 19 smoke test.
- The repo was clean before this log file was added.

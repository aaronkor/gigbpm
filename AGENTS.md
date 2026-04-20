# GigBPM

GigBPM is a mobile-first PWA for musicians to manage setlists and run a live
metronome across a performance. Treat the app as stage-use software: timing,
readability, offline behavior, and large touch targets matter more than
decorative UI.

Full product source of truth:
`docs/superpowers/specs/2026-04-16-gigbpm-design.md`

The root `README.md` still contains Vite template text; do not use it as the
product spec.

## Core Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build production bundle: `npm run build`
- Preview production bundle: `npm run preview`
- Type-check Svelte and TypeScript: `npm run check`
- Run tests in watch mode: `npm test`
- Run tests once for verification: `npm test -- --run`

Before pushing to a remote, always run `npm version patch`.

## Project Layout

- `src/App.svelte` - top-level app shell and screen routing.
- `src/components/` - Svelte UI components for setlists, settings, song editing,
  performance mode, toasts, and logo display.
- `src/stores/` - app state stores for setlists, settings, and performance.
- `src/lib/` - framework-independent domain logic: metronome, storage, MIDI,
  TTS, import/export, and shared types.
- `src/tests/` - Vitest tests, configured through `vite.config.ts` with `jsdom`.
- `public/` and `src/assets/` - PWA icons and UI assets.
- `dist/` - generated production output; do not edit by hand.

## Architecture Overview

The app is Svelte 5 + Vite + TypeScript with `vite-plugin-pwa` and Workbox.
It is fully offline and uses `localStorage` only. There is no backend, no sync,
and no account model.

Main runtime capabilities:
- Web Audio API metronome with lookahead scheduling.
- Web Speech API for optional song-name announcements.
- Web MIDI API for optional MIDI CC bindings. Hide MIDI affordances on browsers
  without support, especially iOS Safari.
- Screen Wake Lock when Performance Mode is enabled and available.
- Web Share API with file-download fallback for setlist sharing/export.

Storage keys:
- `gigbpm_setlists` stores `Setlist[]`.
- `gigbpm_settings` stores `AppSettings`.
- `gigbpm_install_dismissed` stores install-banner UI dismissal state.

## Critical Constraints

- Metronome timing accuracy is the top requirement. Schedule audible clicks with
  Web Audio API time (`AudioContext.currentTime`) using lookahead scheduling.
- Never trigger metronome clicks directly with `setInterval` or `setTimeout`.
  Timers may only drive scheduler polling; the actual click time must be audio
  context time.
- Keep `src/lib/metronome.ts` independent of Svelte.
- On iOS, expect `AudioContext` to require a user gesture; resume suspended
  contexts on interaction.
- Preserve offline-first behavior. Do not add network dependencies, backend
  calls, analytics, or cloud sync unless the feature explicitly requires it.
- Keep data device-local and serializable as JSON for import/export.
- Performance screen UI must remain dark, high-contrast, touch-friendly, and
  readable on stage.

## Conventions & Patterns

- Use TypeScript and Svelte 5 patterns already present in the codebase.
- Prefer small domain helpers in `src/lib/` when behavior can be tested without
  Svelte.
- Keep user-facing behavior aligned with the design spec before inventing new
  flows.
- Validate imported JSON structure before writing to storage. Invalid imports
  should not mutate saved data.
- Handle optional browser APIs silently when unsupported:
  `speechSynthesis`, Web MIDI, Wake Lock, install prompts, and Web Share.
- Keep generated IDs collision-safe with `crypto.randomUUID()` where available
  or the existing project fallback pattern.
- Avoid adding runtime dependencies without documenting why they are necessary.

## Testing & Verification

For most code changes, run:
- `npm run check`
- `npm test -- --run`

Also run `npm run build` when touching PWA configuration, assets, Vite config,
or code paths that may affect the production bundle.

For timing, storage, MIDI, TTS, import/export, or performance-mode changes,
add or update focused tests under `src/tests/`.

For UI changes, manually inspect the affected screen in a browser, including a
mobile-sized viewport when the change affects performance mode or setlist flows.

## Git Workflow

- Keep diffs focused on the requested change.
- Do not edit generated `dist/` output unless the task explicitly asks for it.
- Before pushing to remote, run `npm version patch`.
- Include verification evidence in PR or handoff notes: commands run, relevant
  tests, and any manual browser checks.


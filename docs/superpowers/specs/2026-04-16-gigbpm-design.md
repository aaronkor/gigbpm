# GigBPM — Product Design Specification

**Date:** 2026-04-16 (last updated 2026-04-17)
**Status:** Approved

---

## Overview

GigBPM is a mobile-first Progressive Web App (PWA) that helps musicians manage and run a live metronome across an entire performance set. Before a gig, the musician configures a named setlist of songs — each with a name and BPM. During the performance, the app runs a live audible and visual metronome and allows advancing to the next song's tempo with a single button tap, a hardware button, or a MIDI foot pedal.

---

## Goals

- Allow a musician to configure BPM for each song in a setlist before a performance
- Run a live, audible + visual metronome during the performance
- Advance to the next song's BPM instantly with minimal interaction
- Support multiple named setlists for different gigs
- Work fully offline, installable on a phone's home screen
- Support optional TTS song name announcement and MIDI foot pedal input

---

## Non-Goals

- Cloud sync or multi-device data sharing
- Time signatures or bar counting — steady click only
- Recording, playback, or audio mixing

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Svelte 5 + Vite |
| PWA | `vite-plugin-pwa` + Workbox (cache-first) |
| Audio | Web Audio API |
| TTS | Web Speech API (`speechSynthesis`) |
| MIDI | Web MIDI API |
| Storage | `localStorage` (JSON) |
| Language | TypeScript |

---

## Data Model

```ts
type ClickSound = 'wood' | 'beep' | 'tick'

interface Song {
  id: string        // crypto.randomUUID()
  name: string
  bpm: number       // 20–300
}

interface Setlist {
  id: string
  name: string
  songs: Song[]
}

interface MidiCCBinding {
  channel: number | 'any'   // MIDI channel 1–16, or 'any'
  cc: number                 // CC number 0–127
}

interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound      // default: 'wood'
  performanceMode: boolean    // default: false
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}
```

**Storage keys:**
- `gigbpm_setlists` → `Setlist[]` (JSON)
- `gigbpm_settings` → `AppSettings` (JSON)
- `gigbpm_install_dismissed` → `'true'` if the user has permanently dismissed the install banner (UI state, not part of AppSettings)

---

## Screens

### 1. Setlist List

The home screen. Shows all saved setlists and an install banner when appropriate.

- Each setlist row shows name + song count, with a **▼ arrow button** on the right
- Tapping ▼ expands an action strip (Rename / Share / Export / Delete); arrow flips to ▲ to collapse
- Accordion behaviour: only one row expanded at a time; expanding a new row auto-collapses the previous
- Tapping Rename collapses the action strip and activates an inline rename input for that row
- **Share** — uses Web Share API to share the setlist as a JSON file; falls back to file download if unsupported
- **Export** — downloads the setlist as a JSON file directly
- "+ New Setlist" button → creates a new empty setlist and opens Setlist Editor
- "Import" button → file picker for `.json` setlist files
- Gear icon (top right) → Settings screen
- **Install banner** (shown below the list when the app is installable and not yet installed):
  - Shown if: `beforeinstallprompt` has fired (Chrome/Android) or the browser is iOS Safari, AND the app is not running in standalone mode, AND the user has not permanently dismissed it
  - "Add" button triggers the native install prompt (Chrome/Android) or opens manual iOS instructions
  - ✕ button permanently dismisses the banner (stored in `gigbpm_install_dismissed`)
  - Banner is never shown when running in standalone mode

### 2. Setlist Editor

Shows all songs in a setlist, in order.

- Header title is **tap-to-edit**: tapping the setlist name activates an inline input; saves on blur or Enter, cancels on Escape, reverts if cleared
- Songs listed with name and BPM
- Drag handle to reorder songs
- Tap a song → opens Song Editor bottom sheet (edit)
- Swipe to delete a song (with undo toast)
- "+ Add Song" button → opens Song Editor bottom sheet (new)
- "▶ Play" button → enters Performance Mode starting at song 1

### 3. Song Editor (Bottom Sheet)

Slides up over the Setlist Editor. Used for both adding and editing a song.

**Fields:**
- Song name — text input
- BPM — number input (typeable directly) with − / + buttons for fine adjustment (range 20–300)
- Tap Tempo button — tap repeatedly to detect BPM; averages last 4 tap intervals; locks in 2 seconds after last tap; BPM field updates live during tapping

**Actions:** Save / Cancel

### 4. Performance Screen

Full-screen, minimal UI optimised for dark stage environments.

**Layout (top to bottom):**
1. **Top row** — three-column grid: TTS icon button (left) · GigBPM logo (center) · Exit ✕ button (right)
2. **DND reminder banner** (shown when Performance Mode is on; dismissible per visit; never persisted)
3. **Song info**:
   - Position indicator: e.g. "2 / 6" (uppercase, muted; turns red when paused with "· PAUSED" suffix)
   - Song name (large, white, prominent; tappable to announce immediately when Announce Song Name is on)
   - Next song preview (smaller, muted; shows `<END>` after the last song)
4. **BPM ring** — large circle, vertically fills available space between song info and bottom row; **tapping the ring pauses or resumes the metronome**
   - Ring states:
     - **Idle/Running:** dim grey border
     - **On beat:** white border + multi-layer white glow halo (animates on each beat)
     - **Paused:** red border + soft red glow
   - Inside the ring: BPM number (large), "BPM" label, and a ❚❚ / ▶ hint (indicates tappability)
5. **Bottom row** — space-between layout:
   - **PREV** (left, small circle button) — advances to previous song; wraps from song 1 to last
   - **NEXT** (right, large green circle button) — advances to next song; wraps after the last song

**TTS toggle (top-left):**
- 🔊 icon, dimmed (25% opacity) when off, full opacity when on
- Tap to toggle `announceSongName` without leaving the screen
- Hidden if `speechSynthesis` is unavailable

**Behaviour:**
- Metronome starts automatically when Performance Mode is entered
- On PREV / NEXT: metronome immediately switches BPM; TTS announces song name if enabled
- After the last song, NEXT wraps back to song 1; before the first song, PREV wraps to the last
- **Performance Mode** (when toggled on in Settings):
  - Holds a Screen Wake Lock to keep the screen on (released on exit or when mode is toggled off; re-acquired when page becomes visible again)
  - Shows the DND reminder banner on each entry
- Hardware media `nexttrack` action mapped to NEXT; `previoustrack` mapped to PREV
- MIDI CC bindings (if configured) mapped to Next and Pause/Stop

### 5. Settings Screen

Accessible from the gear icon on the Setlist List screen. Sections in order:

**App** (shown only on installable browsers or iOS Safari; hidden if already in standalone mode)
- Install App — triggers native install prompt or shows iOS instructions

**General**
- Announce song name — toggle (uses `speechSynthesis`; hidden if API unavailable)

**Audio**
- Click Sound — 3-button segmented control: **Wood | Beep | Tick** (active selection highlighted with indigo accent)
- Preview button — fires one click immediately using the selected sound

**Performance** (always visible)
- Performance Mode — toggle; subtitle: "Keeps screen on and reminds you to enable Do Not Disturb"

**MIDI** (hidden on unsupported browsers)
- Enable MIDI input — toggle
- Next song binding — CC number display + "Learn" button (press pedal to capture channel + CC)
- Pause/Stop binding — CC number display + "Learn" button

---

## Metronome Engine

A standalone TypeScript module (`src/lib/metronome.ts`) with no Svelte dependency.

**Timing accuracy is the single most critical requirement of this module.** A metronome that drifts or stutters is worse than no metronome. Musicians depend on it as their tempo reference during live performance.

**Scheduling:** Uses `AudioContext` lookahead scheduling (~100ms ahead) — clicks are scheduled using `AudioContext.currentTime` rather than `setInterval`, ensuring click-perfect timing regardless of JS thread load. `setInterval` and `setTimeout` are explicitly forbidden for click scheduling due to their susceptibility to browser throttling and jitter.

**Click sounds** (three synthesized options, all pre-rendered to `AudioBuffer` via Web Audio API — no audio files):
| Key | Name | Character |
|---|---|---|
| `'wood'` | Wood | White noise burst, exponential decay ~150, 40ms — warm, percussive (default) |
| `'beep'` | Beep | 880 Hz sine, linear gain ramp to zero over 60ms — clean, electronic |
| `'tick'` | Tick | White noise burst through highpass filter (~8 kHz), 25ms — short, sharp, hi-hat-like |

**Visual sync:** Beat flash events are dispatched from the same scheduler loop, not from a separate timer, keeping audio and visual in sync.

**API:**
```ts
metronome.start(bpm: number): void
metronome.stop(): void
metronome.pause(): void
metronome.resume(): void
metronome.setBpm(bpm: number): void         // seamless BPM change mid-playback
metronome.setClickSound(sound: ClickSound): void  // takes effect on next scheduler iteration
metronome.onBeat(callback: () => void): void      // replaces any previously registered callback
```

**AudioContext:** On iOS, `AudioContext` requires a user gesture to start. The engine detects a suspended context and resumes it on the first user interaction (tap on Play).

---

## Import / Export

**Export (per setlist):**
- Triggered from the setlist action strip
- Serialises the setlist to JSON and triggers a file download via `URL.createObjectURL` + `<a download>`
- Filename: `setlist-{slugified-name}.json`

**Share (per setlist):**
- Triggered from the setlist action strip
- Uses Web Share API to share the JSON file via the native OS share sheet
- Falls back to file download if `navigator.canShare({ files })` returns false
- User cancelling the share sheet is handled silently

**Import:**
- "Import" button on the Setlist List screen
- `<input type="file" accept=".json">` file picker
- Validates structure (name string, songs array, each song has name + bpm)
- Generates new `id` values on import to avoid collisions
- On invalid file: shows error toast "Couldn't import setlist: invalid file"

**File format:**
```json
{
  "version": 1,
  "setlist": {
    "name": "Friday Jazz Gig",
    "songs": [
      { "name": "Autumn Leaves", "bpm": 120 },
      { "name": "Blue Bossa", "bpm": 95 }
    ]
  }
}
```

---

## Edge Cases

| Scenario | Handling |
|---|---|
| AudioContext suspended (iOS) | Resumed automatically on first user gesture |
| Phone call interrupts audio | Metronome pauses; user resumes manually |
| BPM typed out of range | Input clamped to 20–300 on blur |
| Empty setlist → Play tapped | "Play" button disabled until ≥ 1 song exists |
| iOS Web MIDI | MIDI settings section hidden; no error shown |
| `speechSynthesis` unavailable | Announce toggle and TTS button hidden silently |
| Malformed import JSON | Error toast shown; no data written |
| App already installed (standalone mode) | Install banner never shown; Settings row disabled |
| Browser doesn't support install (e.g. Firefox) | Banner and Settings install row both hidden |
| `navigator.wakeLock` unavailable | Wake lock request skipped silently |
| User cancels share sheet | AbortError swallowed silently |
| File sharing unsupported (e.g. desktop Chrome) | Share falls back to file download |

---

## Known Limitations

- **iOS Web MIDI:** The Web MIDI API is not supported in iOS Safari. Musicians using Bluetooth MIDI foot pedals on iPhone must use a third-party MIDI-capable browser or rely on the on-screen PREV/NEXT buttons and headphone remote.
- **Screen wake lock:** Available only when Performance Mode is enabled in Settings. With Performance Mode off, the screen may dim; the musician can tap to wake.
- **No cloud sync:** Setlists are device-local. Use export/import (or Share) to move setlists between devices.
- **localStorage unavailable:** If the browser blocks storage (e.g. private browsing with full quota), the app will fail silently on save. This edge case is out of scope for v1.

---

## Visual Design Principles

- Dark theme throughout (`#0a0a0a` background)
- High-contrast white text for readability on stage
- Three ring states (grey / white glow / red glow) communicate metronome state at a glance
- Large touch targets — NEXT button intentionally oversized relative to PREV
- BPM ring doubles as a large, easy-to-reach pause/resume target
- No animations beyond the beat halo flash — minimises distraction during performance
- Logo (syncopated beat-bar SVG mark) displayed in the performance screen header

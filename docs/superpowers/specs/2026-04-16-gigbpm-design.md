# GigBPM — Product Design Specification

**Date:** 2026-04-16  
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
- Tap-anywhere gesture to advance (button only)

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

---

## Screens

### 1. Setlist List

The home screen. Shows all saved setlists.

- Each setlist row shows name + song count
- Tap a setlist → navigate to Setlist Editor
- Long-press or swipe-reveal a setlist → options: Rename, Export JSON, Delete
- "+ New Setlist" button → creates a new empty setlist and opens Setlist Editor
- "Import" button → file picker for `.json` setlist files
- Gear icon (top right) → Settings screen

### 2. Setlist Editor

Shows all songs in a setlist, in order.

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
- Song position indicator: "2 / 6" + song name (white, prominent)
- BPM ring — large circle containing BPM number; ring state:
  - **Idle:** dim grey border
  - **On beat:** white border + multi-layer white glow halo (animates on each beat)
  - **Paused:** red border + soft red glow; "PAUSED" label in red
- Controls row:
  - **Pause/Resume** — small circle button (left); shows ⏸ when running, ▶ when paused
  - **Next** — large circle button (right, green); advances to next song; loops to song 1 after the last

**Behaviour:**
- Metronome starts automatically when Performance Mode is entered
- On "Next": metronome immediately switches to the next song's BPM; if `announceSongName` is enabled, TTS speaks the song name
- After the last song, "Next" loops back to song 1
- Screen timeout managed by OS (no wake lock)
- Hardware media `nexttrack` action (headphone remote / some Bluetooth pedals) mapped to Next
- MIDI CC bindings (if configured) mapped to Next and Pause/Stop

### 5. Settings Screen

Accessible from the gear icon on the Setlist List screen.

**General**
- Announce song name — toggle (uses `speechSynthesis`; hidden if API unavailable)

**MIDI** (hidden on unsupported browsers)
- Enable MIDI input — toggle
- Next song binding — CC number display + "Learn" button (press pedal to capture channel + CC)
- Pause/Stop binding — CC number display + "Learn" button

---

## Metronome Engine

A standalone TypeScript module (`src/lib/metronome.ts`) with no Svelte dependency.

**Scheduling:** Uses `AudioContext` lookahead scheduling (~100ms ahead) — clicks are scheduled using `AudioContext.currentTime` rather than `setInterval`, ensuring click-perfect timing regardless of JS thread load.

**Click sound:** Synthesized woodblock — short filtered noise burst via Web Audio API nodes (no audio file required).

**Visual sync:** Beat flash events are dispatched from the same scheduler loop, not from a separate timer, keeping audio and visual in sync.

**API:**
```ts
metronome.start(bpm: number): void
metronome.stop(): void
metronome.pause(): void
metronome.resume(): void
metronome.setBpm(bpm: number): void   // seamless BPM change mid-playback
metronome.onBeat(callback: () => void): void
```

**AudioContext:** On iOS, `AudioContext` requires a user gesture to start. The engine detects a suspended context and resumes it on the first user interaction (tap on Play).

---

## Import / Export

**Export (per setlist):**
- Triggered from the setlist options menu
- Serialises the setlist to JSON and triggers a file download via `URL.createObjectURL` + `<a download>`
- Filename: `setlist-{slugified-name}.json`

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
| `speechSynthesis` unavailable | Announce toggle hidden silently |
| Malformed import JSON | Error toast shown; no data written |

---

## Known Limitations

- **iOS Web MIDI:** The Web MIDI API is not supported in iOS Safari. Musicians using Bluetooth MIDI foot pedals on iPhone must use a third-party MIDI-capable browser or rely on the on-screen Next button and headphone remote.
- **No wake lock:** The screen may dim during performance. This is intentional — the OS manages it, and the musician can tap to wake.
- **No cloud sync:** Setlists are device-local. Use export/import to move setlists between devices.

---

## Visual Design Principles

- Dark theme throughout (`#0a0a0a` background)
- High-contrast white text for readability on stage
- Three ring states (grey / white glow / red glow) communicate metronome state at a glance
- Large touch targets — Next button intentionally oversized relative to Pause
- No animations beyond the beat halo flash — minimises distraction during performance

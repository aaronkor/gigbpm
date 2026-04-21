# GigBPM

A mobile-first Progressive Web App for musicians who need a reliable metronome across an entire live set.

Build your setlist before the gig — each song gets a name and a BPM. On stage, the metronome starts immediately and you advance to the next song's tempo with a single tap, a headphone remote button, or a MIDI foot pedal.

---

## Features

**Setlist management**
- Multiple named setlists — one per venue, band, or genre
- Add, reorder (drag-and-drop), and delete songs
- Each song stores a name and BPM (20–300)
- Tap Tempo button: tap the beat to detect BPM automatically
- Import and export setlists as JSON; share via the OS share sheet

**Live metronome**
- Web Audio API lookahead scheduling — no drift, no jitter, no browser throttle
- Three synthesized click sounds: Wood (warm), Beep (clean), Tick (sharp hi-hat)
- Visual beat ring: grey at rest → white glow on beat → red when paused
- Tap the ring to pause or resume; long-press to edit the current song's tempo in place

**Navigation**
- NEXT / PREV buttons to jump between songs instantly
- Hardware headphone media keys (next track / previous track)
- MIDI CC foot pedal bindings (learn mode — press the pedal to capture channel + CC)

**Performance Mode**
- Screen Wake Lock keeps the display on throughout the set
- Do Not Disturb reminder banner on entry
- TTS song name announcement (optional, toggle on the fly)

**PWA — fully offline**
- Installable to the home screen on iOS and Android
- Works without a network connection after first load
- All data stored locally in `localStorage` — no account, no sync, no server

---

## Installation (as an app)

GigBPM is a PWA — install it directly from the browser, no app store needed.

**Android (Chrome):** tap the "Add to Home Screen" banner or use the browser menu → *Install App*.

**iOS (Safari):** tap the Share icon → *Add to Home Screen*.

After installation the app runs in standalone mode (full screen, no browser chrome) and works fully offline.

---

## Developer Guide

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/gigbpm.git
cd gigbpm
npm install
```

### Development server

```bash
npm run dev        # localhost only
npm run host       # exposed on the local network (useful for testing on a real phone)
```

### Type checking

```bash
npm run check
```

### Tests

```bash
npm test           # watch mode
npm test -- --run  # single run (CI)
```

### Production build

```bash
npm run build
npm run preview    # serve the built output locally
```

The build output is in `dist/`. It includes the service worker and PWA manifest — any static host works (Vercel, Netlify, GitHub Pages, etc.).

## Architecture

| Layer | Choice |
|---|---|
| Framework | Svelte 5 + Vite |
| PWA | `vite-plugin-pwa` + Workbox (cache-first) |
| Audio | Web Audio API |
| TTS | Web Speech API |
| MIDI | Web MIDI API |
| Storage | `localStorage` (JSON) |
| Language | TypeScript |

**Metronome accuracy** is the single most critical requirement. Clicks are scheduled using `AudioContext.currentTime` lookahead (~100 ms), never `setInterval` or `setTimeout`. The metronome module (`src/lib/metronome.ts`) has no Svelte dependency and can be unit-tested in isolation.

**Click sounds** are synthesized entirely in the Web Audio API — no audio files are loaded or bundled.

**State** lives in Svelte stores:
- `src/stores/setlists.ts` — all setlists, persisted to `localStorage`
- `src/stores/settings.ts` — app settings (click sound, MIDI bindings, Performance Mode, etc.)
- `src/stores/performance.ts` — transient live-performance state (current song index, running/paused)

### Key source files

```
src/
  components/
    PerformanceScreen.svelte   # live metronome UI
    SetlistList.svelte         # home screen
    SetlistEditor.svelte       # song list editor
    SongEditor.svelte          # add / edit a song
    Settings.svelte            # settings screen
  lib/
    metronome.ts               # Web Audio scheduling engine
    tts.ts                     # text-to-speech helpers
    types.ts                   # shared types and constants
  stores/
    setlists.ts
    settings.ts
    performance.ts
```

### Browser API availability

| API | Availability |
|---|---|
| Web Audio API | All modern browsers |
| Web MIDI API | Chrome/Edge desktop and Android; **not available on iOS Safari** |
| Web Speech API (TTS) | Most modern browsers; hidden in UI when unavailable |
| Screen Wake Lock | Chromium-based browsers and Safari 16.4+ |
| Web Share API | Mobile browsers; falls back to file download on desktop |

---

## Setlist file format

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

## Known limitations

- **iOS Web MIDI** — MIDI foot pedals require a MIDI-capable third-party browser on iPhone/iPad; the MIDI section is hidden on iOS Safari.
- **No cloud sync** — setlists are device-local; use export/import or Share to move them between devices.
- **Screen wake lock** — only active when Performance Mode is enabled in Settings.

---

## License

MIT

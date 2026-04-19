# MIDI Universal Binding Design

**Date:** 2026-04-18
**Status:** Approved

## Overview

Extend the MIDI binding system to support CC, Note On, and Program Change messages — not just CC. Users with foot pedals that send Note or PC messages can now use them without reconfiguration. Learn mode transparently captures any supported message type; the user just presses their pedal.

## Types (`src/lib/types.ts`)

Replace `MidiCCBinding` with a discriminated union:

```ts
export type MidiBinding =
  | { type: 'cc';   channel: number | 'any'; cc: number }
  | { type: 'note'; channel: number | 'any'; note: number }
  | { type: 'pc';   channel: number | 'any'; program: number }
```

`AppSettings.midi.advance` and `.pauseStop` change from `MidiCCBinding | null` to `MidiBinding | null`.

**Migration:** On load, any saved binding missing a `type` field is coerced to `{ type: 'cc', ... }` so existing user data is preserved without a version bump.

## MIDI Controller (`src/lib/midi.ts`)

`onMidiMessage` handles three message types:

| Type | Status byte | Trigger condition |
|------|-------------|-------------------|
| CC | 0xB0 | value > 0, min 3 bytes |
| Note On | 0x90 | velocity > 0, min 3 bytes |
| PC | 0xC0 | always, min 2 bytes |

Note Off (0x80) and Note On with velocity 0 are both ignored.

`matchesBinding` is type-aware: a CC binding never matches a Note On message even if the numbers are identical.

Learn mode captures the first supported message of any type, storing the correct `MidiBinding` variant automatically.

**API changes:**
- `setBindings(advance: MidiBinding | null, pauseStop: MidiBinding | null)`
- `simulateNote(channel, note, velocity)` added for tests
- `simulatePC(channel, program)` added for tests
- `simulateCC` retained for backward compatibility

## UI (`src/components/Settings.svelte`)

`formatBinding` updated display format:

- CC: `Ch 1 · CC 64`
- Note: `Ch 1 · Note 64`
- PC: `Ch 1 · PC 12`
- Any channel prefix: `Any · Note 64`

No other UI changes. Learn flow, Cancel/Clear buttons, and hint text are unchanged.

## Tests (`src/tests/midi.test.ts`)

Existing CC tests are unchanged. New tests cover:

- `matchesBinding` rejects type mismatch (CC binding vs Note On message)
- Note On velocity > 0 fires the action
- Note On velocity 0 is ignored
- Note Off (0x80) is ignored
- PC message fires the action
- Learn mode captures Note binding when Note On arrives first
- Learn mode captures PC binding when PC message arrives first

Storage tests cover the migration path: a saved binding with no `type` field deserialises as `type: 'cc'`.

## Out of Scope

- Note Off triggering actions
- SysEx
- Pitch bend / aftertouch

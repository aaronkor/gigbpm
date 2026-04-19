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

## Storage / Migration (`src/lib/storage.ts`)

**Migration location:** Coercion from legacy to new format happens in `loadSettings()` in `storage.ts`, applied to `midi.advance` and `midi.pauseStop` after merging stored values with defaults. If a stored binding is a non-null object with no `type` field, it is coerced to `{ type: 'cc', channel, cc }`. This keeps migration at the data boundary; the rest of the app only ever sees typed `MidiBinding` values.

## MIDI Controller (`src/lib/midi.ts`)

### Internal message representation

The private `IncomingCC` interface is renamed to `IncomingMessage` and extended:

```ts
interface IncomingMessage {
  type: 'cc' | 'note' | 'pc'
  channel: number
  number: number  // cc number, note number, or program number
}
```

### Message handling

`onMidiMessage` handles three message types. All message types extract channel as `(status & 0x0f) + 1`.

| Type | Status byte | Min length | Trigger condition | `number` field |
|------|-------------|------------|-------------------|----------------|
| CC | 0xB0 | 3 bytes | data[2] > 0 | data[1] |
| Note On | 0x90 | 3 bytes | data[2] > 0 | data[1] |
| PC | 0xC0 | 2 bytes | always | data[1] |

Note Off (0x80) and Note On with velocity 0 are both ignored. If a device sends a 3-byte PC, data[2] is silently ignored — only data[1] (program number) is used.

The length guard in `onMidiMessage` is type-specific: CC and Note On require `data.length >= 3`; PC requires only `data.length >= 2`. The existing blanket `>= 3` guard is replaced with per-type checks.

### `matchesBinding` signature

```ts
function matchesBinding(incoming: IncomingMessage, binding: MidiBinding): boolean
```

Matching requires both type and channel agreement. A CC binding never matches a Note On message even if the numbers are identical:

```ts
if (binding.type !== incoming.type) return false
const channelMatches = binding.channel === 'any' || binding.channel === incoming.channel
const numberField = binding.type === 'cc' ? binding.cc : binding.type === 'note' ? binding.note : binding.program
return channelMatches && numberField === incoming.number
```

### Learn mode

Learn mode captures the first supported message of any type that arrives, storing the correct `MidiBinding` variant. The captured binding always uses the actual received channel number — learn mode never produces `channel: 'any'`. If a pedal sends multiple messages on a single press (e.g. Note On + CC), whichever arrives first is captured — this is acceptable for this app.

### Updated API

```ts
setBindings(advance: MidiBinding | null, pauseStop: MidiBinding | null): void
startLearn(target: LearnTarget, onLearned: (binding: MidiBinding) => void): void  // callback type updated
simulateCC(channel: number, cc: number, value: number): void       // retained
simulateNote(channel: number, note: number, velocity: number): void // new
simulatePC(channel: number, program: number): void                  // new
```

## Settings Store (`src/stores/settings.ts`)

`setMidiAdvanceBinding` and `setMidiPauseStopBinding` change their parameter type from `MidiCCBinding | null` to `MidiBinding | null`. No other store changes.

## UI (`src/components/Settings.svelte`)

`formatBinding` updated display format:

- CC: `Ch 1 · CC 64`
- Note: `Ch 1 · Note 64`
- PC: `Ch 1 · PC 12`
- Any channel prefix: `Any · Note 64`

The `type` discriminant is used directly as a display label (capitalised). No lookup table needed. Values are always valid MIDI numbers (0–127) as received from the Web MIDI API, so no range validation is required in `formatBinding`.

No other UI changes. Learn flow, Cancel/Clear buttons, and hint text are unchanged.

## Tests

### `src/tests/midi.test.ts`

All existing CC test fixtures gain an explicit `type: 'cc'` field (e.g. `{ type: 'cc', channel: 1, cc: 64 }`). The `MidiCCBinding` import in the test file is replaced with `MidiBinding`. New tests cover:

- `matchesBinding` rejects type mismatch (CC binding vs Note On message with same number)
- Note On velocity > 0 fires the action
- Note On velocity 0 is ignored
- Note Off (0x80) is ignored
- PC message fires the action
- Learn mode captures Note binding when Note On arrives first
- Learn mode captures PC binding when PC message arrives first

### `src/tests/storage.test.ts`

Migration path: a saved binding object with no `type` field deserialises as `type: 'cc'`.

## Out of Scope

- Note Off triggering actions
- SysEx
- Pitch bend / aftertouch

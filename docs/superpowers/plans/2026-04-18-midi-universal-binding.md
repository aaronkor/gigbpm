# MIDI Universal Binding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend MIDI bindings to support CC, Note On, and Program Change messages in addition to the existing CC-only support.

**Architecture:** Replace `MidiCCBinding` with a `MidiBinding` discriminated union. Update the MIDI controller to parse all three message types and route them through a unified `IncomingMessage` structure. Migrate legacy stored bindings (no `type` field) to `type: 'cc'` at load time.

**Tech Stack:** TypeScript, Svelte 5, Vitest, Web MIDI API

**Spec:** `docs/superpowers/specs/2026-04-18-midi-universal-binding-design.md`

---

## Chunk 1: Types and storage migration

### Task 1: Replace `MidiCCBinding` with `MidiBinding`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] In `types.ts`, replace the `MidiCCBinding` interface with the `MidiBinding` discriminated union:

```ts
export type MidiBinding =
  | { type: 'cc';   channel: number | 'any'; cc: number }
  | { type: 'note'; channel: number | 'any'; note: number }
  | { type: 'pc';   channel: number | 'any'; program: number }
```

- [ ] Update `AppSettings.midi` — change `advance` and `pauseStop` from `MidiCCBinding | null` to `MidiBinding | null`.
- [ ] Delete the `MidiCCBinding` export entirely.
- [ ] Run `npm run typecheck` (or equivalent) — expect type errors in `midi.ts`, `storage.ts`, `settings.ts`, `Settings.svelte`. These are fixed in later tasks.
- [ ] Commit: `refactor: replace MidiCCBinding with MidiBinding discriminated union`

---

### Task 2: Add migration in `loadSettings`

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/tests/storage.test.ts`

- [ ] Write a failing test in `storage.test.ts` for the migration path:

```ts
it('migrates a legacy CC binding with no type field', () => {
  localStorage.setItem('gigbpm_settings', JSON.stringify({
    midi: { enabled: true, advance: { channel: 1, cc: 64 }, pauseStop: null }
  }))
  const settings = loadSettings()
  expect(settings.midi.advance).toEqual({ type: 'cc', channel: 1, cc: 64 })
})
```

- [ ] Run test — expect FAIL.
- [ ] In `loadSettings()`, after merging stored midi, add a helper that coerces a binding missing `type` to `{ type: 'cc', ... }`:

```ts
function migrateMidiBinding(b: unknown): MidiBinding | null {
  if (!b || typeof b !== 'object') return null
  const obj = b as Record<string, unknown>
  if (!obj.type && 'cc' in obj) {
    return { type: 'cc', channel: obj.channel as number | 'any', cc: obj.cc as number }
  }
  return obj as MidiBinding
}
```

Apply it to `midi.advance` and `midi.pauseStop` after the spread merge.

- [ ] Run test — expect PASS.
- [ ] Run full test suite — expect all passing.
- [ ] Commit: `feat: migrate legacy MidiCCBinding to MidiBinding on load`

---

## Chunk 2: MIDI controller

### Task 3: Update `midi.ts` to handle Note On and PC

**Files:**
- Modify: `src/lib/midi.ts`
- Modify: `src/tests/midi.test.ts`

- [ ] In `midi.test.ts`, add failing tests for the new message types (add `type: 'cc'` to all existing fixtures first):

```ts
// Existing fixture update example:
controller.setBindings({ type: 'cc', channel: 1, cc: 64 }, null)

// New tests:
it('fires onAdvance on Note On velocity > 0', () => { ... })
it('ignores Note On velocity 0', () => { ... })
it('ignores Note Off (0x80)', () => { ... })
it('fires onAdvance on PC message', () => { ... })
it('matchesBinding rejects type mismatch', () => { ... })
it('learn mode captures Note binding', () => { ... })
it('learn mode captures PC binding', () => { ... })
```

- [ ] Run tests — expect new tests to FAIL.
- [ ] In `midi.ts`:
  - Rename `IncomingCC` → `IncomingMessage`, add `type` field, rename `cc` → `number`
  - Update `matchesBinding` to check `binding.type !== incoming.type` first, then resolve the binding's number field from the correct property
  - Update `onMidiMessage` to handle `0x90` (Note On, length ≥ 3, velocity > 0) and `0xC0` (PC, length ≥ 2, always fires) in addition to `0xB0`
  - Update `setBindings` and `startLearn` callback type to `MidiBinding`
  - Add `simulateNote(channel, note, velocity)` and `simulatePC(channel, program)` methods
- [ ] Run tests — expect all passing.
- [ ] Commit: `feat: extend MIDI controller to handle Note On and Program Change`

---

## Chunk 3: Store and UI

### Task 4: Update settings store and Settings component

**Files:**
- Modify: `src/stores/settings.ts`
- Modify: `src/components/Settings.svelte`

- [ ] In `settings.ts`:
  - Change import from `MidiCCBinding` to `MidiBinding`
  - Update `setMidiAdvanceBinding` and `setMidiPauseStopBinding` parameter type to `MidiBinding | null`

- [ ] In `Settings.svelte`:
  - Change import from `MidiCCBinding` to `MidiBinding`
  - Update `formatBinding(binding: MidiBinding | null)` to display the type:

```ts
function formatBinding(binding: MidiBinding | null): string {
  if (!binding) return 'Not set'
  const ch = binding.channel === 'any' ? 'Any' : `Ch ${binding.channel}`
  const type = binding.type.toUpperCase()
  const num = binding.type === 'cc' ? binding.cc : binding.type === 'note' ? binding.note : binding.program
  return `${ch} · ${type} ${num}`
}
```

- [ ] Run `npm run typecheck` — expect zero errors.
- [ ] Run full test suite — expect all passing.
- [ ] Commit: `feat: update settings store and UI for MidiBinding`

---

## Chunk 4: Final verification

### Task 5: End-to-end smoke test

- [ ] Run `npm run build` — expect clean build.
- [ ] Run `npm run test` — expect all passing.
- [ ] Start dev server (`npm run dev`), open Settings > MIDI, enable MIDI, click Learn for "Next song", and verify the hint shows "Press your pedal now...".
- [ ] Run `npm push patch` as required by CLAUDE.md before pushing.
- [ ] Commit if any fixes were needed, then push.

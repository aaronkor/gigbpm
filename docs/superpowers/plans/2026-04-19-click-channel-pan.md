# Click Channel Pan Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left/right/both audio channel setting for the metronome click, configurable in app settings and persisted to localStorage.

**Architecture:** Add `ClickChannel` type to shared types; insert a `StereoPannerNode` per click in the metronome's `scheduleClick` and `previewClick` paths; wire the new setting through the settings store and performance store; add a 3-button segment control in the Settings UI Audio section.

**Tech Stack:** Svelte 5, TypeScript, Web Audio API (`StereoPannerNode`), Vitest, localStorage

---

## Chunk 1: Types, Metronome, Performance Store

### Task 1: Add `ClickChannel` type and update defaults

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add the type and update `AppSettings` + `DEFAULT_SETTINGS`**

In `src/lib/types.ts`, add after the `ClickSound` type line:

```ts
export type ClickChannel = 'left' | 'right' | 'both'
```

Add `clickChannel: ClickChannel` to `AppSettings`:

```ts
export interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  clickChannel: ClickChannel   // ← add this
  performanceMode: boolean
  midi: {
    enabled: boolean
    advance: MidiBinding | null
    pauseStop: MidiBinding | null
  }
  customSound: CustomSoundParams
}
```

Add `clickChannel: 'both'` to `DEFAULT_SETTINGS`:

```ts
export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  clickChannel: 'both',        // ← add this
  performanceMode: false,
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
  customSound: DEFAULT_CUSTOM_SOUND,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -30`

Expected: build errors only about missing `setClickChannel` on metronome (not type errors in types.ts itself). If there are errors about `DEFAULT_SETTINGS` not matching `AppSettings`, fix them first.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ClickChannel type and default to AppSettings"
```

---

### Task 2: Update metronome — tests first

**Files:**
- Modify: `src/tests/metronome.test.ts`
- Modify: `src/lib/metronome.ts`

- [ ] **Step 1: Add `createStereoPanner` to the mock context**

In `src/tests/metronome.test.ts`, update `makeMockContext()` to add a `createStereoPanner` mock. The panner needs a `pan` object with a `value` property and a `connect` mock:

```ts
function makeMockContext() {
  let time = 0

  return {
    get currentTime() {
      return time
    },
    advanceTime(seconds: number) {
      time += seconds
    },
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    sampleRate: 44_100,
    destination: {},
    createBuffer: vi.fn((_: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: { value: 0 },
      connect: vi.fn(),
    })),
  }
}
```

- [ ] **Step 2: Write failing tests for `setClickChannel`**

Add a new describe block at the bottom of `src/tests/metronome.test.ts`:

```ts
describe('createMetronome - click channel', () => {
  it('exposes setClickChannel method', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(typeof metronome.setClickChannel).toBe('function')
  })

  it('setClickChannel does not throw for any valid channel', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(() => metronome.setClickChannel('left')).not.toThrow()
    expect(() => metronome.setClickChannel('right')).not.toThrow()
    expect(() => metronome.setClickChannel('both')).not.toThrow()
  })

  it('creates a StereoPannerNode when scheduling a click', () => {
    const ctx = makeMockContext()
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.start(120)

    expect(ctx.createStereoPanner).toHaveBeenCalled()

    metronome.stop()
  })

  it('sets pan to -1 for left channel', () => {
    const ctx = makeMockContext()
    const pannerNode = { pan: { value: 0 }, connect: vi.fn() }
    ctx.createStereoPanner.mockReturnValue(pannerNode)
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickChannel('left')
    metronome.start(120)

    expect(pannerNode.pan.value).toBe(-1)

    metronome.stop()
  })

  it('sets pan to +1 for right channel', () => {
    const ctx = makeMockContext()
    const pannerNode = { pan: { value: 0 }, connect: vi.fn() }
    ctx.createStereoPanner.mockReturnValue(pannerNode)
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickChannel('right')
    metronome.start(120)

    expect(pannerNode.pan.value).toBe(1)

    metronome.stop()
  })

  it('sets pan to 0 for both channels', () => {
    const ctx = makeMockContext()
    const pannerNode = { pan: { value: 99 }, connect: vi.fn() }
    ctx.createStereoPanner.mockReturnValue(pannerNode)
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickChannel('both')
    metronome.start(120)

    expect(pannerNode.pan.value).toBe(0)

    metronome.stop()
  })
})

describe('previewClick - channel param', () => {
  it('accepts an optional channel parameter without throwing', () => {
    expect(() => previewClick('wood', undefined, 'left')).not.toThrow()
    expect(() => previewClick('wood', undefined, 'right')).not.toThrow()
    expect(() => previewClick('wood', undefined, 'both')).not.toThrow()
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|✓|✗|×)" | head -30`

Expected: new tests fail with "setClickChannel is not a function" or similar.

- [ ] **Step 4: Implement `setClickChannel` in `src/lib/metronome.ts`**

Add `setClickChannel` to the `Metronome` interface:

```ts
export interface Metronome {
  start(bpm: number): void
  stop(): void
  pause(): void
  resume(): void
  setBpm(bpm: number): void
  setClickSound(sound: ClickSound): void
  setCustomSoundParams(params: CustomSoundParams): void
  setClickChannel(channel: ClickChannel): void   // ← add
  onBeat(callback: () => void): void
  readonly isRunning: boolean
  readonly isPaused: boolean
}
```

Add the import at the top of the file:

```ts
import type { ClickChannel, ClickSound, CustomSoundParams } from './types'
```

Inside `createMetronome`, add state variable after `let customSoundParams`:

```ts
let currentChannel: ClickChannel = 'both'
```

Update `scheduleClick` to route through a `StereoPannerNode`. Replace the existing function:

```ts
function panValue(channel: ClickChannel): number {
  if (channel === 'left') return -1
  if (channel === 'right') return 1
  return 0
}

function scheduleClick(time: number): void {
  const source = ctx.createBufferSource()
  source.buffer = getClickBuffer()
  const panner = ctx.createStereoPanner()
  panner.pan.value = panValue(currentChannel)
  source.connect(panner)
  panner.connect(ctx.destination)
  source.start(time)
  pendingBeatCallbacks.push(time)
}
```

Add `setClickChannel` to the returned object:

```ts
setClickChannel(channel: ClickChannel): void {
  currentChannel = channel
},
```

Update `previewClick` signature and body:

```ts
export function previewClick(
  sound: ClickSound,
  customParams?: CustomSoundParams,
  channel: ClickChannel = 'both',
): void {
  const AudioContextConstructor =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextConstructor) {
    return
  }

  const ctx = new AudioContextConstructor()
  const source = ctx.createBufferSource()
  source.buffer = buildClickBuffer(sound, ctx, customParams)
  const panner = ctx.createStereoPanner()
  panner.pan.value = channel === 'left' ? -1 : channel === 'right' ? 1 : 0
  source.connect(panner)
  panner.connect(ctx.destination)
  source.start()
  source.onended = () => void ctx.close().catch(() => undefined)
}
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|✓|✗|×)" | head -40`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/metronome.ts src/tests/metronome.test.ts
git commit -m "feat: add setClickChannel to metronome with StereoPannerNode"
```

---

### Task 3: Update `createNoopMetronome` in performance store

**Files:**
- Modify: `src/stores/performance.ts`

- [ ] **Step 1: Add `setClickChannel` stub and extend the settings subscriber**

In `src/stores/performance.ts`, update `createNoopMetronome` to include the new method:

```ts
function createNoopMetronome(): Metronome {
  let beatCallback: (() => void) | null = null

  return {
    start(): void {},
    stop(): void {},
    pause(): void {},
    resume(): void {},
    setBpm(): void {},
    setClickSound(): void {},
    setCustomSoundParams(): void {},
    setClickChannel(): void {},   // ← add
    onBeat(callback: () => void): void {
      beatCallback = callback
    },
    get isRunning() {
      return false
    },
    get isPaused() {
      return false
    },
  }
}
```

Add the `ClickChannel` import to the imports line:

```ts
import type { ClickChannel, ClickSound, CustomSoundParams, Setlist, Song } from '../lib/types'
```

Add the synced channel variable alongside the others:

```ts
let syncedClickSound: ClickSound | null = null
let syncedCustomSound: CustomSoundParams | null = null
let syncedClickChannel: ClickChannel | null = null   // ← add
```

Extend the settings subscriber to sync `clickChannel`:

```ts
settingsStore.subscribe(($settings) => {
  const clickSoundChanged = $settings.clickSound !== syncedClickSound
  const customSoundChanged = $settings.customSound !== syncedCustomSound
  const clickChannelChanged = $settings.clickChannel !== syncedClickChannel   // ← add

  if (clickSoundChanged) {
    metronome.setClickSound($settings.clickSound)
    syncedClickSound = $settings.clickSound
  }

  if (customSoundChanged || (clickSoundChanged && $settings.clickSound === 'custom')) {
    metronome.setCustomSoundParams($settings.customSound)
    syncedCustomSound = $settings.customSound
  }

  if (clickChannelChanged) {                                                  // ← add
    metronome.setClickChannel($settings.clickChannel)
    syncedClickChannel = $settings.clickChannel
  }
})
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npm run build 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/stores/performance.ts
git commit -m "feat: sync clickChannel from settings to metronome in performance store"
```

---

## Chunk 2: Settings Store, Storage, and UI

### Task 4: Settings store — tests first

**Files:**
- Modify: `src/tests/storage.test.ts`
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Write failing tests for `clickChannel` in settings store**

Note: no explicit migration code is needed in `loadSettings`. The existing spread pattern `{ ...defaults, ...stored }` in `storage.ts` already provides `clickChannel: 'both'` from `DEFAULT_SETTINGS` whenever the stored object is missing the field. The tests below verify this behavior works as expected.

Add to `src/tests/storage.test.ts`:

```ts
describe('loadSettings - clickChannel', () => {
  it('defaults clickChannel to both when nothing stored', () => {
    expect(loadSettings().clickChannel).toBe('both')
  })

  it('returns both when stored settings have no clickChannel key', () => {
    localStorage.setItem('gigbpm_settings', JSON.stringify({ announceSongName: true }))
    expect(loadSettings().clickChannel).toBe('both')
  })

  it('returns stored clickChannel value', () => {
    localStorage.setItem('gigbpm_settings', JSON.stringify({ clickChannel: 'left' }))
    expect(loadSettings().clickChannel).toBe('left')
  })
})

describe('settingsStore.setClickChannel', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsStore.setClickChannel('both')
  })

  it('defaults clickChannel to both', () => {
    expect(settingsStore.clickChannel).toBe('both')
  })

  it('updates clickChannel and persists it', () => {
    settingsStore.setClickChannel('right')

    expect(settingsStore.clickChannel).toBe('right')
    expect(
      JSON.parse(localStorage.getItem('gigbpm_settings') ?? '{}').clickChannel,
    ).toBe('right')

    settingsStore.setClickChannel('both')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|clickChannel)" | head -20`

Expected: new tests fail with "settingsStore.setClickChannel is not a function".

- [ ] **Step 3: Implement `clickChannel` in `src/stores/settings.ts`**

Add `ClickChannel` to the import:

```ts
import type { AppSettings, ClickChannel, ClickSound, CustomSoundParams, MidiBinding } from '../lib/types'
```

Add `clickChannel` to `SettingsState`:

```ts
interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  clickChannel: ClickChannel   // ← add
  performanceMode: boolean
  midi: AppSettings['midi']
  customSound: CustomSoundParams
}
```

Update `createState` to include it:

```ts
function createState(all: AppSettings): SettingsState {
  return {
    all,
    announceSongName: all.announceSongName,
    clickSound: all.clickSound,
    clickChannel: all.clickChannel,   // ← add
    performanceMode: all.performanceMode,
    midi: all.midi,
    customSound: all.customSound,
  }
}
```

Add getter and setter to the store object (after `get customSound()`):

```ts
get clickChannel() {
  return get(store).clickChannel
},

setClickChannel(value: ClickChannel): void {
  updateSettings((settings) => ({ ...settings, clickChannel: value }))
},
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/settings.ts src/tests/storage.test.ts
git commit -m "feat: add clickChannel to settings store with persistence"
```

---

### Task 5: Settings UI — Channel segment control

**Files:**
- Modify: `src/components/Settings.svelte`

- [ ] **Step 1: Add the channel control in the Audio section**

In `src/components/Settings.svelte`, after the `sounds` array declaration, add:

```ts
const channels: Array<{ key: import('../lib/types').ClickChannel; label: string }> = [
  { key: 'left', label: 'Left' },
  { key: 'both', label: 'Both' },
  { key: 'right', label: 'Right' },
]
```

In the template, inside the `<section>` with `<h2>Audio</h2>`, add a new `.row` immediately after the `{/if}` that closes the `custom-panel` block (currently the last line before `</section>` in the Audio section). The structure should be:

```
  {/if}           ← closes the custom-panel #if
</div>            ← closes .sound-row
                  ← INSERT Channel row HERE
</section>        ← closes Audio section
```

```svelte
<div class="row">
  <div class="row-text">
    <div class="row-title">Channel</div>
  </div>
  <div class="sound-seg">
    {#each channels as ch}
      <button
        class="seg-btn"
        class:active={$settingsStore.clickChannel === ch.key}
        onclick={() => settingsStore.setClickChannel(ch.key)}
      >
        {ch.label}
      </button>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: Pass `clickChannel` to the Preview button**

Update the Preview button's `onclick` to pass the current channel:

```svelte
<button
  class="btn-preview"
  onclick={() => previewClick($settingsStore.clickSound, $settingsStore.customSound, $settingsStore.clickChannel)}
>
  Preview
</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 5: Start dev server and verify manually**

Run: `npm run dev`

Open the app, go to Settings → Audio section. Verify:
- "Channel" row appears below "Click Sound"
- Three buttons: Left, Both, Right — "Both" active by default
- Clicking Left/Right changes the active button
- Preview button plays the click in the selected channel (test with headphones)
- Setting persists after page reload

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings.svelte
git commit -m "feat: add Channel pan control to Settings audio section"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite one final time**

Run: `npm test 2>&1 | tail -15`

Expected: all tests pass, no failures.

- [ ] **Step 2: Follow project push convention**

Per `CLAUDE.md`, run `npm push patch` before pushing to remote. Check `package.json` scripts for the exact invocation — if it's not defined yet, ask the project owner for the correct command.

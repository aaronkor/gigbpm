# Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement four features: Add to Home Screen prompt, click sound selection (3 Web Audio sounds), share a setlist via Web Share API, and inline setlist name editing.

**Architecture:** Library/store changes first (types, metronome, importexport, settings store), all covered by unit tests; then UI components (Settings, SetlistList, SetlistEditor, App). Each feature is independent and can be committed separately.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite, Vitest, Web Audio API, Web Share API, PWA `beforeinstallprompt`

---

## Chunk 1: Library Layer + Settings Store

### Task 1: Extend the data model

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/tests/storage.test.ts`

- [ ] **Step 1: Add `ClickSound` type and extend `AppSettings` in `src/lib/types.ts`**

Replace the contents of `src/lib/types.ts` with:

```ts
export interface Song {
  id: string
  name: string
  bpm: number
}

export interface Setlist {
  id: string
  name: string
  songs: Song[]
}

export interface MidiCCBinding {
  channel: number | 'any'
  cc: number
}

export type ClickSound = 'wood' | 'beep' | 'tick'

export interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}

export const BPM_MIN = 20
export const BPM_MAX = 300

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
}
```

- [ ] **Step 2: Add a storage test verifying `clickSound` is included in defaults and merge**

In `src/tests/storage.test.ts`, add to the `loadSettings` describe block:

```ts
it('returns wood as default clickSound', () => {
  expect(loadSettings().clickSound).toBe('wood')
})

it('merges stored clickSound with defaults', () => {
  localStorage.setItem('gigbpm_settings', JSON.stringify({ clickSound: 'beep' }))
  expect(loadSettings().clickSound).toBe('beep')
  expect(loadSettings().midi).toEqual(DEFAULT_SETTINGS.midi)
})
```

- [ ] **Step 3: Run the storage tests**

```bash
cd /Volumes/ExternalMBox/Workspace/gigbpm && npx vitest run src/tests/storage.test.ts
```

Expected: All tests pass (storage.ts `loadSettings` already spreads stored values over defaults, so `clickSound` is picked up automatically).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/tests/storage.test.ts
git commit -m "feat: add ClickSound type and clickSound field to AppSettings"
```

---

### Task 2: Add three synthesized click sounds to the metronome

**Files:**
- Modify: `src/lib/metronome.ts`
- Modify: `src/tests/metronome.test.ts`

The three sounds are all synthesized directly into an `AudioBuffer` (same approach as the existing woodblock — no `OfflineAudioContext` needed). The spec mentions `OfflineAudioContext` for the beep, but direct `Math.sin()` arithmetic produces an identical result without async complexity or the need to mock `OfflineAudioContext` in tests. This is the deliberate implementation choice.

- **Wood** — existing noise burst with exponential decay (`CLICK_DECAY = 150`, 40ms)
- **Beep** — sine wave at 880 Hz computed sample-by-sample with linear fade-out over 60ms
- **Tick** — very short noise burst (25ms) with fast decay (`CLICK_DECAY = 400`) — sharp, hi-hat-like. The spec mentions a `BiquadFilterNode` highpass filter, but the fast decay alone produces the desired short, sharp character without post-processing.

- [ ] **Step 1: Write failing tests for the new metronome API**

Add to `src/tests/metronome.test.ts`:

```ts
describe('createMetronome - click sound', () => {
  it('exposes setClickSound method', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)
    expect(typeof metronome.setClickSound).toBe('function')
  })

  it('setClickSound does not throw for any valid sound', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)
    expect(() => metronome.setClickSound('wood')).not.toThrow()
    expect(() => metronome.setClickSound('beep')).not.toThrow()
    expect(() => metronome.setClickSound('tick')).not.toThrow()
  })

  it('setClickSound can be called while running', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)
    metronome.start(120)
    expect(() => metronome.setClickSound('beep')).not.toThrow()
    metronome.stop()
  })
})
```

Also replace the existing import line at the top of `src/tests/metronome.test.ts` (currently `import { createMetronome } from '../lib/metronome'`) with:

```ts
import { createMetronome, previewClick } from '../lib/metronome'
```

And a minimal smoke test:

```ts
describe('previewClick', () => {
  it('is exported', () => {
    expect(typeof previewClick).toBe('function')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/metronome.test.ts
```

Expected: FAIL — `setClickSound` does not exist, `previewClick` not exported.

- [ ] **Step 3: Rewrite `src/lib/metronome.ts` with the new sound API**

Replace the full file contents:

```ts
import type { ClickSound } from './types'

const LOOKAHEAD_SECONDS = 0.1
const SCHEDULER_INTERVAL_MS = 25

export interface Metronome {
  start(bpm: number): void
  stop(): void
  pause(): void
  resume(): void
  setBpm(bpm: number): void
  setClickSound(sound: ClickSound): void
  onBeat(callback: () => void): void
  readonly isRunning: boolean
  readonly isPaused: boolean
}

function buildClickBuffer(sound: ClickSound, ctx: AudioContext): AudioBuffer {
  if (sound === 'beep') {
    const duration = 0.06
    const length = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate
      data[i] = Math.sin(2 * Math.PI * 880 * t) * (1 - t / duration)
    }
    return buffer
  }

  if (sound === 'tick') {
    const length = Math.floor(ctx.sampleRate * 0.025)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 400)
    }
    return buffer
  }

  // 'wood' — original implementation
  const length = Math.floor(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 150)
  }
  return buffer
}

export function previewClick(sound: ClickSound): void {
  const ctx = new AudioContext()
  const buffer = buildClickBuffer(sound, ctx)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start()
  source.onended = () => void ctx.close()
}

export function createMetronome(ctx: AudioContext, initialSound: ClickSound = 'wood'): Metronome {
  let bpm = 120
  let nextBeatTime = 0
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null
  let beatCallback: (() => void) | null = null
  let running = false
  let paused = false
  let currentSound: ClickSound = initialSound
  let clickBuffer: AudioBuffer | null = null
  const pendingBeatCallbacks: number[] = []

  function getClickBuffer(): AudioBuffer {
    if (!clickBuffer) {
      clickBuffer = buildClickBuffer(currentSound, ctx)
    }
    return clickBuffer
  }

  function scheduleClick(time: number): void {
    const source = ctx.createBufferSource()
    source.buffer = getClickBuffer()
    source.connect(ctx.destination)
    source.start(time)
    pendingBeatCallbacks.push(time)
  }

  function flushBeatCallbacks(): void {
    if (!beatCallback) {
      pendingBeatCallbacks.length = 0
      return
    }
    while (pendingBeatCallbacks[0] !== undefined && pendingBeatCallbacks[0] <= ctx.currentTime) {
      pendingBeatCallbacks.shift()
      beatCallback()
    }
  }

  function stopLoop(): void {
    if (schedulerTimer !== null) {
      clearTimeout(schedulerTimer)
      schedulerTimer = null
    }
  }

  function schedulerLoop(): void {
    if (!running) return
    while (nextBeatTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      scheduleClick(nextBeatTime)
      nextBeatTime += 60 / bpm
    }
    flushBeatCallbacks()
    schedulerTimer = setTimeout(schedulerLoop, SCHEDULER_INTERVAL_MS)
  }

  function resetScheduledState(): void {
    nextBeatTime = ctx.currentTime
    pendingBeatCallbacks.length = 0
  }

  return {
    get isRunning() { return running },
    get isPaused() { return paused },

    start(newBpm: number): void {
      stopLoop()
      bpm = newBpm
      resetScheduledState()
      running = true
      paused = false
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      schedulerLoop()
    },

    stop(): void {
      stopLoop()
      resetScheduledState()
      running = false
      paused = false
    },

    pause(): void {
      if (!running) return
      stopLoop()
      pendingBeatCallbacks.length = 0
      running = false
      paused = true
    },

    resume(): void {
      if (!paused) return
      resetScheduledState()
      running = true
      paused = false
      schedulerLoop()
    },

    setBpm(newBpm: number): void {
      bpm = newBpm
    },

    setClickSound(sound: ClickSound): void {
      if (currentSound !== sound) {
        currentSound = sound
        clickBuffer = null
      }
    },

    onBeat(callback: () => void): void {
      beatCallback = callback
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/metronome.test.ts
```

Expected: All pass. The mock context's `createBuffer` returns a buffer with `getChannelData` returning a `Float32Array`, which is all the sound builders need.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metronome.ts src/tests/metronome.test.ts
git commit -m "feat: add click sound selection to metronome (wood/beep/tick)"
```

---

### Task 3: Add `shareSetlist` to importexport

**Files:**
- Modify: `src/lib/importexport.ts`
- Modify: `src/tests/importexport.test.ts`

- [ ] **Step 1: Write failing tests for `shareSetlist`**

First, replace the existing import lines at the top of `src/tests/importexport.test.ts`. The current file starts with:

```ts
import { describe, expect, it } from 'vitest'
import { buildExportPayload, validateImport } from '../lib/importexport'
```

Replace both lines with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportPayload, shareSetlist, validateImport } from '../lib/importexport'
```

Then add a new describe block at the end:

```ts
describe('shareSetlist', () => {
  const setlist = { id: '1', name: 'My Gig', songs: [{ id: 's1', name: 'Track', bpm: 120 }] }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls navigator.share when canShare returns true', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
    })

    await shareSetlist(setlist)

    expect(shareMock).toHaveBeenCalledOnce()
    const call = shareMock.mock.calls[0][0] as { files: File[]; title: string }
    expect(call.title).toBe('My Gig')
    expect(call.files[0].name).toMatch(/my-gig\.json$/)
  })

  it('falls back without calling navigator.share when canShare returns false', async () => {
    const shareMock = vi.fn()
    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
    })

    // exportSetlist uses DOM (creates an <a> element) — it will throw in jsdom but that's fine;
    // the key assertion is that navigator.share is never called
    try { await shareSetlist(setlist) } catch { /* expected DOM fallback */ }
    expect(shareMock).not.toHaveBeenCalled()
  })

  it('swallows AbortError silently', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortError),
      configurable: true,
    })

    await expect(shareSetlist(setlist)).resolves.toBeUndefined()
  })

  it('re-throws non-AbortError errors', async () => {
    const networkError = new Error('Network failure')
    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: vi.fn().mockRejectedValue(networkError),
      configurable: true,
    })

    await expect(shareSetlist(setlist)).rejects.toThrow('Network failure')
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npx vitest run src/tests/importexport.test.ts
```

Expected: FAIL — `shareSetlist` not exported.

- [ ] **Step 3: Add `shareSetlist` to `src/lib/importexport.ts`**

Append to the end of the file (after `exportSetlist`):

```ts
export async function shareSetlist(setlist: Setlist): Promise<void> {
  const payload = buildExportPayload(setlist)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `setlist-${setlist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  const file = new File([blob], filename, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: setlist.name })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      throw err
    }
  } else {
    exportSetlist(setlist)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/importexport.test.ts
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importexport.ts src/tests/importexport.test.ts
git commit -m "feat: add shareSetlist using Web Share API with exportSetlist fallback"
```

---

### Task 4: Extend settings store with `clickSound`

**Files:**
- Modify: `src/stores/settings.ts`

No new test file needed — the store pattern is a thin wrapper over types/storage which are already tested. A smoke-level test is sufficient.

- [ ] **Step 1: Update `src/stores/settings.ts`**

Replace the full file:

```ts
import { get, writable } from 'svelte/store'

import { loadSettings, saveSettings } from '../lib/storage'
import type { AppSettings, ClickSound, MidiCCBinding } from '../lib/types'

interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  midi: AppSettings['midi']
}

function createState(all: AppSettings): SettingsState {
  return {
    all,
    announceSongName: all.announceSongName,
    clickSound: all.clickSound,
    midi: all.midi,
  }
}

function createSettingsStore() {
  const store = writable<SettingsState>(createState(loadSettings()))

  function persist(all: AppSettings): void {
    saveSettings(all)
  }

  function updateSettings(transform: (settings: AppSettings) => AppSettings): void {
    store.update((state) => {
      const all = transform(state.all)
      persist(all)
      return createState(all)
    })
  }

  return {
    subscribe: store.subscribe,

    get all() {
      return get(store).all
    },

    get announceSongName() {
      return get(store).announceSongName
    },

    get clickSound() {
      return get(store).clickSound
    },

    get midi() {
      return get(store).midi
    },

    setAnnounceSongName(value: boolean): void {
      updateSettings((settings) => ({ ...settings, announceSongName: value }))
    },

    setClickSound(value: ClickSound): void {
      updateSettings((settings) => ({ ...settings, clickSound: value }))
    },

    setMidiEnabled(value: boolean): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, enabled: value },
      }))
    },

    setMidiAdvanceBinding(binding: MidiCCBinding | null): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, advance: binding },
      }))
    },

    setMidiPauseStopBinding(binding: MidiCCBinding | null): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, pauseStop: binding },
      }))
    },
  }
}

export const settingsStore = createSettingsStore()
```

- [ ] **Step 2: Add a smoke test for the settings store `clickSound` action**

In `src/tests/storage.test.ts`, first add this import at the top of the file alongside the existing imports:

```ts
import { settingsStore } from '../stores/settings'
```

Then add a new describe block at the end of the file:

```ts
describe('settingsStore.setClickSound', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults clickSound to wood', () => {
    expect(settingsStore.clickSound).toBe('wood')
  })

  it('updates clickSound and persists it', () => {
    settingsStore.setClickSound('beep')
    expect(settingsStore.clickSound).toBe('beep')
    expect(JSON.parse(localStorage.getItem('gigbpm_settings') ?? '{}').clickSound).toBe('beep')
    settingsStore.setClickSound('wood') // restore
  })
})
```

Note: The `settingsStore` is a module-level singleton. The test restores the value after to avoid polluting other tests.

- [ ] **Step 3: Run the full test suite to confirm nothing is broken**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/stores/settings.ts src/tests/storage.test.ts
git commit -m "feat: add clickSound to settings store"
```

---

## Chunk 2: UI Components

### Task 5: Wire the stored click sound into the metronome

**Files:**
- Modify: `src/stores/performance.ts`
- Modify: `src/components/PerformanceScreen.svelte`

The metronome is created in `src/stores/performance.ts` at module level (line 54), not in `PerformanceScreen.svelte`. Two changes are needed: (a) pass the stored initial sound at construction time, and (b) add a reactive `$effect` in `PerformanceScreen.svelte` to call `setClickSound` when the setting changes. Since `performance.ts` is a plain JS module (not a Svelte component), `$effect` cannot be used there — the reactive update belongs in the component.

The noop metronome in `performance.ts` must also implement `setClickSound` because it satisfies the `Metronome` interface (which gains the new method in Task 2).

- [ ] **Step 1: Update the noop metronome and `createMetronome` call in `src/stores/performance.ts`**

Locate the `createNoopMetronome` function (lines 19–38) and add `setClickSound()`:

```ts
function createNoopMetronome(): Metronome {
  let beatCallback: (() => void) | null = null

  return {
    start(): void {},
    stop(): void {},
    pause(): void {},
    resume(): void {},
    setBpm(): void {},
    setClickSound(): void {},   // ADD THIS LINE
    onBeat(callback: () => void): void {
      beatCallback = callback
    },
    get isRunning() { return false },
    get isPaused() { return false },
  }
}
```

Locate line 54 where the metronome is constructed:

```ts
const metronome: Metronome = audioContext ? createMetronome(audioContext) : createNoopMetronome()
```

Replace it with:

```ts
const metronome: Metronome = audioContext
  ? createMetronome(audioContext, settingsStore.all.clickSound)
  : createNoopMetronome()
```

(`settingsStore` is already imported at the top of `performance.ts`.)

- [ ] **Step 2: Add a `$effect` in `PerformanceScreen.svelte` to reactively update the sound**

`PerformanceScreen.svelte` already imports `settingsStore` (line 11). Add a `$effect` after the existing `onMount` / `onDestroy` calls:

```ts
$effect(() => {
  performanceStore.metronome.setClickSound($settingsStore.clickSound)
})
```

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/stores/performance.ts src/components/PerformanceScreen.svelte
git commit -m "feat: wire clickSound setting into metronome"
```

---

### Task 6: Settings UI — Audio section (click sound) + App section (install)

**Files:**
- Modify: `src/components/Settings.svelte`

- [ ] **Step 1: Add click sound selector and preview to Settings**

In `Settings.svelte`, add a new `<section>` for **Audio** above (or replacing) the current General section. Add these to the `<script>` block:

```ts
import { previewClick } from '../lib/metronome'
import type { ClickSound } from '../lib/types'

const sounds: { key: ClickSound; label: string }[] = [
  { key: 'wood', label: 'Wood' },
  { key: 'beep', label: 'Beep' },
  { key: 'tick', label: 'Tick' },
]
```

Add an **Audio** section to the template (after the `<div class="content">` opening tag, before the existing `{#if ttsAvailable}` block):

```svelte
<section>
  <h2>Audio</h2>
  <div class="row sound-row">
    <div class="row-text">
      <div class="row-title">Click Sound</div>
    </div>
    <div class="sound-controls">
      <div class="sound-seg">
        {#each sounds as s}
          <button
            class="seg-btn"
            class:active={$settingsStore.clickSound === s.key}
            onclick={() => settingsStore.setClickSound(s.key)}
          >{s.label}</button>
        {/each}
      </div>
      <button class="btn-preview" onclick={() => previewClick($settingsStore.clickSound)}>
        Preview
      </button>
    </div>
  </div>
</section>
```

Add these styles to the `<style>` block:

```css
.sound-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.sound-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.sound-seg {
  display: flex;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.seg-btn {
  flex: 1;
  padding: 8px 0;
  background: none;
  border: none;
  border-right: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.seg-btn:last-child {
  border-right: none;
}

.seg-btn.active {
  background: var(--indigo);
  color: #fff;
}

.btn-preview {
  padding: 8px 14px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--indigo);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Add App section (Install row) to Settings**

The Settings component receives the deferred install prompt as a prop from `App.svelte` — it does not capture `beforeinstallprompt` itself. Add the following to the `<script>` block (replacing the existing `$props()` destructure and adding the new declarations below it):

Replace the existing `$props()` line:
```ts
let { onBack }: { onBack: () => void } = $props()
```
With:
```ts
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let { onBack, installPromptEvent = null }: {
  onBack: () => void
  installPromptEvent?: BeforeInstallPromptEvent | null
} = $props()

const isIos =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let isInstalled = $state(window.matchMedia('(display-mode: standalone)').matches)
let showIosSheet = $state(false)

function handleInstallClick(): void {
  if (isIos) {
    showIosSheet = true
    return
  }
  if (installPromptEvent) {
    void installPromptEvent.prompt()
    installPromptEvent.userChoice.then(() => {
      isInstalled = window.matchMedia('(display-mode: standalone)').matches
    })
  }
}
```

Add an **App** section to the template (before the Audio section):

```svelte
{#if isIos || installPromptEvent !== null || isInstalled}
  <section>
    <h2>App</h2>
    <div class="row">
      <div class="row-text">
        <div class="row-title">Install App</div>
        <div class="row-desc">Add GigBPM to your home screen</div>
      </div>
      {#if isInstalled}
        <span class="installed-label">Installed</span>
      {:else}
        <button class="btn-install" disabled={!installPromptEvent && !isIos} onclick={handleInstallClick}>Install</button>
      {/if}
    </div>
  </section>
{/if}

{#if showIosSheet}
  <div class="ios-sheet-backdrop" onclick={() => { showIosSheet = false }}></div>
  <div class="ios-sheet">
    <p>Tap the <strong>Share</strong> icon in Safari, then choose <strong>Add to Home Screen</strong>.</p>
    <button class="btn-dismiss" onclick={() => { showIosSheet = false }}>Got it</button>
  </div>
{/if}
```

Add styles:

```css
.installed-label {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.btn-install {
  padding: 7px 14px;
  background: var(--indigo);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.ios-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10;
}

.ios-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 11;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ios-sheet p {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
}

.btn-dismiss {
  padding: 12px;
  background: var(--indigo);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
```

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: All pass (no tests cover Settings.svelte directly; existing tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/components/Settings.svelte
git commit -m "feat: add click sound selector and install app row to Settings"
```

---

### Task 7: Add Share action to SetlistList

**Files:**
- Modify: `src/components/SetlistList.svelte`

- [ ] **Step 1: Add `shareSetlist` import and handler**

In the `<script>` block of `SetlistList.svelte`, update the import:

```ts
import { exportSetlist, shareSetlist, validateImport } from '../lib/importexport'
```

Add the handler function:

```ts
async function handleShare(setlist: Setlist): Promise<void> {
  try {
    await shareSetlist(setlist)
  } catch {
    toast("Couldn't share setlist")
  }
}
```

- [ ] **Step 2: Add Share button to row actions**

In the template, update the `.row-actions` div to include a Share button between Rename and Export:

```svelte
<div class="row-actions">
  <button onclick={() => startRename(setlist)}>Rename</button>
  <button onclick={() => handleShare(setlist)}>Share</button>
  <button onclick={() => handleExport(setlist)}>Export</button>
  <button class="danger" onclick={() => setlistsStore.remove(setlist.id)}>
    Delete
  </button>
</div>
```

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/SetlistList.svelte
git commit -m "feat: add Share action to setlist row using Web Share API"
```

---

### Task 8: Inline setlist name editing in SetlistEditor

**Files:**
- Modify: `src/components/SetlistEditor.svelte`

- [ ] **Step 1: Add inline edit state and handlers to SetlistEditor**

In the `<script>` block of `SetlistEditor.svelte`, add:

```ts
let editingName = $state(false)
let nameValue = $state('')
let nameInput = $state<HTMLInputElement | null>(null)

function startEditName(): void {
  nameValue = current.name
  editingName = true
}

function commitName(): void {
  const trimmed = nameValue.trim()
  if (trimmed) {
    setlistsStore.rename(current.id, trimmed)
  }
  editingName = false
}

function cancelEditName(): void {
  editingName = false
}
```

Add a `$effect` to auto-focus when editing starts (after the existing effects):

```ts
$effect(() => {
  if (!editingName) return
  void tick().then(() => nameInput?.focus())
})
```

`SetlistEditor.svelte` currently imports `import { onDestroy } from 'svelte'`. Update that line to add `tick`:

```ts
import { onDestroy, tick } from 'svelte'
```

- [ ] **Step 2: Replace the static `<h1>` in the header template**

Replace:

```svelte
<h1>{current.name}</h1>
```

With:

```svelte
{#if editingName}
  <input
    class="name-input"
    bind:this={nameInput}
    bind:value={nameValue}
    onblur={commitName}
    onkeydown={(e) => {
      if (e.key === 'Enter') commitName()
      if (e.key === 'Escape') cancelEditName()
    }}
  />
{:else}
  <button class="name-btn" onclick={startEditName}>{current.name}</button>
{/if}
```

Add styles:

```css
.name-btn {
  flex: 1;
  background: none;
  border: none;
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  cursor: text;
  padding: 2px 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--indigo);
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  padding: 2px 4px;
  min-width: 0;
}
```

Remove or update the existing `h1` style rule:

```css
/* remove or keep only if h1 is used elsewhere */
```

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/SetlistEditor.svelte
git commit -m "feat: inline setlist name editing in SetlistEditor header"
```

---

### Task 9: Add install banner to App.svelte

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Add install banner state, logic, and the Settings prop thread**

Replace `App.svelte` script block with:

```ts
<script lang="ts">
  import PerformanceScreen from './components/PerformanceScreen.svelte'
  import SetlistEditor from './components/SetlistEditor.svelte'
  import SetlistList from './components/SetlistList.svelte'
  import Settings from './components/Settings.svelte'
  import type { Setlist } from './lib/types'

  const INSTALL_DISMISSED_KEY = 'gigbpm_install_dismissed'

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  type Screen =
    | { name: 'setlist-list' }
    | { name: 'setlist-editor'; setlist: Setlist }
    | { name: 'performance' }
    | { name: 'settings' }

  let screen = $state<Screen>({ name: 'setlist-list' })

  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true'

  let installPrompt = $state<BeforeInstallPromptEvent | null>(null)
  let showBanner = $state(!isStandalone && !isDismissed)
  let showIosSheet = $state(false)

  if (!isStandalone) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      installPrompt = e as BeforeInstallPromptEvent
    })
  }

  function dismissBanner(): void {
    showBanner = false
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
  }

  function handleBannerInstall(): void {
    if (isIos) {
      showIosSheet = true
      return
    }
    if (installPrompt) {
      void installPrompt.prompt()
      installPrompt.userChoice.then(() => {
        installPrompt = null
        showBanner = false
      })
    }
  }

  function exitPerformance(): void {
    screen = { name: 'setlist-list' }
  }
</script>
```

- [ ] **Step 2: Update the template to include the banner, iOS sheet, and Settings prop**

Replace the full template section:

```svelte
<div class="app">
  {#if screen.name === 'setlist-list'}
    <SetlistList
      onOpenSetlist={(setlist) => { screen = { name: 'setlist-editor', setlist } }}
      onOpenSettings={() => { screen = { name: 'settings' } }}
    />
  {:else if screen.name === 'setlist-editor'}
    <SetlistEditor
      setlist={screen.setlist}
      onBack={() => { screen = { name: 'setlist-list' } }}
      onPlay={() => { screen = { name: 'performance' } }}
    />
  {:else if screen.name === 'performance'}
    <PerformanceScreen onExit={exitPerformance} />
  {:else}
    <Settings
      onBack={() => { screen = { name: 'setlist-list' } }}
      installPromptEvent={installPrompt}
    />
  {/if}

  {#if showBanner && (isIos || installPrompt !== null)}
    <div class="install-banner">
      <span class="banner-text">Add GigBPM to your home screen for quick access</span>
      <button class="banner-add" onclick={handleBannerInstall}>Add</button>
      <button class="banner-dismiss" onclick={dismissBanner} aria-label="Dismiss">✕</button>
    </div>
  {/if}
</div>

{#if showIosSheet}
  <div class="ios-backdrop" onclick={() => { showIosSheet = false }}></div>
  <div class="ios-sheet">
    <p>Tap the <strong>Share</strong> icon in Safari, then choose <strong>Add to Home Screen</strong>.</p>
    <button class="ios-got-it" onclick={() => { showIosSheet = false }}>Got it</button>
  </div>
{/if}
```

- [ ] **Step 3: Add styles to the `<style>` block**

The `.app` rule already exists in `App.svelte`'s `<style>` block — do not add it again. Append only the new rules:

```css

.install-banner {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0px);
  left: 0;
  right: 0;
  background: #1a1a2e;
  border-top: 1px solid var(--indigo);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 20;
}

.banner-text {
  flex: 1;
  font-size: 13px;
  color: #c7c7ff;
}

.banner-add {
  padding: 7px 14px;
  background: var(--indigo);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.banner-dismiss {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 4px;
}

.ios-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 30;
}

.ios-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 31;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ios-sheet p {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
}

.ios-got-it {
  padding: 13px;
  background: var(--indigo);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
```

- [ ] **Step 4: Remove the duplicate iOS sheet from Settings.svelte**

Since `App.svelte` now owns the iOS sheet for the banner, and `Settings.svelte` owns it for the Settings-triggered flow, both can coexist. No change needed — each component manages its own iOS sheet instance independently.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.svelte
git commit -m "feat: add PWA install banner with iOS instructions to App"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Build the app and check for TypeScript errors**

```bash
npx vite build
```

Expected: Build succeeds with no type errors.

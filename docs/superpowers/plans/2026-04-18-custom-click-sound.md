# Custom Click Sound Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Custom" option to the Click Sound setting that lets the user synthesise their own metronome click by tweaking source waveform, pitch, duration, and decay.

**Architecture:** Extend the existing `ClickSound` union with `'custom'`, add `CustomSoundParams` to `AppSettings` with deep-merge storage, wire the new `setCustomSoundParams` metronome method via store subscriptions in `performance.ts`, and render an inline parameter panel in `Settings.svelte`.

**Tech Stack:** Svelte 5, TypeScript, Web Audio API, Vitest, localStorage

---

## Chunk 1: Types, storage, and settings store

### Task 1: Extend `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write the failing type-check**

```bash
npm run check
```
Expected: passes (baseline confirmation)

- [ ] **Step 2: Add new types and extend existing ones**

Replace the entire contents of `src/lib/types.ts`:

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

export type ClickSoundSource = 'sine' | 'square' | 'noise'

export interface CustomSoundParams {
  source: ClickSoundSource
  pitch: number    // Hz, range 100–2000; ignored when source = 'noise'
  duration: number // ms (user-facing), converted to seconds at synthesis time
  decay: number    // exponential decay coefficient, range 50–600
}

export type ClickSound = 'wood' | 'beep' | 'tick' | 'custom'

export interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
  customSound: CustomSoundParams
}

export const BPM_MIN = 20
export const BPM_MAX = 300

export const DEFAULT_CUSTOM_SOUND: CustomSoundParams = {
  source: 'sine',
  pitch: 440,
  duration: 40,
  decay: 200,
}

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  performanceMode: false,
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
  customSound: DEFAULT_CUSTOM_SOUND,
}
```

- [ ] **Step 3: Run type-check to verify no errors**

```bash
npm run check
```
Expected: passes

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ClickSoundSource, CustomSoundParams, extend ClickSound and AppSettings"
```

---

### Task 2: Update `src/lib/storage.ts` — deep-merge `customSound`

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/storage.test.ts` (after the existing `loadSettings` describe block):

```ts
describe('loadSettings — customSound migration', () => {
  it('returns DEFAULT_CUSTOM_SOUND when nothing stored', () => {
    expect(loadSettings().customSound).toEqual(DEFAULT_SETTINGS.customSound)
  })

  it('returns full defaults when stored record has no customSound key', () => {
    localStorage.setItem('gigbpm_settings', JSON.stringify({ announceSongName: true }))
    expect(loadSettings().customSound).toEqual(DEFAULT_SETTINGS.customSound)
  })

  it('merges partial customSound — missing keys filled from defaults', () => {
    localStorage.setItem(
      'gigbpm_settings',
      JSON.stringify({ customSound: { source: 'square' } }),
    )
    const result = loadSettings()
    expect(result.customSound.source).toBe('square')
    expect(result.customSound.pitch).toBe(DEFAULT_SETTINGS.customSound.pitch)
    expect(result.customSound.duration).toBe(DEFAULT_SETTINGS.customSound.duration)
    expect(result.customSound.decay).toBe(DEFAULT_SETTINGS.customSound.decay)
  })

  it('preserves all four fields when fully stored', () => {
    const stored = { source: 'noise', pitch: 800, duration: 80, decay: 300 }
    localStorage.setItem('gigbpm_settings', JSON.stringify({ customSound: stored }))
    expect(loadSettings().customSound).toEqual(stored)
  })
})
```

Also add `DEFAULT_SETTINGS` and `CustomSoundParams` to the existing import at the top of `src/tests/storage.test.ts` (it currently imports `DEFAULT_SETTINGS` already — ensure `CustomSoundParams` is not needed in tests beyond `DEFAULT_SETTINGS.customSound`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --reporter=verbose src/tests/storage.test.ts
```
Expected: the four new tests FAIL (customSound not yet merged)

- [ ] **Step 3: Update `cloneDefaultSettings` and `loadSettings` in `src/lib/storage.ts`**

Replace `cloneDefaultSettings`:
```ts
function cloneDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    midi: { ...DEFAULT_SETTINGS.midi },
    customSound: { ...DEFAULT_SETTINGS.customSound },
  }
}
```

Replace the return inside the `try` block of `loadSettings`:
```ts
    return {
      ...defaults,
      ...stored,
      midi: {
        ...defaults.midi,
        ...stored.midi,
      },
      customSound: {
        ...defaults.customSound,
        ...stored.customSound,
      },
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose src/tests/storage.test.ts
```
Expected: all storage tests PASS

- [ ] **Step 5: Run type-check**

```bash
npm run check
```
Expected: passes

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts src/tests/storage.test.ts
git commit -m "feat: deep-merge customSound in loadSettings and cloneDefaultSettings"
```

---

### Task 3: Update `src/stores/settings.ts` — add `customSound` state and setter

**Files:**
- Modify: `src/stores/settings.ts`
- Test: `src/tests/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/storage.test.ts`:

```ts
describe('settingsStore.setCustomSound', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsStore.setCustomSound(DEFAULT_SETTINGS.customSound)
  })

  it('defaults customSound to DEFAULT_CUSTOM_SOUND', () => {
    expect(settingsStore.customSound).toEqual(DEFAULT_SETTINGS.customSound)
  })

  it('updates customSound and persists it', () => {
    const updated = { source: 'square' as const, pitch: 600, duration: 60, decay: 400 }
    settingsStore.setCustomSound(updated)
    expect(settingsStore.customSound).toEqual(updated)
    expect(
      JSON.parse(localStorage.getItem('gigbpm_settings') ?? '{}').customSound,
    ).toEqual(updated)
  })
})
```

Add `CustomSoundParams` to the import from `'../lib/types'` in `storage.test.ts` if needed (the test only uses `DEFAULT_SETTINGS.customSound` and a literal object, so no extra import is needed).

- [ ] **Step 2: Run to verify test fails**

```bash
npm run test -- --reporter=verbose src/tests/storage.test.ts
```
Expected: FAIL — `settingsStore.setCustomSound` does not exist

- [ ] **Step 3: Update `src/stores/settings.ts`**

Add `CustomSoundParams` to the imports:
```ts
import type { AppSettings, ClickSound, CustomSoundParams, MidiCCBinding } from '../lib/types'
```

Add `customSound: CustomSoundParams` to `SettingsState`:
```ts
interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean
  midi: AppSettings['midi']
  customSound: CustomSoundParams
}
```

Add it to `createState`:
```ts
function createState(all: AppSettings): SettingsState {
  return {
    all,
    announceSongName: all.announceSongName,
    clickSound: all.clickSound,
    performanceMode: all.performanceMode,
    midi: all.midi,
    customSound: all.customSound,
  }
}
```

Add getter and setter to the store object (after `get midi()`):
```ts
    get customSound() {
      return get(store).customSound
    },

    setCustomSound(params: CustomSoundParams): void {
      updateSettings((settings) => ({ ...settings, customSound: params }))
    },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose src/tests/storage.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Run type-check**

```bash
npm run check
```
Expected: passes

- [ ] **Step 6: Commit**

```bash
git add src/stores/settings.ts src/tests/storage.test.ts
git commit -m "feat: add customSound to settings store state and setCustomSound method"
```

---

## Chunk 2: Metronome synthesis and wiring

### Task 4: Extend `src/lib/metronome.ts` — add `setCustomSoundParams` and custom synthesis

**Files:**
- Modify: `src/lib/metronome.ts`
- Test: `src/tests/metronome.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/metronome.test.ts`. The file already imports `createMetronome` and `previewClick` at the top — do not duplicate those; only add the `CustomSoundParams` type import and the new `const`/`describe` blocks below the existing content:

```ts
import type { CustomSoundParams } from '../lib/types'

const DEFAULT_CUSTOM: CustomSoundParams = {
  source: 'sine',
  pitch: 440,
  duration: 40,
  decay: 200,
}

describe('buildClickBuffer — custom sound', () => {
  it('sine source produces buffer of correct length', () => {
    const ctx = makeMockContext()
    const metronome = createMetronome(ctx as unknown as AudioContext)
    metronome.setCustomSoundParams(DEFAULT_CUSTOM)
    metronome.setClickSound('custom')
    metronome.start(120)
    const expectedLength = Math.floor(44_100 * (DEFAULT_CUSTOM.duration / 1000))
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, 44_100)
    metronome.stop()
  })

  it('square source produces buffer of correct length', () => {
    const ctx = makeMockContext()
    const params: CustomSoundParams = { ...DEFAULT_CUSTOM, source: 'square', duration: 80 }
    const metronome = createMetronome(ctx as unknown as AudioContext)
    metronome.setCustomSoundParams(params)
    metronome.setClickSound('custom')
    metronome.start(120)
    const expectedLength = Math.floor(44_100 * (params.duration / 1000))
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, 44_100)
    metronome.stop()
  })

  it('noise source produces buffer of correct length', () => {
    const ctx = makeMockContext()
    const params: CustomSoundParams = { ...DEFAULT_CUSTOM, source: 'noise', duration: 25 }
    const metronome = createMetronome(ctx as unknown as AudioContext)
    metronome.setCustomSoundParams(params)
    metronome.setClickSound('custom')
    metronome.start(120)
    const expectedLength = Math.floor(44_100 * (params.duration / 1000))
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, 44_100)
    metronome.stop()
  })
})

describe('setCustomSoundParams', () => {
  it('is exposed on the Metronome interface', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)
    expect(typeof metronome.setCustomSoundParams).toBe('function')
  })

  it('invalidates the click buffer cache', () => {
    const ctx = makeMockContext()
    const metronome = createMetronome(ctx as unknown as AudioContext)
    metronome.setClickSound('custom')
    metronome.setCustomSoundParams(DEFAULT_CUSTOM)
    metronome.start(120)
    const callsBefore = ctx.createBuffer.mock.calls.length
    metronome.setCustomSoundParams({ ...DEFAULT_CUSTOM, pitch: 880 })
    metronome.stop()
    metronome.start(120)
    expect(ctx.createBuffer.mock.calls.length).toBeGreaterThan(callsBefore)
    metronome.stop()
  })
})

describe('previewClick — custom', () => {
  it('does not throw when called with custom and params', () => {
    expect(() => previewClick('custom', DEFAULT_CUSTOM)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm run test -- --reporter=verbose src/tests/metronome.test.ts
```
Expected: FAIL — `setCustomSoundParams` does not exist, `previewClick` signature mismatch

- [ ] **Step 3: Update `src/lib/metronome.ts`**

Add the import at the top:
```ts
import type { ClickSound, CustomSoundParams } from './types'
```

Update the `Metronome` interface to add `setCustomSoundParams`:
```ts
export interface Metronome {
  start(bpm: number): void
  stop(): void
  pause(): void
  resume(): void
  setBpm(bpm: number): void
  setClickSound(sound: ClickSound): void
  setCustomSoundParams(params: CustomSoundParams): void
  onBeat(callback: () => void): void
  readonly isRunning: boolean
  readonly isPaused: boolean
}
```

Update `buildClickBuffer` signature and add custom synthesis:
```ts
function buildClickBuffer(
  sound: ClickSound,
  ctx: AudioContext,
  customParams?: CustomSoundParams,
): AudioBuffer {
  if (sound === 'custom' && customParams) {
    const durationSec = customParams.duration / 1000
    const { source, pitch, decay } = customParams

    if (source === 'sine') {
      return createClickBuffer(
        ctx,
        durationSec,
        (time) => Math.sin(2 * Math.PI * pitch * time) * Math.exp(-time * decay),
      )
    }

    if (source === 'square') {
      return createClickBuffer(
        ctx,
        durationSec,
        (time) => (Math.sin(2 * Math.PI * pitch * time) > 0 ? 1 : -1) * Math.exp(-time * decay),
      )
    }

    // noise
    return createClickBuffer(
      ctx,
      durationSec,
      (time) => (Math.random() * 2 - 1) * Math.exp(-time * decay),
    )
  }

  if (sound === 'beep') {
    const duration = 0.06
    return createClickBuffer(
      ctx,
      duration,
      (time) => Math.sin(2 * Math.PI * 880 * time) * (1 - time / duration),
    )
  }

  if (sound === 'tick') {
    return createClickBuffer(
      ctx,
      0.025,
      (time) => (Math.random() * 2 - 1) * Math.exp(-time * 400),
    )
  }

  return createClickBuffer(
    ctx,
    0.04,
    (time) => (Math.random() * 2 - 1) * Math.exp(-time * 150),
  )
}
```

Update `previewClick` signature:
```ts
export function previewClick(sound: ClickSound, customParams?: CustomSoundParams): void {
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
  source.connect(ctx.destination)
  source.start()
  source.onended = () => void ctx.close().catch(() => undefined)
}
```

Add `customSoundParams` variable and update `getClickBuffer` and `setClickSound` inside `createMetronome`, then add `setCustomSoundParams` to the returned object:

Inside `createMetronome`, after `let clickBuffer: AudioBuffer | null = null`:
```ts
  let customSoundParams: CustomSoundParams | undefined = undefined
```

Update `getClickBuffer`:
```ts
  function getClickBuffer(): AudioBuffer {
    if (!clickBuffer) {
      clickBuffer = buildClickBuffer(currentSound, ctx, customSoundParams)
    }

    return clickBuffer
  }
```

Add to the returned object (after `setClickSound`):
```ts
    setCustomSoundParams(params: CustomSoundParams): void {
      customSoundParams = params
      clickBuffer = null
    },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose src/tests/metronome.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Run type-check**

```bash
npm run check
```
Expected: passes

- [ ] **Step 6: Commit**

```bash
git add src/lib/metronome.ts src/tests/metronome.test.ts
git commit -m "feat: add custom sound synthesis and setCustomSoundParams to metronome"
```

---

### Task 5: Wire `setCustomSoundParams` in `src/stores/performance.ts`

**Files:**
- Modify: `src/stores/performance.ts`

- [ ] **Step 1: Add `setCustomSoundParams` no-op to `createNoopMetronome`**

In `performance.ts`, update `createNoopMetronome` to add the new method:

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

- [ ] **Step 2: Subscribe to `customSound` changes to sync into the live metronome**

After the `const metronome` declaration (line ~57), add a single store subscription before `createPerformanceStore`. The current `performance.ts` seeds the metronome with `settingsStore.all.clickSound` as the constructor's `initialSound` arg — that arg becomes redundant once this subscription is in place (the subscription fires synchronously on first call and calls `setClickSound` with the same value). Remove the second argument from the `createMetronome` call so it reads `createMetronome(audioContext)` and this subscription becomes the single source of truth for click sound state:

```ts
settingsStore.subscribe(($settings) => {
  metronome.setClickSound($settings.clickSound)
  metronome.setCustomSoundParams($settings.customSound)
})
```

- [ ] **Step 3: Run type-check**

```bash
npm run check
```
Expected: passes

- [ ] **Step 4: Run all tests**

```bash
npm run test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/performance.ts
git commit -m "feat: wire setCustomSoundParams in performance store, sync on settings change"
```

---

## Chunk 3: Settings UI

### Task 6: Add Custom sound panel to `src/components/Settings.svelte`

**Files:**
- Modify: `src/components/Settings.svelte`

- [ ] **Step 1: Add `CustomSoundParams` import and `'custom'` to sounds array**

In the `<script>` block, update the import from `'../lib/types'`:
```ts
import type { ClickSound, CustomSoundParams, MidiCCBinding } from '../lib/types'
```

Update the `sounds` array:
```ts
const sounds: Array<{ key: ClickSound; label: string }> = [
  { key: 'wood', label: 'Wood' },
  { key: 'beep', label: 'Beep' },
  { key: 'tick', label: 'Tick' },
  { key: 'custom', label: 'Custom' },
]
```

- [ ] **Step 2: Update the Preview button to pass `customSound`**

Replace the existing Preview button:
```svelte
<button class="btn-preview" onclick={() => previewClick($settingsStore.clickSound)}>
  Preview
</button>
```
with:
```svelte
<button
  class="btn-preview"
  onclick={() => previewClick($settingsStore.clickSound, $settingsStore.customSound)}
>
  Preview
</button>
```

- [ ] **Step 3: Add the inline custom params panel**

After the `</div>` that closes `sound-controls` (and before the closing `</div>` of the `sound-row` `.row` div), add:

```svelte
        {#if $settingsStore.clickSound === 'custom'}
          <div class="custom-panel">
            <div class="custom-row">
              <span class="custom-label">Source</span>
              <div class="mini-seg">
                {#each (['sine', 'square', 'noise'] as const) as src}
                  <button
                    class="mini-seg-btn"
                    class:active={$settingsStore.customSound.source === src}
                    onclick={() =>
                      settingsStore.setCustomSound({
                        ...$settingsStore.customSound,
                        source: src,
                      })}
                  >
                    {src.charAt(0).toUpperCase() + src.slice(1)}
                  </button>
                {/each}
              </div>
            </div>

            <div
              class="custom-slider-row"
              class:disabled={$settingsStore.customSound.source === 'noise'}
            >
              <div class="custom-slider-header">
                <span class="custom-label">Pitch</span>
                <span class="custom-value">{$settingsStore.customSound.pitch} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="10"
                value={$settingsStore.customSound.pitch}
                disabled={$settingsStore.customSound.source === 'noise'}
                oninput={(e) =>
                  settingsStore.setCustomSound({
                    ...$settingsStore.customSound,
                    pitch: Number((e.target as HTMLInputElement).value),
                  })}
              />
            </div>

            <div class="custom-slider-row">
              <div class="custom-slider-header">
                <span class="custom-label">Duration</span>
                <span class="custom-value">{$settingsStore.customSound.duration} ms</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={$settingsStore.customSound.duration}
                oninput={(e) =>
                  settingsStore.setCustomSound({
                    ...$settingsStore.customSound,
                    duration: Number((e.target as HTMLInputElement).value),
                  })}
              />
            </div>

            <div class="custom-slider-row">
              <div class="custom-slider-header">
                <span class="custom-label">Decay</span>
                <span class="custom-value">
                  {$settingsStore.customSound.decay <= 150
                    ? 'slow'
                    : $settingsStore.customSound.decay <= 350
                      ? 'medium'
                      : 'fast'}
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="600"
                step="10"
                value={$settingsStore.customSound.decay}
                oninput={(e) =>
                  settingsStore.setCustomSound({
                    ...$settingsStore.customSound,
                    decay: Number((e.target as HTMLInputElement).value),
                  })}
              />
            </div>
          </div>
        {/if}
```

The placement in the template should be inside the `.sound-row` `.row` div, after `.sound-controls`, so the full Audio card block looks like:

```svelte
      <div class="row sound-row">
        <div class="row-text">
          <div class="row-title">Click Sound</div>
        </div>
        <div class="sound-controls">
          <div class="sound-seg">
            {#each sounds as sound}
              <button
                class="seg-btn"
                class:active={$settingsStore.clickSound === sound.key}
                onclick={() => settingsStore.setClickSound(sound.key)}
              >
                {sound.label}
              </button>
            {/each}
          </div>
          <button
            class="btn-preview"
            onclick={() => previewClick($settingsStore.clickSound, $settingsStore.customSound)}
          >
            Preview
          </button>
        </div>
        {#if $settingsStore.clickSound === 'custom'}
          <!-- paste the full custom-panel markup from the code block above -->
        {/if}
      </div>
```

- [ ] **Step 4: Add CSS for the custom panel**

In the `<style>` block, add after `.btn-preview` styles:

```css
  .custom-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    background: var(--bg);
    border-radius: var(--radius-sm);
    padding: 12px;
  }

  .custom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .custom-label {
    font-size: 13px;
    color: var(--text-dim);
  }

  .custom-value {
    font-size: 12px;
    color: var(--indigo);
    font-weight: 600;
    font-family: monospace;
  }

  .mini-seg {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 5px;
    overflow: hidden;
  }

  .mini-seg-btn {
    padding: 6px 12px;
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .mini-seg-btn:first-child {
    border-left: none;
  }

  .mini-seg-btn.active {
    background: var(--indigo);
    color: #fff;
  }

  .custom-slider-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .custom-slider-row.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .custom-slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .custom-slider-row input[type='range'] {
    width: 100%;
    accent-color: var(--indigo);
  }
```

- [ ] **Step 5: Run type-check**

```bash
npm run check
```
Expected: passes

- [ ] **Step 6: Run all tests**

```bash
npm run test
```
Expected: all tests PASS

- [ ] **Step 7: Start dev server and manually verify**

```bash
npm run dev
```

Open the app, go to Settings → Audio:
- Verify four segments: Wood / Beep / Tick / Custom
- Select Custom — verify the inline panel appears with Source, Pitch, Duration, Decay controls
- Move sliders — verify the value labels update live
- Switch Source to Noise — verify Pitch slider becomes faded and unresponsive
- Switch Source back to Sine/Square — verify Pitch slider is re-enabled
- Click Preview — verify a sound plays reflecting the current params
- Select Wood/Beep/Tick — verify the panel disappears
- Select Custom again — verify params are restored (not reset)

- [ ] **Step 8: Commit**

```bash
git add src/components/Settings.svelte
git commit -m "feat: add Custom click sound panel to Settings UI"
```

---

### Task 7: Version bump and push

- [ ] **Step 1: Bump version**

```bash
npm version patch
```

- [ ] **Step 2: Push**

```bash
git push
```

<script lang="ts">
  import { tick } from 'svelte'

  import type { Song } from '../lib/types'

  let { song, onSave, onCancel }: {
    song: Song | null
    onSave: (data: { name: string; bpm: number }) => void
    onCancel: () => void
  } = $props()

  let name = $state('')
  let bpm = $state(120)
  let tapTimes: number[] = []
  let tapCount = $state(0)
  let tapTimer: ReturnType<typeof setTimeout> | null = null
  let nameInput = $state<HTMLInputElement | null>(null)

  function clamp(value: number): number {
    return Math.max(20, Math.min(300, Math.round(value)))
  }

  function handleBpmInput(event: Event): void {
    const value = Number.parseInt((event.target as HTMLInputElement).value, 10)

    if (!Number.isNaN(value)) {
      bpm = clamp(value)
    }
  }

  function adjust(delta: number): void {
    bpm = clamp(bpm + delta)
  }

  function handleTap(): void {
    const now = performance.now()
    tapTimes.push(now)

    if (tapTimes.length > 4) {
      tapTimes.shift()
    }

    tapCount = tapTimes.length

    if (tapTimes.length >= 2) {
      const intervals: number[] = []

      for (let index = 1; index < tapTimes.length; index += 1) {
        intervals.push(tapTimes[index] - tapTimes[index - 1])
      }

      const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      bpm = clamp(60000 / average)
    }

    if (tapTimer) {
      clearTimeout(tapTimer)
    }

    tapTimer = setTimeout(() => {
      tapTimes = []
      tapCount = 0
      tapTimer = null
    }, 2000)
  }

  function handleSave(): void {
    if (!name.trim()) {
      return
    }

    onSave({ name: name.trim(), bpm: clamp(bpm) })
  }

  $effect(() => {
    name = song?.name ?? ''
    bpm = song?.bpm ?? 120
    tapTimes = []
    tapCount = 0

    if (tapTimer) {
      clearTimeout(tapTimer)
      tapTimer = null
    }

    void tick().then(() => nameInput?.focus())
  })
</script>

<div class="overlay" role="presentation" onclick={onCancel}></div>

<div class="sheet" role="dialog" aria-label={song ? 'Edit Song' : 'Add Song'}>
  <div class="handle"></div>
  <h2>{song ? 'Edit Song' : 'Add Song'}</h2>

  <div class="field">
    <label for="song-name">Song Name</label>
    <input
      id="song-name"
      bind:this={nameInput}
      type="text"
      bind:value={name}
      placeholder="e.g. Autumn Leaves"
    />
  </div>

  <div class="field">
    <label for="song-bpm">BPM</label>
    <div class="bpm-row">
      <button class="adj" onclick={() => adjust(-1)} aria-label="Decrease BPM">-</button>
      <input
        id="song-bpm"
        type="number"
        value={bpm}
        min="20"
        max="300"
        oninput={handleBpmInput}
        onblur={() => {
          bpm = clamp(bpm)
        }}
      />
      <button class="adj" onclick={() => adjust(1)} aria-label="Increase BPM">+</button>
    </div>
  </div>

  <button class="tap-btn" class:active={tapCount > 0} onclick={handleTap}>
    TAP TEMPO
    {#if tapCount > 0}
      <span class="tap-hint">{tapCount} tap{tapCount !== 1 ? 's' : ''}... keep going</span>
    {:else}
      <span class="tap-hint">Tap repeatedly to detect BPM</span>
    {/if}
  </button>

  <div class="actions">
    <button class="btn-cancel" onclick={onCancel}>Cancel</button>
    <button class="btn-save" onclick={handleSave} disabled={!name.trim()}>Save</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10;
  }

  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 11;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-top: 1px solid var(--border);
  }

  .handle {
    width: 36px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 0 auto;
  }

  h2 {
    font-size: 15px;
    font-weight: 700;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  input[type='text'],
  input[type='number'] {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 10px 12px;
    font-size: 14px;
    width: 100%;
  }

  .bpm-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .bpm-row input {
    flex: 1;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    font-family: monospace;
  }

  .adj {
    width: 40px;
    height: 40px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tap-btn {
    background: var(--surface-2);
    border: 2px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 12px;
    color: var(--indigo);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .tap-btn.active {
    background: #1e1b4b;
    border-color: var(--indigo);
    box-shadow: 0 0 16px rgba(129, 140, 248, 0.25);
  }

  .tap-hint {
    font-size: 10px;
    font-weight: 400;
    color: var(--indigo);
    opacity: 0.7;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .btn-cancel {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    flex: 1;
    padding: 13px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    cursor: pointer;
  }

  .btn-save {
    background: var(--accent);
    border: none;
    color: #000;
    font-weight: 700;
    flex: 2;
    padding: 13px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    cursor: pointer;
  }

  .btn-save:disabled {
    background: var(--surface-2);
    color: var(--text-muted);
    cursor: default;
  }
</style>

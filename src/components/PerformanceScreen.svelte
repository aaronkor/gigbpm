<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { performanceStore } from '../stores/performance'

  let { onExit }: { onExit: () => void } = $props()

  let beatActive = $state(false)
  let beatTimer: ReturnType<typeof setTimeout> | null = null

  type MediaNavigator = Navigator & {
    mediaSession?: {
      setActionHandler: (
        action: 'nexttrack',
        handler: MediaSessionActionHandler | null,
      ) => void
    }
  }

  onMount(() => {
    performanceStore.metronome.onBeat(() => {
      beatActive = true

      if (beatTimer) {
        clearTimeout(beatTimer)
      }

      beatTimer = setTimeout(() => {
        beatActive = false
        beatTimer = null
      }, 80)
    })

    const mediaNavigator = navigator as MediaNavigator
    mediaNavigator.mediaSession?.setActionHandler('nexttrack', () => performanceStore.next())
  })

  onDestroy(() => {
    if (beatTimer) {
      clearTimeout(beatTimer)
    }

    performanceStore.metronome.onBeat(() => {})

    const mediaNavigator = navigator as MediaNavigator
    mediaNavigator.mediaSession?.setActionHandler('nexttrack', null)
  })

  function handleExit(): void {
    performanceStore.exit()
    onExit()
  }

  function handlePauseResume(): void {
    if ($performanceStore.running) {
      performanceStore.pause()
      return
    }

    performanceStore.resume()
  }
</script>

<div class="screen">
  <button class="exit-btn" onclick={handleExit} aria-label="Exit performance">✕</button>

  <div class="song-info">
    <div class="position" class:is-paused={$performanceStore.paused}>
      {$performanceStore.songIndex + 1} / {$performanceStore.totalSongs}
      {#if $performanceStore.paused}&nbsp;· PAUSED{/if}
    </div>
    <div class="song-name">{$performanceStore.currentSong?.name ?? ''}</div>
  </div>

  <div
    class="bpm-ring"
    class:on-beat={beatActive && $performanceStore.running}
    class:is-paused={$performanceStore.paused}
  >
    <div class="bpm-number">{$performanceStore.currentSong?.bpm ?? '--'}</div>
    <div class="bpm-label">BPM</div>
  </div>

  <div class="controls">
    <button
      class="pause-btn"
      class:is-paused={$performanceStore.paused}
      onclick={handlePauseResume}
      aria-label={$performanceStore.running ? 'Pause' : 'Resume'}
    >
      <span class="btn-icon">{$performanceStore.running ? '⏸' : '▶'}</span>
      <span class="btn-label">{$performanceStore.running ? 'PAUSE' : 'RESUME'}</span>
    </button>

    <button class="next-btn" onclick={() => performanceStore.next()} aria-label="Next song">
      <span class="btn-icon">▶▶</span>
      <span class="btn-label">NEXT</span>
    </button>
  </div>
</div>

<style>
  .screen {
    height: 100%;
    background: var(--bg);
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 24px 20px 36px;
  }

  .exit-btn {
    align-self: flex-end;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
  }

  .song-info {
    text-align: center;
  }

  .position {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .position.is-paused {
    color: var(--danger);
  }

  .song-name {
    font-size: 22px;
    font-weight: 700;
    margin-top: 6px;
  }

  .bpm-ring {
    width: min(72vw, 280px);
    height: min(72vw, 280px);
    max-width: 280px;
    max-height: 280px;
    border-radius: 50%;
    border: 4px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition:
      border-color 0.05s ease,
      box-shadow 0.05s ease;
  }

  .bpm-ring.on-beat {
    border-color: #ffffff;
    box-shadow:
      0 0 0 8px rgba(255, 255, 255, 0.12),
      0 0 0 18px rgba(255, 255, 255, 0.06),
      0 0 40px rgba(255, 255, 255, 0.2);
  }

  .bpm-ring.is-paused {
    border-color: var(--danger);
    box-shadow:
      0 0 0 6px var(--danger-muted),
      0 0 24px rgba(239, 68, 68, 0.2);
  }

  .bpm-number {
    font-size: clamp(56px, 18vw, 88px);
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
    color: var(--text);
  }

  .bpm-label {
    font-size: 12px;
    letter-spacing: 3px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .pause-btn {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    color: var(--text);
  }

  .pause-btn.is-paused {
    border-color: var(--danger);
  }

  .next-btn {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    color: #000;
    box-shadow: 0 0 20px var(--accent-muted);
  }

  .btn-icon {
    font-size: 18px;
  }

  .btn-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
  }
</style>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import AppLogo from './AppLogo.svelte'
  import iconNext from '../assets/icon-next.svg?raw'
  import iconPause from '../assets/icon-pause.svg?raw'
  import iconPlay from '../assets/icon-play.svg?raw'
  import iconPrev from '../assets/icon-prev.svg?raw'
  import { isTTSAvailable } from '../lib/tts'
  import { performanceStore } from '../stores/performance'
  import { settingsStore } from '../stores/settings'

  let { onExit }: { onExit: () => void } = $props()

  let beatActive = $state(false)
  let dismissedDndReminder = $state(false)
  let beatTimer: ReturnType<typeof setTimeout> | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wakeLock: any = null

  type MediaNavigator = Navigator & {
    mediaSession?: {
      setActionHandler: (
        action: 'nexttrack' | 'previoustrack',
        handler: MediaSessionActionHandler | null,
      ) => void
    }
  }

  type WakeLockNavigator = Navigator & {
    wakeLock?: {
      request: (type: 'screen') => Promise<unknown>
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
    mediaNavigator.mediaSession?.setActionHandler('previoustrack', () => performanceStore.prev())
    mediaNavigator.mediaSession?.setActionHandler('nexttrack', () => performanceStore.next())
  })

  onDestroy(() => {
    if (beatTimer) {
      clearTimeout(beatTimer)
    }

    performanceStore.metronome.onBeat(() => {})

    const mediaNavigator = navigator as MediaNavigator
    mediaNavigator.mediaSession?.setActionHandler('previoustrack', null)
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

  function handleToggleTts(): void {
    settingsStore.setAnnounceSongName(!settingsStore.announceSongName)
  }

  $effect(() => {
    performanceStore.metronome.setClickSound($settingsStore.clickSound)
  })

  $effect(() => {
    const enabled = $settingsStore.performanceMode

    if (!enabled) {
      return
    }

    async function requestLock(): Promise<void> {
      const wakeLockNavigator = navigator as WakeLockNavigator

      try {
        wakeLock = (await wakeLockNavigator.wakeLock?.request('screen')) ?? null
      } catch {
        wakeLock = null
      }
    }

    void requestLock()

    function onVisibility(): void {
      if (document.visibilityState === 'visible' && $settingsStore.performanceMode) {
        void requestLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      const releaseResult = wakeLock?.release?.()
      void releaseResult?.catch(() => {})
      wakeLock = null
    }
  })
</script>

<div class="screen">
  <div class="top-row">
    <div class="top-action">
      {#if isTTSAvailable()}
        <button
          class="tts-btn"
          class:is-on={$settingsStore.announceSongName}
          onclick={handleToggleTts}
          aria-label={$settingsStore.announceSongName ? 'Disable TTS' : 'Enable TTS'}
        >
          🔊
        </button>
      {/if}
    </div>

    <div class="top-brand">
      <AppLogo size="34px" />
    </div>

    <button class="exit-btn" onclick={handleExit} aria-label="Exit performance">✕</button>
  </div>

  {#if $settingsStore.performanceMode && !dismissedDndReminder}
    <div class="dnd-banner">
      <span>Enable Do Not Disturb on your device for uninterrupted performance</span>
      <button
        class="dnd-dismiss"
        onclick={() => (dismissedDndReminder = true)}
        aria-label="Dismiss Do Not Disturb reminder"
      >
        ✕
      </button>
    </div>
  {/if}

  <div class="song-info">
    <div class="position" class:is-paused={$performanceStore.paused}>
      {$performanceStore.songIndex + 1} / {$performanceStore.totalSongs}
      {#if $performanceStore.paused}&nbsp;· PAUSED{/if}
    </div>
    <div class="song-name">{$performanceStore.currentSong?.name ?? ''}</div>
  </div>

  <div class="secondary-controls">
    <button class="prev-btn" onclick={() => performanceStore.prev()} aria-label="Previous song">
      <span class="btn-icon" aria-hidden="true">{@html iconPrev}</span>
      <span class="btn-label">PREV</span>
    </button>

    <button
      class="pause-btn"
      class:is-paused={$performanceStore.paused}
      onclick={handlePauseResume}
      aria-label={$performanceStore.running ? 'Pause' : 'Resume'}
    >
      <span class="btn-icon btn-icon-primary" aria-hidden="true">
        {@html $performanceStore.running ? iconPause : iconPlay}
      </span>
      <span class="btn-label">{$performanceStore.running ? 'PAUSE' : 'RESUME'}</span>
    </button>
  </div>

  <div
    class="bpm-ring"
    class:on-beat={beatActive && $performanceStore.running}
    class:is-paused={$performanceStore.paused}
  >
    <div class="bpm-number">{$performanceStore.currentSong?.bpm ?? '--'}</div>
    <div class="bpm-label">BPM</div>
  </div>

  <button class="next-btn" onclick={() => performanceStore.next()} aria-label="Next song">
    <span class="btn-icon" aria-hidden="true">{@html iconNext}</span>
    <span class="btn-label">NEXT</span>
  </button>
</div>

<style>
  .screen {
    height: 100%;
    background: var(--bg);
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 0;
    gap: var(--screen-section-gap);
    padding:
      var(--screen-padding-y)
      var(--screen-padding-x)
      calc(var(--screen-padding-y) + 12px + env(safe-area-inset-bottom, 0px));
  }

  .top-row {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(32px, auto) 1fr minmax(32px, auto);
    align-items: start;
    gap: 12px;
  }

  .top-action,
  .top-brand {
    display: flex;
    align-items: center;
  }

  .top-brand {
    justify-content: center;
    color: var(--text);
  }

  .exit-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: clamp(18px, 5vw, 20px);
    cursor: pointer;
    padding: 4px;
  }

  .tts-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: clamp(18px, 5vw, 20px);
    cursor: pointer;
    padding: 4px;
  }

  .tts-btn {
    opacity: 0.25;
  }

  .tts-btn.is-on {
    opacity: 1;
  }

  .song-info {
    text-align: center;
    width: 100%;
    max-width: 28rem;
  }

  .dnd-banner {
    width: 100%;
    max-width: 32rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.4;
  }

  .dnd-banner span {
    flex: 1;
    min-width: 0;
  }

  .dnd-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 4px;
  }

  .position {
    font-size: clamp(10px, 2.8vw, 11px);
    letter-spacing: clamp(1.2px, 0.5vw, 2px);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .position.is-paused {
    color: var(--danger);
  }

  .song-name {
    font-size: clamp(18px, 6vw, 22px);
    font-weight: 700;
    margin-top: 6px;
    overflow-wrap: anywhere;
  }

  .bpm-ring {
    width: min(68vw, 44dvh, 252px);
    height: min(68vw, 44dvh, 252px);
    max-width: 252px;
    max-height: 252px;
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
    margin-block: auto;
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
    font-size: clamp(48px, 16vw, 88px);
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
    color: var(--text);
  }

  .bpm-label {
    font-size: clamp(10px, 3vw, 12px);
    letter-spacing: clamp(2px, 0.9vw, 3px);
    color: var(--text-muted);
    margin-top: 4px;
  }

  .secondary-controls {
    display: flex;
    align-items: center;
    gap: var(--control-gap);
  }

  .prev-btn {
    width: var(--control-size-sm);
    height: var(--control-size-sm);
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    color: var(--text);
  }

  .pause-btn {
    width: var(--control-size-md);
    height: var(--control-size-md);
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
    width: var(--control-size-lg);
    height: var(--control-size-lg);
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
    display: inline-flex;
    line-height: 0;
  }

  .btn-icon :global(svg) {
    width: clamp(20px, 6vw, 24px);
    height: clamp(20px, 6vw, 24px);
  }

  .btn-icon-primary :global(svg) {
    width: clamp(28px, 9vw, 36px);
    height: clamp(28px, 9vw, 36px);
  }

  .btn-label {
    font-size: clamp(8px, 2.5vw, 9px);
    font-weight: 700;
    letter-spacing: 1px;
  }

  @media (max-width: 360px), (max-height: 640px) {
    .screen {
      gap: clamp(8px, 2dvh, 12px);
    }

    .top-row {
      gap: 8px;
    }

    .dnd-banner {
      padding: 10px 12px;
      gap: 10px;
      font-size: 12px;
    }

    .song-name {
      margin-top: 4px;
    }

    .bpm-ring {
      width: min(62vw, 36dvh, 216px);
      height: min(62vw, 36dvh, 216px);
    }
  }
</style>

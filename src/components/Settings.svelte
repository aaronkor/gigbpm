<script lang="ts">
  import { onDestroy } from 'svelte'

  import { createMidiController, isMidiAvailable } from '../lib/midi'
  import { previewClick } from '../lib/metronome'
  import { isTTSAvailable } from '../lib/tts'
  import type { ClickSound, MidiCCBinding } from '../lib/types'
  import { settingsStore } from '../stores/settings'

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  let { onBack, installPromptEvent = null }: {
    onBack: () => void
    installPromptEvent?: BeforeInstallPromptEvent | null
  } = $props()

  const ttsAvailable = isTTSAvailable()
  const midiAvailable = isMidiAvailable()
  const sounds: Array<{ key: ClickSound; label: string }> = [
    { key: 'wood', label: 'Wood' },
    { key: 'beep', label: 'Beep' },
    { key: 'tick', label: 'Tick' },
  ]
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  let learningTarget = $state<'advance' | 'pauseStop' | null>(null)
  let isInstalled = $state(window.matchMedia('(display-mode: standalone)').matches)
  let showIosSheet = $state(false)
  const midiCtrl = createMidiController(() => {}, () => {})

  function formatBinding(binding: MidiCCBinding | null): string {
    if (!binding) {
      return 'Not set'
    }

    const channel = binding.channel === 'any' ? 'Any' : `Ch ${binding.channel}`
    return `${channel} · CC ${binding.cc}`
  }

  async function startLearn(target: 'advance' | 'pauseStop'): Promise<void> {
    learningTarget = target
    await midiCtrl.enable()
    midiCtrl.startLearn(target, (binding) => {
      if (target === 'advance') {
        settingsStore.setMidiAdvanceBinding(binding)
      } else {
        settingsStore.setMidiPauseStopBinding(binding)
      }

      learningTarget = null
    })
  }

  function cancelLearn(): void {
    midiCtrl.cancelLearn()
    learningTarget = null
  }

  function clearBinding(target: 'advance' | 'pauseStop'): void {
    if (target === 'advance') {
      settingsStore.setMidiAdvanceBinding(null)
      return
    }

    settingsStore.setMidiPauseStopBinding(null)
  }

  function handleInstallClick(): void {
    if (isIos) {
      showIosSheet = true
      return
    }

    if (!installPromptEvent) {
      return
    }

    void installPromptEvent.prompt()
    void installPromptEvent.userChoice.then(() => {
      isInstalled = window.matchMedia('(display-mode: standalone)').matches
    })
  }

  $effect(() => {
    if (!$settingsStore.midi.enabled && learningTarget) {
      cancelLearn()
    }
  })

  onDestroy(() => {
    midiCtrl.cancelLearn()
    midiCtrl.disable()
  })
</script>

<div class="screen">
  <header>
    <button class="back-btn" onclick={onBack}>← Back</button>
    <h1>Settings</h1>
  </header>

  <div class="content">
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
            <button
              class="btn-install"
              disabled={!installPromptEvent && !isIos}
              onclick={handleInstallClick}
            >
              Install
            </button>
          {/if}
        </div>
      </section>
    {/if}

    <section>
      <h2>Audio</h2>
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
          <button class="btn-preview" onclick={() => previewClick($settingsStore.clickSound)}>
            Preview
          </button>
        </div>
      </div>
    </section>

    {#if ttsAvailable}
      <section>
        <h2>General</h2>
        <div class="row">
          <div class="row-text">
            <div class="row-title">Announce song name</div>
            <div class="row-desc">Speaks the song name aloud when advancing</div>
          </div>
          <label class="toggle" aria-label="Toggle announce song name">
            <input
              type="checkbox"
              checked={$settingsStore.announceSongName}
              onchange={(event) =>
                settingsStore.setAnnounceSongName((event.target as HTMLInputElement).checked)}
            />
            <span class="slider"></span>
          </label>
        </div>
      </section>
    {/if}

    {#if midiAvailable}
      <section>
        <h2>MIDI</h2>

        <div class="row">
          <div class="row-text">
            <div class="row-title">Enable MIDI input</div>
            <div class="row-desc">iOS Safari not supported</div>
          </div>
          <label class="toggle" aria-label="Toggle MIDI">
            <input
              type="checkbox"
              checked={$settingsStore.midi.enabled}
              onchange={(event) =>
                settingsStore.setMidiEnabled((event.target as HTMLInputElement).checked)}
            />
            <span class="slider"></span>
          </label>
        </div>

        {#if $settingsStore.midi.enabled}
          <div class="binding-group">
            <div class="binding-row">
              <div class="binding-info">
                <div class="binding-label">Next song</div>
                <div class="binding-value">{formatBinding($settingsStore.midi.advance)}</div>
              </div>
              <div class="binding-btns">
                {#if learningTarget === 'advance'}
                  <button class="btn-learn active" onclick={cancelLearn}>Cancel</button>
                {:else}
                  <button class="btn-learn" onclick={() => startLearn('advance')}>Learn</button>
                {/if}

                {#if $settingsStore.midi.advance}
                  <button class="btn-clear" onclick={() => clearBinding('advance')}>Clear</button>
                {/if}
              </div>
            </div>

            <div class="binding-row">
              <div class="binding-info">
                <div class="binding-label">Pause / Stop</div>
                <div class="binding-value">{formatBinding($settingsStore.midi.pauseStop)}</div>
              </div>
              <div class="binding-btns">
                {#if learningTarget === 'pauseStop'}
                  <button class="btn-learn active" onclick={cancelLearn}>Cancel</button>
                {:else}
                  <button class="btn-learn" onclick={() => startLearn('pauseStop')}>Learn</button>
                {/if}

                {#if $settingsStore.midi.pauseStop}
                  <button class="btn-clear" onclick={() => clearBinding('pauseStop')}>Clear</button>
                {/if}
              </div>
            </div>

            {#if learningTarget}
              <p class="learn-hint">Press your pedal now...</p>
            {/if}
          </div>
        {/if}
      </section>
    {/if}
  </div>
</div>

{#if showIosSheet}
  <button
    class="ios-sheet-backdrop"
    type="button"
    aria-label="Close install instructions"
    onclick={() => (showIosSheet = false)}
  ></button>
  <div class="ios-sheet">
    <p>Tap the <strong>Share</strong> icon in Safari, then choose <strong>Add to Home Screen</strong>.</p>
    <button class="btn-dismiss" onclick={() => (showIosSheet = false)}>Got it</button>
  </div>
{/if}

<style>
  .screen {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    font-size: 16px;
    font-weight: 700;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  section h2 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
  }

  .row-title {
    font-size: 14px;
    font-weight: 600;
  }

  .row-desc {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

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

  .btn-install:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 26px;
    flex-shrink: 0;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: var(--surface-2);
    border-radius: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .slider::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    left: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle input:checked + .slider {
    background: var(--accent);
  }

  .toggle input:checked + .slider::before {
    transform: translateX(18px);
  }

  .binding-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .binding-row {
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .binding-label {
    font-size: 13px;
    font-weight: 600;
  }

  .binding-value {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
    font-family: monospace;
  }

  .binding-btns {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .btn-learn {
    padding: 6px 12px;
    background: var(--surface-2);
    border: 1px solid var(--indigo);
    border-radius: 6px;
    color: var(--indigo);
    font-size: 12px;
    cursor: pointer;
  }

  .btn-learn.active {
    background: #1e1b4b;
  }

  .btn-clear {
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
  }

  .learn-hint {
    font-size: 12px;
    color: var(--indigo);
    text-align: center;
    padding: 6px 0;
  }

  .ios-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    padding: 0;
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
</style>

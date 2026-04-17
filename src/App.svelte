<script lang="ts">
  import { onMount } from 'svelte'

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
  let installPrompt = $state<BeforeInstallPromptEvent | null>(null)
  let showBanner = $state(false)
  let showIosSheet = $state(false)
  let isIos = $state(false)
  let isStandalone = $state(false)
  let dismissedBanner = $state(false)

  function syncBannerVisibility(): void {
    showBanner = !isStandalone && !dismissedBanner && (isIos || installPrompt !== null)
  }

  onMount(() => {
    isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    isStandalone = window.matchMedia('(display-mode: standalone)').matches
    dismissedBanner = localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true'
    syncBannerVisibility()

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      installPrompt = event as BeforeInstallPromptEvent
      syncBannerVisibility()
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  })

  function dismissBanner(): void {
    dismissedBanner = true
    showBanner = false
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
  }

  function handleBannerInstall(): void {
    if (isIos) {
      showIosSheet = true
      return
    }

    if (!installPrompt) {
      return
    }

    void installPrompt.prompt()
    void installPrompt.userChoice.then(() => {
      installPrompt = null
      isStandalone = window.matchMedia('(display-mode: standalone)').matches
      showBanner = false
    })
  }

  function exitPerformance(): void {
    screen = { name: 'setlist-list' }
  }
</script>

<div class="app">
  {#if screen.name === 'setlist-list'}
    <SetlistList
      onOpenSetlist={(setlist) => {
        screen = { name: 'setlist-editor', setlist }
      }}
      onOpenSettings={() => {
        screen = { name: 'settings' }
      }}
    />
  {:else if screen.name === 'setlist-editor'}
    <SetlistEditor
      setlist={screen.setlist}
      onBack={() => {
        screen = { name: 'setlist-list' }
      }}
      onPlay={() => {
        screen = { name: 'performance' }
      }}
    />
  {:else if screen.name === 'performance'}
    <PerformanceScreen onExit={exitPerformance} />
  {:else}
    <Settings
      onBack={() => {
        screen = { name: 'setlist-list' }
      }}
      installPromptEvent={installPrompt}
    />
  {/if}

  {#if showBanner && screen.name !== 'performance'}
    <div class="install-banner">
      <span class="banner-text">Add GigBPM to your home screen for quick access</span>
      <button class="banner-add" onclick={handleBannerInstall}>Add</button>
      <button class="banner-dismiss" onclick={dismissBanner} aria-label="Dismiss">✕</button>
    </div>
  {/if}
</div>

{#if showIosSheet}
  <button
    class="ios-backdrop"
    type="button"
    aria-label="Close install instructions"
    onclick={() => (showIosSheet = false)}
  ></button>
  <div class="ios-sheet">
    <p>Tap the <strong>Share</strong> icon in Safari, then choose <strong>Add to Home Screen</strong>.</p>
    <button class="ios-got-it" onclick={() => (showIosSheet = false)}>Got it</button>
  </div>
{/if}

<style>
  .app {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .install-banner {
    position: fixed;
    bottom: env(safe-area-inset-bottom, 0px);
    left: 0;
    right: 0;
    background: #1a1a2e;
    border-top: 1px solid var(--indigo);
    padding: 12px var(--screen-padding-x);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    z-index: 20;
  }

  .banner-text {
    flex: 1 1 180px;
    font-size: 13px;
    color: #c7c7ff;
    min-width: 0;
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
    border: none;
    padding: 0;
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

  @media (max-width: 360px) {
    .install-banner {
      gap: 8px;
    }

    .banner-text {
      flex-basis: 100%;
    }
  }
</style>

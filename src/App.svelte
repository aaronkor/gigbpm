<script lang="ts">
  import PerformanceScreen from './components/PerformanceScreen.svelte'
  import SetlistEditor from './components/SetlistEditor.svelte'
  import SetlistList from './components/SetlistList.svelte'
  import Settings from './components/Settings.svelte'
  import type { Setlist } from './lib/types'

  type Screen =
    | { name: 'setlist-list' }
    | { name: 'setlist-editor'; setlist: Setlist }
    | { name: 'performance' }
    | { name: 'settings' }

  let screen = $state<Screen>({ name: 'setlist-list' })

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
    />
  {/if}
</div>

<style>
  .app {
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>

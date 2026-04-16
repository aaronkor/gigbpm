<script lang="ts">
  type Screen = 'setlist-list' | 'setlist-editor' | 'performance' | 'settings'

  let screen = $state<Screen>('setlist-list')
</script>

<div class="app">
  {#if screen === 'setlist-list'}
    <p class="placeholder">SetlistList (scaffold)</p>
  {:else if screen === 'setlist-editor'}
    <p class="placeholder">SetlistEditor (scaffold)</p>
  {:else if screen === 'performance'}
    <p class="placeholder">Performance (scaffold)</p>
  {:else}
    <p class="placeholder">Settings (scaffold)</p>
  {/if}
</div>

<style>
  .app {
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  .placeholder {
    padding: 16px;
    color: var(--text);
  }
</style>

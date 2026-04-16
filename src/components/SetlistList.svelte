<script lang="ts">
  import type { Setlist } from '../lib/types'

  let { onOpenSetlist, onOpenSettings }: {
    onOpenSetlist: (setlist: Setlist) => void
    onOpenSettings: () => void
  } = $props()
</script>

<div class="placeholder-screen">
  <p class="placeholder-label">SetlistList (placeholder)</p>
  <button class="placeholder-action" onclick={onOpenSettings}>Open Settings</button>
</div>

<style>
  .placeholder-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: center;
    align-items: center;
    padding: 24px;
  }

  .placeholder-label {
    color: var(--text);
  }

  .placeholder-action {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    padding: 10px 14px;
  }
</style>

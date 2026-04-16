<script lang="ts">
  import type { Setlist } from '../lib/types'

  let { setlist, onBack, onPlay }: {
    setlist: Setlist
    onBack: () => void
    onPlay: () => void
  } = $props()
</script>

<div class="placeholder-screen">
  <p class="placeholder-label">SetlistEditor (placeholder)</p>
  <p class="placeholder-meta">{setlist.name}</p>
  <div class="placeholder-actions">
    <button class="placeholder-action" onclick={onBack}>Back</button>
    <button class="placeholder-action" onclick={onPlay}>Play</button>
  </div>
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

  .placeholder-label,
  .placeholder-meta {
    color: var(--text);
  }

  .placeholder-meta {
    color: var(--text-muted);
  }

  .placeholder-actions {
    display: flex;
    gap: 8px;
  }

  .placeholder-action {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    padding: 10px 14px;
  }
</style>

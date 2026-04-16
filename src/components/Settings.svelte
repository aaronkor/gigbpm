<script lang="ts">
  let { onBack }: { onBack: () => void } = $props()
</script>

<div class="placeholder-screen">
  <p class="placeholder-label">Settings (placeholder)</p>
  <button class="placeholder-action" onclick={onBack}>Back</button>
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

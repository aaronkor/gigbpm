<script lang="ts">
  let { message = '', show = false, onclick = undefined }: {
    message: string
    show: boolean
    onclick?: () => void
  } = $props()
</script>

{#if show}
  <button class="toast" class:clickable={!!onclick} onclick={() => onclick?.()}>
    {message}
  </button>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface);
    color: var(--text);
    padding: 10px 20px;
    border-radius: 20px;
    border: 1px solid var(--border);
    font-size: 13px;
    z-index: 100;
    white-space: nowrap;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    cursor: default;
  }

  .toast.clickable {
    cursor: pointer;
    border-color: var(--indigo);
    color: var(--indigo);
  }
</style>

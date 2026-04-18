<script lang="ts">
  import { onDestroy, tick } from 'svelte'

  import AppLogo from './AppLogo.svelte'
  import Toast from './Toast.svelte'

  import { exportSetlist, shareSetlist, validateImport } from '../lib/importexport'
  import type { Setlist } from '../lib/types'
  import { setlistsStore } from '../stores/setlists'
  import pkg from '../../package.json'

  let { onOpenSetlist, onOpenSettings }: {
    onOpenSetlist: (setlist: Setlist) => void
    onOpenSettings: () => void
  } = $props()

  let toastMessage = $state('')
  let showToast = $state(false)
  let renamingId = $state<string | null>(null)
  let renameValue = $state('')
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let renameInput = $state<HTMLInputElement | null>(null)
  let expandedId = $state<string | null>(null)
  let showAbout = $state(false)

  function toast(message: string, duration = 2500): void {
    if (toastTimer) {
      clearTimeout(toastTimer)
    }

    toastMessage = message
    showToast = true
    toastTimer = setTimeout(() => {
      showToast = false
      toastTimer = null
    }, duration)
  }

  function handleCreate(): void {
    const setlist = setlistsStore.add(`Set ${$setlistsStore.all.length + 1}`)
    onOpenSetlist(setlist)
  }

  function startRename(setlist: Setlist): void {
    expandedId = null
    renamingId = setlist.id
    renameValue = setlist.name
  }

  function commitRename(id: string): void {
    const value = renameValue.trim()

    if (value) {
      setlistsStore.rename(id, value)
    }

    renamingId = null
    renameValue = ''
  }

  async function handleImport(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const setlist = validateImport(JSON.parse(text))
      setlistsStore.importSetlist(setlist)
      toast('Setlist imported')
    } catch {
      toast("Couldn't import setlist: invalid file")
    }

    ;(event.target as HTMLInputElement).value = ''
  }

  function handleExport(setlist: Setlist): void {
    exportSetlist(setlist)
  }

  async function handleShare(setlist: Setlist): Promise<void> {
    try {
      await shareSetlist(setlist)
    } catch {
      toast("Couldn't share setlist")
    }
  }

  onDestroy(() => {
    if (toastTimer) clearTimeout(toastTimer)
  })

  $effect(() => {
    if (!renamingId) {
      return
    }

    void tick().then(() => renameInput?.focus())
  })
</script>

<div class="screen">
  <header>
    <button class="brand" onclick={() => showAbout = true} aria-label="About GigBPM">
      <AppLogo size="32px" />
    </button>
    <span class="header-title">GigBPM</span>
    <button class="icon-btn" onclick={onOpenSettings} aria-label="Settings">⚙</button>
  </header>

  {#if showAbout}
    <div
      class="modal-backdrop"
      onclick={() => showAbout = false}
      onkeydown={(e) => e.key === 'Escape' && (showAbout = false)}
      role="presentation"
    >
      <div
        class="modal"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="About GigBPM"
        tabindex="-1"
      >
        <AppLogo size="52px" />
        <h2 class="modal-name">GigBPM</h2>
        <p class="modal-version">Version {pkg.version}</p>
        <p class="modal-dev">by Aaron Kor</p>
        <button class="modal-close" onclick={() => showAbout = false}>Close</button>
      </div>
    </div>
  {/if}

  <div class="list">
    {#each $setlistsStore.all as setlist (setlist.id)}
      <div class="row">
        {#if renamingId === setlist.id}
          <input
            class="rename-input"
            bind:this={renameInput}
            bind:value={renameValue}
            onblur={() => commitRename(setlist.id)}
            onkeydown={(event) => event.key === 'Enter' && commitRename(setlist.id)}
          />
        {:else}
          <div class="row-header">
            <button class="row-main" onclick={() => onOpenSetlist(setlist)}>
              <span class="row-name">{setlist.name}</span>
              <span class="row-meta">
                {setlist.songs.length} song{setlist.songs.length !== 1 ? 's' : ''}
              </span>
            </button>
            <button
              class="arrow-btn"
              class:open={expandedId === setlist.id}
              onclick={() => {
                expandedId = expandedId === setlist.id ? null : setlist.id
              }}
              aria-label={expandedId === setlist.id ? 'Collapse actions' : 'Expand actions'}
            >
              {expandedId === setlist.id ? '▲' : '▼'}
            </button>
          </div>
          {#if expandedId === setlist.id}
            <div class="row-actions">
              <button onclick={() => startRename(setlist)}>Rename</button>
              <button onclick={() => handleShare(setlist)}>Share</button>
              <button onclick={() => handleExport(setlist)}>Export</button>
              <button class="danger" onclick={() => setlistsStore.remove(setlist.id)}>
                Delete
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/each}

    {#if $setlistsStore.all.length === 0}
      <p class="empty">No setlists yet. Create one below.</p>
    {/if}
  </div>

  <div class="bottom-actions">
    <label class="btn-secondary">
      Import
      <input type="file" accept=".json" onchange={handleImport} hidden />
    </label>
    <button class="btn-primary" onclick={handleCreate}>+ New Setlist</button>
  </div>
</div>

<Toast message={toastMessage} show={showToast} />

<style>
  .screen {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }

  .brand {
    display: flex;
    align-items: center;
    color: var(--text);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .header-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text);
    pointer-events: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 220px;
  }

  .modal-name {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin: 8px 0 0;
  }

  .modal-version {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .modal-dev {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .modal-close {
    margin-top: 20px;
    padding: 9px 28px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
  }

  .icon-btn {
    background: none;
    border: none;
    color: var(--text);
    font-size: 20px;
    cursor: pointer;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    padding: 32px 0;
  }

  .row {
    background: var(--surface);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .row-header {
    display: flex;
    align-items: center;
  }

  .row-main {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }

  .arrow-btn {
    align-self: stretch;
    padding: 0 16px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
  }

  .arrow-btn.open {
    color: var(--indigo);
  }

  .row-name {
    font-size: 14px;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-meta {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .row-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-top: 1px solid var(--border);
  }

  .row-actions button {
    min-width: 0;
    padding: 9px 0;
    background: none;
    border: none;
    border-right: 1px solid var(--border);
    color: var(--indigo);
    font-size: 12px;
    cursor: pointer;
  }

  .row-actions button:last-child {
    border-right: none;
  }

  .row-actions button.danger {
    color: var(--danger);
  }

  .rename-input {
    width: 100%;
    padding: 14px 16px;
    background: var(--surface-2);
    border: 1px solid var(--indigo);
    border-radius: 0;
    color: var(--text);
    font-size: 14px;
  }

  .bottom-actions {
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    border-top: 1px solid var(--border);
  }

  .btn-primary {
    flex: 1;
    padding: 13px;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-secondary {
    flex: 1 1 120px;
    padding: 13px 18px;
    background: var(--surface);
    color: var(--indigo);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
  }

  @media (max-width: 360px) {
    .row-main {
      gap: 10px;
      padding: 12px 14px;
    }

    .row-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>

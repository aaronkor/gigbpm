<script lang="ts">
  import type { Song } from '../lib/types'

  let { song, onSave, onCancel }: {
    song: Song | null
    onSave: (data: { name: string; bpm: number }) => void
    onCancel: () => void
  } = $props()

  let name = $state(song?.name ?? '')
  let bpm = $state(song?.bpm ?? 120)

  function handleSave(): void {
    if (!name.trim()) {
      return
    }

    onSave({ name: name.trim(), bpm })
  }
</script>

<div class="overlay" role="presentation" onclick={onCancel}></div>

<div class="sheet" role="dialog" aria-label={song ? 'Edit Song' : 'Add Song'}>
  <h2>{song ? 'Edit Song' : 'Add Song'}</h2>

  <label class="field">
    <span>Song Name</span>
    <input type="text" bind:value={name} placeholder="Song name" autofocus />
  </label>

  <label class="field">
    <span>BPM</span>
    <input type="number" bind:value={bpm} min="20" max="300" />
  </label>

  <div class="actions">
    <button class="btn-cancel" onclick={onCancel}>Cancel</button>
    <button class="btn-save" onclick={handleSave} disabled={!name.trim()}>Save</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10;
  }

  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 11;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-top: 1px solid var(--border);
  }

  h2 {
    font-size: 15px;
    font-weight: 700;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field span {
    font-size: 12px;
    color: var(--text-muted);
  }

  .field input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 10px 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .btn-cancel,
  .btn-save {
    flex: 1;
    padding: 12px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    cursor: pointer;
  }

  .btn-cancel {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
  }

  .btn-save {
    background: var(--accent);
    border: none;
    color: #000;
    font-weight: 700;
  }

  .btn-save:disabled {
    background: var(--surface-2);
    color: var(--text-muted);
    cursor: default;
  }
</style>

<script lang="ts">
  import { dndzone, type DndEvent } from 'svelte-dnd-action'

  import SongEditor from './SongEditor.svelte'
  import Toast from './Toast.svelte'

  import type { Setlist, Song } from '../lib/types'
  import { performanceStore } from '../stores/performance'
  import { setlistsStore } from '../stores/setlists'

  type SongDraft = {
    name: string
    bpm: number
  }

  let { setlist, onBack, onPlay }: {
    setlist: Setlist
    onBack: () => void
    onPlay: () => void
  } = $props()

  let current = $derived($setlistsStore.all.find((entry) => entry.id === setlist.id) ?? setlist)
  let draftSongs = $state<Song[]>(current.songs)
  let isDragging = $state(false)
  let editingSong = $state<Song | null>(null)
  let addingNew = $state(false)
  let toastMessage = $state('')
  let showToast = $state(false)
  let undoSong = $state<{ song: Song; index: number } | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function toast(message: string): void {
    if (toastTimer) {
      clearTimeout(toastTimer)
    }

    toastMessage = message
    showToast = true
    toastTimer = setTimeout(() => {
      showToast = false
      undoSong = null
      toastTimer = null
    }, 3000)
  }

  function handlePlay(): void {
    performanceStore.enter(current)
    onPlay()
  }

  function handleSaveSong(data: SongDraft): void {
    if (editingSong) {
      setlistsStore.updateSong(current.id, { ...editingSong, ...data })
    } else {
      setlistsStore.addSong(current.id, data)
    }

    closeEditor()
  }

  function handleDeleteSong(song: Song, index: number): void {
    undoSong = { song, index }
    setlistsStore.removeSong(current.id, song.id)
    toast('Song deleted - tap to undo')
  }

  function handleUndo(): void {
    if (!undoSong) {
      return
    }

    const songs = [...current.songs]
    songs.splice(undoSong.index, 0, undoSong.song)
    setlistsStore.reorderSongs(current.id, songs)
    undoSong = null
    showToast = false
  }

  function handleDndConsider(event: CustomEvent<DndEvent<Song>>): void {
    isDragging = true
    draftSongs = event.detail.items
  }

  function handleDndFinalize(event: CustomEvent<DndEvent<Song>>): void {
    isDragging = false
    setlistsStore.reorderSongs(current.id, event.detail.items)
  }

  function closeEditor(): void {
    editingSong = null
    addingNew = false
  }

  $effect(() => {
    if (!isDragging) {
      draftSongs = current.songs
    }
  })
</script>

<div class="screen">
  <header>
    <button class="nav-btn" onclick={onBack}>← Back</button>
    <h1>{current.name}</h1>
    <button class="play-btn" onclick={handlePlay} disabled={current.songs.length === 0}>▶ Play</button>
  </header>

  <div
    class="list"
    use:dndzone={{ items: draftSongs, flipDurationMs: 150 }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
  >
    {#each draftSongs as song, index (song.id)}
      <div class="song-row">
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <button
          class="song-main"
          onclick={() => {
            editingSong = song
            addingNew = false
          }}
        >
          <span class="song-name">{song.name}</span>
          <span class="song-bpm">♩ {song.bpm} BPM</span>
        </button>
        <button class="del-btn" onclick={() => handleDeleteSong(song, index)}>✕</button>
      </div>
    {/each}

    {#if current.songs.length === 0}
      <p class="empty">No songs yet. Add one below.</p>
    {/if}
  </div>

  <div class="bottom-actions">
    <button
      class="btn-primary"
      onclick={() => {
        addingNew = true
        editingSong = null
      }}
    >
      + Add Song
    </button>
  </div>
</div>

{#if addingNew || editingSong}
  <SongEditor song={editingSong} onSave={handleSaveSong} onCancel={closeEditor} />
{/if}

<Toast message={toastMessage} show={showToast} onclick={undoSong ? handleUndo : undefined} />

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
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }

  .nav-btn {
    background: none;
    border: none;
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
  }

  .play-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .play-btn:disabled {
    color: var(--text-muted);
    cursor: default;
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

  .song-row {
    background: var(--surface);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .drag-handle {
    padding: 13px 10px 13px 14px;
    color: var(--text-muted);
    font-size: 16px;
    cursor: grab;
    user-select: none;
    flex-shrink: 0;
  }

  .song-main {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 13px 8px;
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }

  .song-name {
    font-size: 14px;
    font-weight: 600;
  }

  .song-bpm {
    font-size: 12px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .del-btn {
    padding: 13px 14px;
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .bottom-actions {
    padding: 16px;
    border-top: 1px solid var(--border);
  }

  .btn-primary {
    width: 100%;
    padding: 14px;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
</style>

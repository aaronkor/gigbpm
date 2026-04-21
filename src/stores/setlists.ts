import { get, writable } from 'svelte/store'

import { generateId } from '../lib/id'
import { loadSetlists, saveSetlists } from '../lib/storage'
import { BPM_MAX, BPM_MIN, type Setlist, type Song } from '../lib/types'

interface SetlistsState {
  all: Setlist[]
}

function createSetlistsStore() {
  const store = writable<SetlistsState>({ all: loadSetlists() })

  function persist(all: Setlist[]): void {
    saveSetlists(all)
  }

  function updateAll(transform: (all: Setlist[]) => Setlist[]): void {
    store.update((state) => {
      const all = transform(state.all)
      persist(all)
      return { all }
    })
  }

  function clampBpm(bpm: number): number {
    return Math.min(BPM_MAX, Math.max(BPM_MIN, bpm))
  }

  return {
    subscribe: store.subscribe,

    get all() {
      return get(store).all
    },

    add(name: string): Setlist {
      const setlist: Setlist = { id: generateId(), name, songs: [] }

      updateAll((all) => [...all, setlist])

      return setlist
    },

    rename(id: string, name: string): void {
      updateAll((all) => all.map((setlist) => (setlist.id === id ? { ...setlist, name } : setlist)))
    },

    remove(id: string): void {
      updateAll((all) => all.filter((setlist) => setlist.id !== id))
    },

    addSong(setlistId: string, song: Omit<Song, 'id'>): Song {
      const newSong: Song = { id: generateId(), ...song }

      updateAll((all) =>
        all.map((setlist) =>
          setlist.id === setlistId
            ? { ...setlist, songs: [...setlist.songs, newSong] }
            : setlist,
        ),
      )

      return newSong
    },

    updateSong(setlistId: string, song: Song): void {
      updateAll((all) =>
        all.map((setlist) =>
          setlist.id === setlistId
            ? {
                ...setlist,
                songs: setlist.songs.map((existingSong) =>
                  existingSong.id === song.id ? song : existingSong,
                ),
              }
            : setlist,
        ),
      )
    },

    updateSongBpm(setlistId: string, songId: string, bpm: number): void {
      const nextBpm = clampBpm(bpm)

      updateAll((all) =>
        all.map((setlist) =>
          setlist.id === setlistId
            ? {
                ...setlist,
                songs: setlist.songs.map((song) =>
                  song.id === songId ? { ...song, bpm: nextBpm } : song,
                ),
              }
            : setlist,
        ),
      )
    },

    removeSong(setlistId: string, songId: string): void {
      updateAll((all) =>
        all.map((setlist) =>
          setlist.id === setlistId
            ? {
                ...setlist,
                songs: setlist.songs.filter((song) => song.id !== songId),
              }
            : setlist,
        ),
      )
    },

    reorderSongs(setlistId: string, songs: Song[]): void {
      updateAll((all) =>
        all.map((setlist) => (setlist.id === setlistId ? { ...setlist, songs } : setlist)),
      )
    },

    importSetlist(setlist: Setlist): void {
      updateAll((all) => [...all, setlist])
    },
  }
}

export const setlistsStore = createSetlistsStore()

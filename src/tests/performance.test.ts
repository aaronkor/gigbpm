import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadSetlists } from '../lib/storage'
import { BPM_MAX, BPM_MIN, type Setlist } from '../lib/types'
import { performanceStore } from '../stores/performance'
import { setlistsStore } from '../stores/setlists'

const makeSetlist = (songCount: number): Setlist => ({
  id: 'sl1',
  name: 'Test Set',
  songs: Array.from({ length: songCount }, (_, index) => ({
    id: `s${index}`,
    name: `Song ${index + 1}`,
    bpm: 100 + index * 10,
  })),
})

describe('performanceStore.prev()', () => {
  beforeEach(() => {
    performanceStore.exit()
    setlistsStore.all.forEach((setlist) => setlistsStore.remove(setlist.id))
    localStorage.clear()
  })

  it('does nothing when no setlist is loaded', () => {
    performanceStore.prev()

    expect(get(performanceStore).songIndex).toBe(0)
  })

  it('wraps from first song to last song', () => {
    performanceStore.enter(makeSetlist(3))

    performanceStore.prev()

    expect(get(performanceStore).songIndex).toBe(2)
  })

  it('goes back one song from a middle song', () => {
    performanceStore.enter(makeSetlist(3))
    performanceStore.next()

    performanceStore.prev()

    expect(get(performanceStore).songIndex).toBe(0)
  })

  it('preserves paused state when going back', () => {
    performanceStore.enter(makeSetlist(3))
    performanceStore.next()
    performanceStore.pause()

    performanceStore.prev()

    const state = get(performanceStore)

    expect(state.songIndex).toBe(0)
    expect(state.paused).toBe(true)
    expect(state.running).toBe(false)
  })

  it('does nothing on an empty setlist', () => {
    performanceStore.enter(makeSetlist(0))

    performanceStore.prev()

    expect(get(performanceStore).songIndex).toBe(0)
  })

  it('wraps to itself on a single-song setlist', () => {
    performanceStore.enter(makeSetlist(1))

    performanceStore.prev()

    expect(get(performanceStore).songIndex).toBe(0)
  })
})

describe('performanceStore.adjustCurrentSongBpm()', () => {
  beforeEach(() => {
    performanceStore.exit()
    setlistsStore.all.forEach((setlist) => setlistsStore.remove(setlist.id))
    localStorage.clear()
  })

  function enterPersistedSetlist(setlist: Setlist): void {
    setlistsStore.importSetlist(setlist)
    performanceStore.enter(setlist)
  }

  it('updates the active song BPM immediately', () => {
    enterPersistedSetlist(makeSetlist(1))

    performanceStore.adjustCurrentSongBpm(1)

    expect(get(performanceStore).currentSong?.bpm).toBe(101)
  })

  it('persists the adjusted BPM to localStorage', () => {
    enterPersistedSetlist(makeSetlist(1))

    performanceStore.adjustCurrentSongBpm(1)

    expect(loadSetlists()[0].songs[0].bpm).toBe(101)
  })

  it('clamps adjustments to the supported BPM range', () => {
    const setlist: Setlist = {
      id: 'sl1',
      name: 'Test Set',
      songs: [{ id: 's1', name: 'Song 1', bpm: BPM_MAX }],
    }

    enterPersistedSetlist(setlist)
    performanceStore.adjustCurrentSongBpm(1)
    expect(get(performanceStore).currentSong?.bpm).toBe(BPM_MAX)

    performanceStore.adjustCurrentSongBpm(BPM_MIN - BPM_MAX)
    expect(get(performanceStore).currentSong?.bpm).toBe(BPM_MIN)
  })

  it('preserves paused state while adjusting tempo', () => {
    enterPersistedSetlist(makeSetlist(1))
    performanceStore.pause()

    performanceStore.adjustCurrentSongBpm(1)

    const state = get(performanceStore)
    expect(state.currentSong?.bpm).toBe(101)
    expect(state.paused).toBe(true)
    expect(state.running).toBe(false)
  })

  it('does nothing on an empty setlist', () => {
    enterPersistedSetlist(makeSetlist(0))

    performanceStore.adjustCurrentSongBpm(1)

    expect(get(performanceStore).songIndex).toBe(0)
    expect(loadSetlists()[0].songs).toEqual([])
  })

  it('keeps the edited BPM when navigating away and back', () => {
    enterPersistedSetlist(makeSetlist(2))

    performanceStore.adjustCurrentSongBpm(1)
    performanceStore.next()
    performanceStore.prev()

    expect(get(performanceStore).currentSong?.bpm).toBe(101)
  })
})

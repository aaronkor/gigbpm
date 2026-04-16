import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Setlist } from '../lib/types'
import { performanceStore } from '../stores/performance'

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

import { get, writable } from 'svelte/store'

import { createMetronome, type Metronome } from '../lib/metronome'
import { createMidiController, type MidiController } from '../lib/midi'
import { announce, isTTSAvailable } from '../lib/tts'
import type { ClickChannel, ClickSound, CustomSoundParams, Setlist, Song } from '../lib/types'
import { settingsStore } from './settings'

interface PerformanceState {
  setlist: Setlist | null
  songIndex: number
  running: boolean
  paused: boolean
  currentSong: Song | null
  totalSongs: number
  metronome: Metronome
}

function createNoopMetronome(): Metronome {
  let beatCallback: (() => void) | null = null

  return {
    start(): void {},
    stop(): void {},
    pause(): void {},
    resume(): void {},
    setBpm(): void {},
    setClickSound(): void {},
    setCustomSoundParams(): void {},
    setClickChannel(): void {},
    onBeat(callback: () => void): void {
      beatCallback = callback
    },
    get isRunning() {
      return false
    },
    get isPaused() {
      return false
    },
  }
}

function createAudioContextInstance(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  return AudioContextConstructor ? new AudioContextConstructor() : null
}

const audioContext = createAudioContextInstance()
const metronome: Metronome = audioContext ? createMetronome(audioContext) : createNoopMetronome()
let syncedClickSound: ClickSound | null = null
let syncedCustomSound: CustomSoundParams | null = null
let syncedClickChannel: ClickChannel | null = null

settingsStore.subscribe(($settings) => {
  const clickSoundChanged = $settings.clickSound !== syncedClickSound
  const customSoundChanged = $settings.customSound !== syncedCustomSound
  const clickChannelChanged = $settings.clickChannel !== syncedClickChannel

  if (clickSoundChanged) {
    metronome.setClickSound($settings.clickSound)
    syncedClickSound = $settings.clickSound
  }

  if (customSoundChanged || (clickSoundChanged && $settings.clickSound === 'custom')) {
    metronome.setCustomSoundParams($settings.customSound)
    syncedCustomSound = $settings.customSound
  }

  if (clickChannelChanged) {
    metronome.setClickChannel($settings.clickChannel)
    syncedClickChannel = $settings.clickChannel
  }
})

function createState(
  setlist: Setlist | null,
  songIndex: number,
  running: boolean,
  paused: boolean,
): PerformanceState {
  const currentSong = setlist?.songs[songIndex] ?? null

  return {
    setlist,
    songIndex,
    running,
    paused,
    currentSong,
    totalSongs: setlist?.songs.length ?? 0,
    metronome,
  }
}

function createPerformanceStore() {
  const store = writable<PerformanceState>(createState(null, 0, false, false))

  const midiController: MidiController = createMidiController(
    () => performanceStore.next(),
    () => {
      if (performanceStore.running) {
        performanceStore.pause()
        return
      }

      performanceStore.resume()
    },
  )

  function maybeAnnounce(song: Song | null): void {
    if (!song || !settingsStore.announceSongName || !isTTSAvailable()) {
      return
    }

    announce(song.name)
  }

  return {
    subscribe: store.subscribe,

    get setlist() {
      return get(store).setlist
    },

    get songIndex() {
      return get(store).songIndex
    },

    get running() {
      return get(store).running
    },

    get paused() {
      return get(store).paused
    },

    get currentSong() {
      return get(store).currentSong
    },

    get totalSongs() {
      return get(store).totalSongs
    },

    get metronome() {
      return metronome
    },

    enter(setlist: Setlist): void {
      const initialState = createState(setlist, 0, false, false)

      store.set(initialState)

      if (!initialState.currentSong) {
        midiController.disable()
        metronome.stop()
        return
      }

      metronome.start(initialState.currentSong.bpm)
      maybeAnnounce(initialState.currentSong)

      if (settingsStore.midi.enabled) {
        midiController.setBindings(settingsStore.midi.advance, settingsStore.midi.pauseStop)
        void midiController.enable()
      } else {
        midiController.disable()
      }

      store.set(createState(setlist, 0, true, false))
    },

    exit(): void {
      metronome.stop()
      midiController.disable()
      store.set(createState(null, 0, false, false))
    },

    next(): void {
      const state = get(store)

      if (!state.setlist || state.setlist.songs.length === 0) {
        return
      }

      const nextIndex = (state.songIndex + 1) % state.setlist.songs.length
      const nextSong = state.setlist.songs[nextIndex] ?? null

      if (!nextSong) {
        return
      }

      metronome.setBpm(nextSong.bpm)
      maybeAnnounce(nextSong)
      store.set(createState(state.setlist, nextIndex, state.running, state.paused))
    },

    pause(): void {
      const state = get(store)

      if (!state.setlist || state.paused) {
        return
      }

      metronome.pause()
      store.set(createState(state.setlist, state.songIndex, false, true))
    },

    resume(): void {
      const state = get(store)

      if (!state.setlist || !state.paused) {
        return
      }

      metronome.resume()
      store.set(createState(state.setlist, state.songIndex, true, false))
    },

    prev(): void {
      const state = get(store)

      if (!state.setlist || state.setlist.songs.length === 0) {
        return
      }

      const prevIndex =
        (state.songIndex - 1 + state.setlist.songs.length) % state.setlist.songs.length
      const prevSong = state.setlist.songs[prevIndex] ?? null

      if (!prevSong) {
        return
      }

      metronome.setBpm(prevSong.bpm)
      maybeAnnounce(prevSong)
      store.set(createState(state.setlist, prevIndex, state.running, state.paused))
    },
  }
}

export const performanceStore = createPerformanceStore()

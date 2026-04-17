import { get, writable } from 'svelte/store'

import { loadSettings, saveSettings } from '../lib/storage'
import type { AppSettings, ClickSound, MidiCCBinding } from '../lib/types'

interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  midi: AppSettings['midi']
}

function createState(all: AppSettings): SettingsState {
  return {
    all,
    announceSongName: all.announceSongName,
    clickSound: all.clickSound,
    midi: all.midi,
  }
}

function createSettingsStore() {
  const store = writable<SettingsState>(createState(loadSettings()))

  function persist(all: AppSettings): void {
    saveSettings(all)
  }

  function updateSettings(transform: (settings: AppSettings) => AppSettings): void {
    store.update((state) => {
      const all = transform(state.all)
      persist(all)
      return createState(all)
    })
  }

  return {
    subscribe: store.subscribe,

    get all() {
      return get(store).all
    },

    get announceSongName() {
      return get(store).announceSongName
    },

    get clickSound() {
      return get(store).clickSound
    },

    get midi() {
      return get(store).midi
    },

    setAnnounceSongName(value: boolean): void {
      updateSettings((settings) => ({ ...settings, announceSongName: value }))
    },

    setClickSound(value: ClickSound): void {
      updateSettings((settings) => ({ ...settings, clickSound: value }))
    },

    setMidiEnabled(value: boolean): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, enabled: value },
      }))
    },

    setMidiAdvanceBinding(binding: MidiCCBinding | null): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, advance: binding },
      }))
    },

    setMidiPauseStopBinding(binding: MidiCCBinding | null): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, pauseStop: binding },
      }))
    },
  }
}

export const settingsStore = createSettingsStore()

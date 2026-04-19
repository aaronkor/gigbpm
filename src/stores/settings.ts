import { get, writable } from 'svelte/store'

import { loadSettings, saveSettings } from '../lib/storage'
import type { AppSettings, ClickChannel, ClickSound, CustomSoundParams, MidiBinding } from '../lib/types'

interface SettingsState {
  all: AppSettings
  announceSongName: boolean
  clickSound: ClickSound
  clickChannel: ClickChannel
  performanceMode: boolean
  midi: AppSettings['midi']
  customSound: CustomSoundParams
}

function createState(all: AppSettings): SettingsState {
  return {
    all,
    announceSongName: all.announceSongName,
    clickSound: all.clickSound,
    clickChannel: all.clickChannel,
    performanceMode: all.performanceMode,
    midi: all.midi,
    customSound: all.customSound,
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

    get performanceMode() {
      return get(store).performanceMode
    },

    get midi() {
      return get(store).midi
    },

    get customSound() {
      return get(store).customSound
    },

    get clickChannel() {
      return get(store).clickChannel
    },

    setAnnounceSongName(value: boolean): void {
      updateSettings((settings) => ({ ...settings, announceSongName: value }))
    },

    setClickSound(value: ClickSound): void {
      updateSettings((settings) => ({ ...settings, clickSound: value }))
    },

    setClickChannel(value: ClickChannel): void {
      updateSettings((settings) => ({ ...settings, clickChannel: value }))
    },

    setCustomSound(params: CustomSoundParams): void {
      updateSettings((settings) => ({ ...settings, customSound: params }))
    },

    setPerformanceMode(value: boolean): void {
      updateSettings((settings) => ({ ...settings, performanceMode: value }))
    },

    setMidiEnabled(value: boolean): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, enabled: value },
      }))
    },

    setMidiAdvanceBinding(binding: MidiBinding | null): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, advance: binding },
      }))
    },

    setMidiPauseStopBinding(binding: MidiBinding | null): void {
      updateSettings((settings) => ({
        ...settings,
        midi: { ...settings.midi, pauseStop: binding },
      }))
    },
  }
}

export const settingsStore = createSettingsStore()

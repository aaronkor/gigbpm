export interface Song {
  id: string
  name: string
  bpm: number
}

export interface Setlist {
  id: string
  name: string
  songs: Song[]
}

export type MidiBinding =
  | { type: 'cc';   channel: number | 'any'; cc: number }
  | { type: 'note'; channel: number | 'any'; note: number }
  | { type: 'pc';   channel: number | 'any'; program: number }

export type ClickSoundSource = 'sine' | 'square' | 'noise'

export interface CustomSoundParams {
  source: ClickSoundSource
  pitch: number
  duration: number
  decay: number
}

export type ClickSound = 'wood' | 'beep' | 'tick' | 'custom'

export interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  performanceMode: boolean
  midi: {
    enabled: boolean
    advance: MidiBinding | null
    pauseStop: MidiBinding | null
  }
  customSound: CustomSoundParams
}

export const BPM_MIN = 20
export const BPM_MAX = 300

export const DEFAULT_CUSTOM_SOUND: CustomSoundParams = {
  source: 'sine',
  pitch: 440,
  duration: 40,
  decay: 200,
}

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  performanceMode: false,
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
  customSound: DEFAULT_CUSTOM_SOUND,
}

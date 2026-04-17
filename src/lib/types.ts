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

export interface MidiCCBinding {
  channel: number | 'any'
  cc: number
}

export type ClickSound = 'wood' | 'beep' | 'tick'

export interface AppSettings {
  announceSongName: boolean
  clickSound: ClickSound
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}

export const BPM_MIN = 20
export const BPM_MAX = 300

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  clickSound: 'wood',
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
}

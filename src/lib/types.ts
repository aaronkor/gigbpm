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

export interface AppSettings {
  announceSongName: boolean
  midi: {
    enabled: boolean
    advance: MidiCCBinding | null
    pauseStop: MidiCCBinding | null
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  announceSongName: false,
  midi: {
    enabled: false,
    advance: null,
    pauseStop: null,
  },
}

import { DEFAULT_SETTINGS, type AppSettings, type MidiBinding, type Setlist } from './types'

const SETLISTS_KEY = 'gigbpm_setlists'
const SETTINGS_KEY = 'gigbpm_settings'

function cloneDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    midi: { ...DEFAULT_SETTINGS.midi },
    customSound: { ...DEFAULT_SETTINGS.customSound },
  }
}

function migrateMidiBinding(b: unknown): MidiBinding | null {
  if (!b || typeof b !== 'object') return null
  const obj = b as Record<string, unknown>
  if (!obj.type && 'cc' in obj) {
    return { type: 'cc', channel: obj.channel as number | 'any', cc: obj.cc as number }
  }
  return obj as MidiBinding
}

export function loadSetlists(): Setlist[] {
  try {
    const raw = localStorage.getItem(SETLISTS_KEY)
    return raw ? (JSON.parse(raw) as Setlist[]) : []
  } catch {
    return []
  }
}

export function saveSetlists(setlists: Setlist[]): void {
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(setlists))
}

export function loadSettings(): AppSettings {
  const defaults = cloneDefaultSettings()

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)

    if (!raw) {
      return defaults
    }

    const stored = JSON.parse(raw) as Partial<AppSettings>

    const settings = {
      ...defaults,
      ...stored,
      midi: {
        ...defaults.midi,
        ...stored.midi,
      },
      customSound: {
        ...defaults.customSound,
        ...stored.customSound,
      },
    }

    // Migrate legacy MIDI bindings without type field
    settings.midi.advance = migrateMidiBinding(settings.midi.advance)
    settings.midi.pauseStop = migrateMidiBinding(settings.midi.pauseStop)

    return settings
  } catch {
    return defaults
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

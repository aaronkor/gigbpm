import { DEFAULT_SETTINGS, type AppSettings, type Setlist } from './types'

const SETLISTS_KEY = 'gigbpm_setlists'
const SETTINGS_KEY = 'gigbpm_settings'

function cloneDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    midi: { ...DEFAULT_SETTINGS.midi },
  }
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

    return {
      ...defaults,
      ...stored,
      midi: {
        ...defaults.midi,
        ...stored.midi,
      },
    }
  } catch {
    return defaults
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

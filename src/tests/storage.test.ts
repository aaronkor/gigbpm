import { beforeEach, describe, expect, it } from 'vitest'

import { loadSettings, loadSetlists, saveSettings, saveSetlists } from '../lib/storage'
import { DEFAULT_SETTINGS, type AppSettings, type Setlist } from '../lib/types'
import { settingsStore } from '../stores/settings'

const mockSetlist: Setlist = {
  id: 'abc',
  name: 'Test Gig',
  songs: [{ id: 's1', name: 'Song One', bpm: 120 }],
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadSetlists', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadSetlists()).toEqual([])
  })

  it('returns stored setlists', () => {
    localStorage.setItem('gigbpm_setlists', JSON.stringify([mockSetlist]))
    expect(loadSetlists()).toEqual([mockSetlist])
  })

  it('returns empty array on corrupt data', () => {
    localStorage.setItem('gigbpm_setlists', 'not-json')
    expect(loadSetlists()).toEqual([])
  })
})

describe('saveSetlists', () => {
  it('persists setlists to localStorage', () => {
    saveSetlists([mockSetlist])
    expect(JSON.parse(localStorage.getItem('gigbpm_setlists') ?? 'null')).toEqual([
      mockSetlist,
    ])
  })
})

describe('loadSettings', () => {
  it('returns DEFAULT_SETTINGS when nothing stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns wood as default clickSound', () => {
    expect(loadSettings().clickSound).toBe('wood')
  })

  it('merges stored settings with defaults', () => {
    localStorage.setItem('gigbpm_settings', JSON.stringify({ announceSongName: true }))
    expect(loadSettings().announceSongName).toBe(true)
    expect(loadSettings().midi).toEqual(DEFAULT_SETTINGS.midi)
  })

  it('merges stored clickSound with defaults', () => {
    localStorage.setItem('gigbpm_settings', JSON.stringify({ clickSound: 'beep' }))
    expect(loadSettings().clickSound).toBe('beep')
    expect(loadSettings().midi).toEqual(DEFAULT_SETTINGS.midi)
  })

  it('defaults performanceMode to false when field is missing from stored data', () => {
    localStorage.setItem('gigbpm_settings', JSON.stringify({ announceSongName: true }))
    expect(loadSettings().performanceMode).toBe(false)
  })
})

describe('saveSettings', () => {
  it('persists settings to localStorage', () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS, announceSongName: true }
    saveSettings(settings)
    expect(
      JSON.parse(localStorage.getItem('gigbpm_settings') ?? 'null').announceSongName,
    ).toBe(true)
  })
})

describe('settingsStore.setClickSound', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsStore.setClickSound('wood')
  })

  it('defaults clickSound to wood', () => {
    expect(settingsStore.clickSound).toBe('wood')
  })

  it('updates clickSound and persists it', () => {
    settingsStore.setClickSound('beep')

    expect(settingsStore.clickSound).toBe('beep')
    expect(JSON.parse(localStorage.getItem('gigbpm_settings') ?? '{}').clickSound).toBe('beep')

    settingsStore.setClickSound('wood')
  })
})

describe('settingsStore.setPerformanceMode', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsStore.setPerformanceMode(false)
  })

  it('defaults performanceMode to false', () => {
    expect(settingsStore.performanceMode).toBe(false)
  })

  it('updates performanceMode and persists it', () => {
    settingsStore.setPerformanceMode(true)

    expect(settingsStore.performanceMode).toBe(true)
    expect(
      JSON.parse(localStorage.getItem('gigbpm_settings') ?? '{}').performanceMode,
    ).toBe(true)

    settingsStore.setPerformanceMode(false)
  })
})

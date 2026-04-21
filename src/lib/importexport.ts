import { BPM_MAX, BPM_MIN } from './types'
import { generateId } from './id'
import type { Setlist } from './types'

export interface ExportPayload {
  version: 1
  setlist: {
    name: string
    songs: Array<{ name: string; bpm: number }>
  }
}

export function validateImport(data: unknown): Setlist {
  if (!data || typeof data !== 'object') {
    throw new Error('Not an object')
  }

  const root = data as Record<string, unknown>

  if (root.version !== 1) {
    throw new Error('Unsupported version')
  }

  const setlist = root.setlist as Record<string, unknown>

  if (!setlist || typeof setlist !== 'object') {
    throw new Error('Missing setlist')
  }

  if (typeof setlist.name !== 'string') {
    throw new Error('Invalid name')
  }

  if (!Array.isArray(setlist.songs)) {
    throw new Error('Invalid songs')
  }

  const songs = setlist.songs.map((songData: unknown) => {
    if (!songData || typeof songData !== 'object') {
      throw new Error('Invalid song')
    }

    const song = songData as Record<string, unknown>

    if (typeof song.name !== 'string') {
      throw new Error('Invalid song name')
    }

    if (typeof song.bpm !== 'number' || Number.isNaN(song.bpm)) {
      throw new Error('Invalid song bpm')
    }

    if (song.bpm < BPM_MIN || song.bpm > BPM_MAX) {
      throw new Error('BPM out of range')
    }

    return {
      id: generateId(),
      name: song.name,
      bpm: song.bpm,
    }
  })

  return {
    id: generateId(),
    name: setlist.name,
    songs,
  }
}

export function buildExportPayload(setlist: Setlist): ExportPayload {
  return {
    version: 1,
    setlist: {
      name: setlist.name,
      songs: setlist.songs.map(({ name, bpm }) => ({ name, bpm })),
    },
  }
}

function buildExportJson(setlist: Setlist): string {
  return JSON.stringify(buildExportPayload(setlist), null, 2)
}

function buildFilename(setlist: Setlist, extension: string): string {
  return `setlist-${setlist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`
}

export function exportSetlist(setlist: Setlist): void {
  const json = buildExportJson(setlist)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = buildFilename(setlist, 'json')
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export async function shareSetlist(setlist: Setlist, log: (msg: string) => void = () => {}): Promise<void> {
  const json = buildExportJson(setlist)

  log(`navigator.share type: ${typeof navigator.share}`)

  if (typeof navigator.share !== 'function') {
    log('path: no navigator.share → download')
    exportSetlist(setlist)
    return
  }

  // canShare({ files }) returns true on Android Chrome but share() immediately
  // throws NotAllowedError (no app handles the type), which consumes transient
  // activation and makes every subsequent share() call fail with "user gesture"
  // errors. Use text-only share as the single shot — it works on all platforms
  // that support the Web Share API.
  log('path: text-only share')
  try {
    await navigator.share({ title: setlist.name, text: json })
    log('share: succeeded')
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log('share: user cancelled')
      return
    }

    const name = error instanceof Error ? error.name : String(error)
    const message = error instanceof Error ? error.message : ''
    log(`share: rejected — ${name}: ${message} → download`)
    exportSetlist(setlist)
  }
}

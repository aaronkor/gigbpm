import { BPM_MAX, BPM_MIN } from './types'
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
      id: crypto.randomUUID(),
      name: song.name,
      bpm: song.bpm,
    }
  })

  return {
    id: crypto.randomUUID(),
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

export function exportSetlist(setlist: Setlist): void {
  const json = JSON.stringify(buildExportPayload(setlist), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `setlist-${setlist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export async function shareSetlist(setlist: Setlist): Promise<void> {
  const payload = buildExportPayload(setlist)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `setlist-${setlist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  const file = new File([blob], filename, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: setlist.name })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      throw error
    }
  }

  exportSetlist(setlist)
}

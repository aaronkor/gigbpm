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

async function shareNative(data: ShareData): Promise<boolean> {
  try {
    await navigator.share(data)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true
    }

    return false
  }
}

export async function shareSetlist(setlist: Setlist): Promise<void> {
  const json = buildExportJson(setlist)

  if (typeof navigator.share !== 'function') {
    exportSetlist(setlist)
    return
  }

  const jsonFile = new File([json], buildFilename(setlist, 'json'), { type: 'application/json' })
  const jsonFiles = [jsonFile]

  if (navigator.canShare?.({ files: jsonFiles })) {
    if (await shareNative({ files: jsonFiles, title: setlist.name })) {
      return
    }

    exportSetlist(setlist)
    return
  }

  const textFile = new File([json], buildFilename(setlist, 'txt'), { type: 'text/plain' })
  const textFiles = [textFile]

  if (navigator.canShare?.({ files: textFiles })) {
    if (await shareNative({ files: textFiles, title: setlist.name })) {
      return
    }

    exportSetlist(setlist)
    return
  }

  if (await shareNative({ title: setlist.name, text: json })) {
    return
  }

  exportSetlist(setlist)
}

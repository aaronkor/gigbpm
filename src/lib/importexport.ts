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

type ShareResult = 'shared' | 'unsupported' | 'failed'

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

async function shareFile(file: File, title: string): Promise<ShareResult> {
  const files = [file]

  if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files })) {
    return 'unsupported'
  }

  try {
    await navigator.share({ files, title })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'shared'
    }

    return 'failed'
  }
}

async function shareText(title: string, text: string): Promise<ShareResult> {
  if (typeof navigator.share !== 'function') {
    return 'unsupported'
  }

  try {
    await navigator.share({ title, text })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'shared'
    }

    return 'failed'
  }
}

export async function shareSetlist(setlist: Setlist): Promise<void> {
  const json = buildExportJson(setlist)
  const jsonFile = new File([json], buildFilename(setlist, 'json'), { type: 'application/json' })
  const jsonShareResult = await shareFile(jsonFile, setlist.name)

  if (jsonShareResult === 'shared') {
    return
  }

  if (jsonShareResult === 'unsupported') {
    const textFile = new File([json], buildFilename(setlist, 'txt'), { type: 'text/plain' })

    if ((await shareFile(textFile, setlist.name)) === 'shared') {
      return
    }
  }

  if (await shareText(setlist.name, json) === 'shared') {
    return
  }

  exportSetlist(setlist)
}

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

async function shareNative(data: ShareData, log: (msg: string) => void): Promise<boolean> {
  try {
    await navigator.share(data)
    log('share: succeeded')
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log('share: user cancelled (AbortError)')
      return true
    }

    const name = error instanceof Error ? error.name : String(error)
    const message = error instanceof Error ? error.message : ''
    log(`share: rejected — ${name}: ${message}`)
    return false
  }
}

export async function shareSetlist(setlist: Setlist, log: (msg: string) => void = () => {}): Promise<void> {
  const json = buildExportJson(setlist)

  log(`navigator.share type: ${typeof navigator.share}`)

  if (typeof navigator.share !== 'function') {
    log('path: no navigator.share → download')
    exportSetlist(setlist)
    return
  }

  log(`navigator.canShare type: ${typeof navigator.canShare}`)

  const jsonFile = new File([json], buildFilename(setlist, 'json'), { type: 'application/json' })
  const jsonFiles = [jsonFile]

  const canShareJson = navigator.canShare?.({ files: jsonFiles })
  log(`canShare(json): ${canShareJson}`)

  if (canShareJson) {
    log('path: trying json file share')
    if (await shareNative({ files: jsonFiles, title: setlist.name }, log)) {
      return
    }

    log('path: json file share failed → download')
    exportSetlist(setlist)
    return
  }

  const textFile = new File([json], buildFilename(setlist, 'txt'), { type: 'text/plain' })
  const textFiles = [textFile]

  const canShareText = navigator.canShare?.({ files: textFiles })
  log(`canShare(txt): ${canShareText}`)

  if (canShareText) {
    log('path: trying txt file share')
    if (await shareNative({ files: textFiles, title: setlist.name }, log)) {
      return
    }

    log('path: txt file share failed → download')
    exportSetlist(setlist)
    return
  }

  log('path: trying text-only share')
  if (await shareNative({ title: setlist.name, text: json }, log)) {
    return
  }

  log('path: text share failed → download')
  exportSetlist(setlist)
}

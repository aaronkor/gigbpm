import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildExportPayload, shareSetlist, validateImport } from '../lib/importexport'

describe('validateImport', () => {
  const valid = {
    version: 1,
    setlist: { name: 'Test Gig', songs: [{ name: 'Song A', bpm: 120 }] },
  }

  it('returns Setlist with generated IDs from valid input', () => {
    const result = validateImport(valid)
    expect(result.name).toBe('Test Gig')
    expect(result.songs).toHaveLength(1)
    expect(result.songs[0].name).toBe('Song A')
    expect(result.songs[0].bpm).toBe(120)
    expect(typeof result.id).toBe('string')
    expect(typeof result.songs[0].id).toBe('string')
  })

  it('generates unique IDs each call', () => {
    const first = validateImport(valid)
    const second = validateImport(valid)
    expect(first.id).not.toBe(second.id)
    expect(first.songs[0].id).not.toBe(second.songs[0].id)
  })

  it('throws when setlist key is missing', () => {
    expect(() => validateImport({ version: 1 })).toThrow()
  })

  it('throws when name is not a string', () => {
    expect(() => validateImport({ version: 1, setlist: { name: 42, songs: [] } })).toThrow()
  })

  it('throws when songs is not an array', () => {
    expect(() => validateImport({ version: 1, setlist: { name: 'X', songs: 'bad' } })).toThrow()
  })

  it('throws when a song is missing bpm', () => {
    expect(() => validateImport({ version: 1, setlist: { name: 'X', songs: [{ name: 'S' }] } })).toThrow()
  })

  it('throws when a song has non-numeric bpm', () => {
    expect(() =>
      validateImport({ version: 1, setlist: { name: 'X', songs: [{ name: 'S', bpm: 'fast' }] } }),
    ).toThrow()
  })

  it('throws when bpm is below minimum', () => {
    expect(() =>
      validateImport({ version: 1, setlist: { name: 'X', songs: [{ name: 'S', bpm: 0 }] } }),
    ).toThrow('BPM out of range')
  })

  it('throws when bpm is above maximum', () => {
    expect(() =>
      validateImport({ version: 1, setlist: { name: 'X', songs: [{ name: 'S', bpm: 9999 }] } }),
    ).toThrow('BPM out of range')
  })

  it('throws when version is not 1', () => {
    expect(() =>
      validateImport({ version: 2, setlist: { name: 'X', songs: [] } }),
    ).toThrow('Unsupported version')
  })
})

describe('buildExportPayload', () => {
  it('strips song IDs from export', () => {
    const payload = buildExportPayload({
      id: '1',
      name: 'My Gig',
      songs: [{ id: 'abc', name: 'Track', bpm: 90 }],
    })

    expect(payload.version).toBe(1)
    expect(payload.setlist.name).toBe('My Gig')
    expect(payload.setlist.songs[0]).toEqual({ name: 'Track', bpm: 90 })
    expect((payload.setlist.songs[0] as { id?: string }).id).toBeUndefined()
  })

  it('strips setlist ID from export', () => {
    const payload = buildExportPayload({ id: 'xyz', name: 'G', songs: [] })
    expect((payload.setlist as { id?: string }).id).toBeUndefined()
  })
})

describe('shareSetlist', () => {
  const setlist = {
    id: '1',
    name: 'My Gig',
    songs: [{ id: 's1', name: 'Track', bpm: 120 }],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls navigator.share when canShare returns true', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
    })

    await shareSetlist(setlist)

    expect(shareMock).toHaveBeenCalledOnce()
    const call = shareMock.mock.calls[0][0] as { files: File[]; title: string }
    expect(call.title).toBe('My Gig')
    expect(call.files[0].name).toMatch(/setlist-my-gig\.json$/)
  })

  it('falls back to export when file sharing is not supported', async () => {
    const shareMock = vi.fn()
    const createObjectUrlMock = vi.fn(() => 'blob:mock')
    const revokeObjectUrlMock = vi.fn()
    const clickMock = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    const createElementSpy = vi.spyOn(document, 'createElement')

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    })

    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: clickMock,
        } as unknown as HTMLAnchorElement
      }

      return originalCreateElement(tagName)
    })
    appendSpy.mockImplementation((node) => node)
    removeSpy.mockImplementation((node) => node)

    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
    })

    await shareSetlist(setlist)

    expect(shareMock).not.toHaveBeenCalled()
    expect(createObjectUrlMock).toHaveBeenCalledOnce()
    expect(clickMock).toHaveBeenCalledOnce()
  })

  it('swallows AbortError silently', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')

    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortError),
      configurable: true,
    })

    await expect(shareSetlist(setlist)).resolves.toBeUndefined()
  })

  it('re-throws non-AbortError errors', async () => {
    const shareError = new Error('Network failure')

    Object.defineProperty(globalThis.navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'share', {
      value: vi.fn().mockRejectedValue(shareError),
      configurable: true,
    })

    await expect(shareSetlist(setlist)).rejects.toThrow('Network failure')
  })
})

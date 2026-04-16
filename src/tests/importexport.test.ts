import { describe, expect, it } from 'vitest'

import { buildExportPayload, validateImport } from '../lib/importexport'

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

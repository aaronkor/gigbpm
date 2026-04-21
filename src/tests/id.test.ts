import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateId } from '../lib/id'

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => 'native-id')

    vi.stubGlobal('crypto', {
      randomUUID,
      getRandomValues: vi.fn(),
    })

    expect(generateId()).toBe('native-id')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index))
        return bytes
      }),
    })

    expect(generateId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('falls back when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)

    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { announce, isTTSAvailable } from '../lib/tts'

describe('isTTSAvailable', () => {
  it('returns false when speechSynthesis is absent', () => {
    const original = window.speechSynthesis

    Reflect.deleteProperty(window, 'speechSynthesis')

    expect(isTTSAvailable()).toBe(false)

    if (original) {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: original,
      })
    }
  })

  it('returns true when speechSynthesis is present', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: vi.fn(), cancel: vi.fn() },
    })

    expect(isTTSAvailable()).toBe(true)
  })
})

describe('announce', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: vi.fn(), cancel: vi.fn() },
    })
  })

  it('calls cancel() then speak() with the correct text', () => {
    announce('Blue Bossa')

    expect(window.speechSynthesis.cancel).toHaveBeenCalledOnce()

    const utterance = vi.mocked(window.speechSynthesis.speak).mock.calls[0]?.[0] as {
      text: string
    }

    expect(utterance.text).toBe('Blue Bossa')
  })

  it('does nothing when speechSynthesis is unavailable', () => {
    Reflect.deleteProperty(window, 'speechSynthesis')

    expect(() => announce('Song')).not.toThrow()
  })
})

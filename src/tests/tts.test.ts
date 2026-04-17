import { beforeEach, describe, expect, it, vi } from 'vitest'

import { announce, detectLang, isTTSAvailable } from '../lib/tts'

const mockSpeech = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
}

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
      value: mockSpeech,
    })

    expect(isTTSAvailable()).toBe(true)
  })
})

describe('detectLang', () => {
  it('detects Hebrew', () => expect(detectLang('שיר אהבה')).toBe('he'))
  it('detects Arabic', () => expect(detectLang('أغنية')).toBe('ar'))
  it('detects Russian/Cyrillic', () => expect(detectLang('песня')).toBe('ru'))
  it('detects Japanese', () => expect(detectLang('うた')).toBe('ja'))
  it('detects Chinese', () => expect(detectLang('歌曲')).toBe('zh'))
  it('detects Korean', () => expect(detectLang('노래')).toBe('ko'))
  it('detects Greek', () => expect(detectLang('τραγούδι')).toBe('el'))
  it('returns empty string for Latin text', () => expect(detectLang('Blue Bossa')).toBe(''))
  it('returns empty string for empty string', () => expect(detectLang('')).toBe(''))
})

describe('announce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: mockSpeech,
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

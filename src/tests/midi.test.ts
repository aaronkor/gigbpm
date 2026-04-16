import { describe, expect, it, vi } from 'vitest'

import { createMidiController, isMidiAvailable, matchesBinding } from '../lib/midi'
import type { MidiCCBinding } from '../lib/types'

describe('isMidiAvailable', () => {
  it('returns false when requestMIDIAccess is absent', () => {
    const original = navigator.requestMIDIAccess

    Reflect.deleteProperty(navigator, 'requestMIDIAccess')

    expect(isMidiAvailable()).toBe(false)

    if (original) {
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: original,
      })
    }
  })

  it('returns true when requestMIDIAccess is present', () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(),
    })

    expect(isMidiAvailable()).toBe(true)
  })
})

describe('matchesBinding', () => {
  it('matches exact channel and CC', () => {
    const binding: MidiCCBinding = { channel: 1, cc: 64 }

    expect(matchesBinding({ channel: 1, cc: 64 }, binding)).toBe(true)
  })

  it('rejects the wrong CC', () => {
    expect(matchesBinding({ channel: 1, cc: 65 }, { channel: 1, cc: 64 })).toBe(false)
  })

  it('rejects the wrong channel', () => {
    expect(matchesBinding({ channel: 2, cc: 64 }, { channel: 1, cc: 64 })).toBe(false)
  })

  it('matches any channel when the binding uses "any"', () => {
    const binding: MidiCCBinding = { channel: 'any', cc: 64 }

    expect(matchesBinding({ channel: 5, cc: 64 }, binding)).toBe(true)
    expect(matchesBinding({ channel: 1, cc: 64 }, binding)).toBe(true)
  })
})

describe('createMidiController', () => {
  it('fires onAdvance when the advance binding matches and value > 0', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ channel: 1, cc: 64 }, null)
    controller.simulateCC(1, 64, 127)

    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('fires onPauseStop when the pause/stop binding matches', () => {
    const onPauseStop = vi.fn()
    const controller = createMidiController(vi.fn(), onPauseStop)

    controller.setBindings(null, { channel: 'any', cc: 80 })
    controller.simulateCC(3, 80, 100)

    expect(onPauseStop).toHaveBeenCalledOnce()
  })

  it('ignores value=0 pedal release messages', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ channel: 1, cc: 64 }, null)
    controller.simulateCC(1, 64, 0)

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('captures the next CC message during learn mode', () => {
    const onLearned = vi.fn()
    const controller = createMidiController(vi.fn(), vi.fn())

    controller.startLearn('advance', onLearned)
    controller.simulateCC(2, 74, 127)

    expect(onLearned).toHaveBeenCalledWith({ channel: 2, cc: 74 })
  })

  it('absorbs matching bindings while learn mode is active', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ channel: 2, cc: 74 }, null)
    controller.startLearn('advance', vi.fn())
    controller.simulateCC(2, 74, 127)

    expect(onAdvance).not.toHaveBeenCalled()
  })
})

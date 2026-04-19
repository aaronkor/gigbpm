import { describe, expect, it, vi } from 'vitest'

import { createMidiController, isMidiAvailable, matchesBinding } from '../lib/midi'
import type { MidiBinding } from '../lib/types'

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
    const binding: MidiBinding = { type: 'cc', channel: 1, cc: 64 }

    expect(matchesBinding({ type: 'cc', channel: 1, number: 64 }, binding)).toBe(true)
  })

  it('rejects the wrong CC', () => {
    expect(
      matchesBinding({ type: 'cc', channel: 1, number: 65 }, { type: 'cc', channel: 1, cc: 64 }),
    ).toBe(false)
  })

  it('rejects the wrong channel', () => {
    expect(
      matchesBinding({ type: 'cc', channel: 2, number: 64 }, { type: 'cc', channel: 1, cc: 64 }),
    ).toBe(false)
  })

  it('matches any channel when the binding uses "any"', () => {
    const binding: MidiBinding = { type: 'cc', channel: 'any', cc: 64 }

    expect(matchesBinding({ type: 'cc', channel: 5, number: 64 }, binding)).toBe(true)
    expect(matchesBinding({ type: 'cc', channel: 1, number: 64 }, binding)).toBe(true)
  })

  it('rejects type mismatch (CC binding vs Note On message with same number)', () => {
    const binding: MidiBinding = { type: 'cc', channel: 1, cc: 64 }

    expect(matchesBinding({ type: 'note', channel: 1, number: 64 }, binding)).toBe(false)
  })
})

describe('createMidiController', () => {
  it('fires onAdvance when the advance binding matches and value > 0', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'cc', channel: 1, cc: 64 }, null)
    controller.simulateCC(1, 64, 127)

    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('fires onPauseStop when the pause/stop binding matches', () => {
    const onPauseStop = vi.fn()
    const controller = createMidiController(vi.fn(), onPauseStop)

    controller.setBindings(null, { type: 'cc', channel: 'any', cc: 80 })
    controller.simulateCC(3, 80, 100)

    expect(onPauseStop).toHaveBeenCalledOnce()
  })

  it('ignores value=0 pedal release messages', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'cc', channel: 1, cc: 64 }, null)
    controller.simulateCC(1, 64, 0)

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('captures the next CC message during learn mode', () => {
    const onLearned = vi.fn()
    const controller = createMidiController(vi.fn(), vi.fn())

    controller.startLearn('advance', onLearned)
    controller.simulateCC(2, 74, 127)

    expect(onLearned).toHaveBeenCalledWith({ type: 'cc', channel: 2, cc: 74 })
  })

  it('absorbs matching bindings while learn mode is active', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'cc', channel: 2, cc: 74 }, null)
    controller.startLearn('advance', vi.fn())
    controller.simulateCC(2, 74, 127)

    expect(onAdvance).not.toHaveBeenCalled()
  })

  // Note On tests
  it('fires onAdvance when a Note On message matches the advance binding (velocity > 0)', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'note', channel: 1, note: 60 }, null)
    controller.simulateNote(1, 60, 127)

    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('ignores Note On with velocity 0', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'note', channel: 1, note: 60 }, null)
    controller.simulateNote(1, 60, 0)

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('ignores Note Off (0x80)', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'note', channel: 1, note: 60 }, null)
    // 0x80 = Note Off on channel 1, note 60, velocity 64
    controller.simulateRaw(new Uint8Array([0x80, 60, 64]))

    expect(onAdvance).not.toHaveBeenCalled()
  })

  // Program Change tests
  it('fires onAdvance when a PC message matches the advance binding', () => {
    const onAdvance = vi.fn()
    const controller = createMidiController(onAdvance, vi.fn())

    controller.setBindings({ type: 'pc', channel: 1, program: 5 }, null)
    controller.simulatePC(1, 5)

    expect(onAdvance).toHaveBeenCalledOnce()
  })

  // Learn mode captures Note binding
  it('captures a Note binding during learn mode when a Note On arrives first', () => {
    const onLearned = vi.fn()
    const controller = createMidiController(vi.fn(), vi.fn())

    controller.startLearn('advance', onLearned)
    controller.simulateNote(3, 48, 100)

    expect(onLearned).toHaveBeenCalledWith({ type: 'note', channel: 3, note: 48 })
  })

  // Learn mode captures PC binding
  it('captures a PC binding during learn mode when a PC message arrives first', () => {
    const onLearned = vi.fn()
    const controller = createMidiController(vi.fn(), vi.fn())

    controller.startLearn('advance', onLearned)
    controller.simulatePC(2, 10)

    expect(onLearned).toHaveBeenCalledWith({ type: 'pc', channel: 2, program: 10 })
  })
})

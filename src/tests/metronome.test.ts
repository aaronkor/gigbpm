import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMetronome, previewClick } from '../lib/metronome'
import type { CustomSoundParams } from '../lib/types'

const DEFAULT_CUSTOM: CustomSoundParams = {
  source: 'sine',
  pitch: 440,
  duration: 40,
  decay: 200,
}

function makeMockContext() {
  let time = 0

  return {
    get currentTime() {
      return time
    },
    advanceTime(seconds: number) {
      time += seconds
    },
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    sampleRate: 44_100,
    destination: {},
    createBuffer: vi.fn((_: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: { value: 0 },
      connect: vi.fn(),
    })),
  }
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('createMetronome - state transitions', () => {
  it('starts in stopped state', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(metronome.isRunning).toBe(false)
    expect(metronome.isPaused).toBe(false)
  })

  it('sets isRunning=true after start()', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)

    expect(metronome.isRunning).toBe(true)
    expect(metronome.isPaused).toBe(false)

    metronome.stop()
  })

  it('sets isPaused=true after pause()', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)
    metronome.pause()

    expect(metronome.isRunning).toBe(false)
    expect(metronome.isPaused).toBe(true)

    metronome.stop()
  })

  it('sets isRunning=true and isPaused=false after resume()', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)
    metronome.pause()
    metronome.resume()

    expect(metronome.isRunning).toBe(true)
    expect(metronome.isPaused).toBe(false)

    metronome.stop()
  })

  it('resets both flags after stop()', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)
    metronome.stop()

    expect(metronome.isRunning).toBe(false)
    expect(metronome.isPaused).toBe(false)
  })
})

describe('createMetronome - API', () => {
  it('allows replacing the onBeat callback', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.onBeat(() => {})

    expect(() => metronome.onBeat(() => {})).not.toThrow()
  })

  it('allows setBpm while running', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)

    expect(() => metronome.setBpm(140)).not.toThrow()

    metronome.stop()
  })

  it('allows setBpm while stopped', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(() => metronome.setBpm(90)).not.toThrow()
  })
})

describe('createMetronome - click sound', () => {
  it('exposes setClickSound method', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(typeof metronome.setClickSound).toBe('function')
  })

  it('setClickSound does not throw for any valid sound', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(() => metronome.setClickSound('wood')).not.toThrow()
    expect(() => metronome.setClickSound('beep')).not.toThrow()
    expect(() => metronome.setClickSound('tick')).not.toThrow()
    expect(() => metronome.setClickSound('custom')).not.toThrow()
  })

  it('setClickSound can be called while running', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)

    expect(() => metronome.setClickSound('beep')).not.toThrow()

    metronome.stop()
  })
})

describe('buildClickBuffer - custom sound', () => {
  it('sine source produces buffer of correct length', () => {
    const ctx = makeMockContext()
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setCustomSoundParams(DEFAULT_CUSTOM)
    metronome.setClickSound('custom')
    metronome.start(120)

    const expectedLength = Math.floor(44_100 * (DEFAULT_CUSTOM.duration / 1000))
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, 44_100)

    metronome.stop()
  })

  it('square source produces buffer of correct length', () => {
    const ctx = makeMockContext()
    const params: CustomSoundParams = { ...DEFAULT_CUSTOM, source: 'square', duration: 80 }
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setCustomSoundParams(params)
    metronome.setClickSound('custom')
    metronome.start(120)

    const expectedLength = Math.floor(44_100 * (params.duration / 1000))
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, 44_100)

    metronome.stop()
  })

  it('noise source produces buffer of correct length', () => {
    const ctx = makeMockContext()
    const params: CustomSoundParams = { ...DEFAULT_CUSTOM, source: 'noise', duration: 25 }
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setCustomSoundParams(params)
    metronome.setClickSound('custom')
    metronome.start(120)

    const expectedLength = Math.floor(44_100 * (params.duration / 1000))
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, 44_100)

    metronome.stop()
  })
})

describe('setCustomSoundParams', () => {
  it('is exposed on the Metronome interface', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(typeof metronome.setCustomSoundParams).toBe('function')
  })

  it('invalidates the click buffer cache', () => {
    const ctx = makeMockContext()
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickSound('custom')
    metronome.setCustomSoundParams(DEFAULT_CUSTOM)
    metronome.start(120)

    const callsBefore = ctx.createBuffer.mock.calls.length

    metronome.setCustomSoundParams({ ...DEFAULT_CUSTOM, pitch: 880 })
    metronome.stop()
    metronome.start(120)

    expect(ctx.createBuffer.mock.calls.length).toBeGreaterThan(callsBefore)

    metronome.stop()
  })
})

describe('previewClick', () => {
  it('is exported', () => {
    expect(typeof previewClick).toBe('function')
  })

  it('does not throw when called with custom and params', () => {
    expect(() => previewClick('custom', DEFAULT_CUSTOM)).not.toThrow()
  })
})

describe('beat interval math', () => {
  it('120 BPM equals 0.5 seconds per beat', () => {
    expect(60 / 120).toBe(0.5)
  })

  it('60 BPM equals 1.0 second per beat', () => {
    expect(60 / 60).toBe(1)
  })

  it('300 BPM equals 0.2 seconds per beat', () => {
    expect(60 / 300).toBeCloseTo(0.2)
  })
})

describe('createMetronome - click channel', () => {
  it('exposes setClickChannel method', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(typeof metronome.setClickChannel).toBe('function')
  })

  it('setClickChannel does not throw for any valid channel', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    expect(() => metronome.setClickChannel('left')).not.toThrow()
    expect(() => metronome.setClickChannel('right')).not.toThrow()
    expect(() => metronome.setClickChannel('both')).not.toThrow()
  })

  it('creates a StereoPannerNode when scheduling a click', () => {
    const ctx = makeMockContext()
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.start(120)

    expect(ctx.createStereoPanner).toHaveBeenCalled()

    metronome.stop()
  })

  it('sets pan to -1 for left channel', () => {
    const ctx = makeMockContext()
    const pannerNode = { pan: { value: 0 }, connect: vi.fn() }
    const sourceNode = { buffer: null, connect: vi.fn(), start: vi.fn() }
    ctx.createStereoPanner.mockReturnValue(pannerNode)
    ctx.createBufferSource.mockReturnValue(sourceNode)
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickChannel('left')
    metronome.start(120)

    expect(pannerNode.pan.value).toBe(-1)
    expect(sourceNode.connect).toHaveBeenCalledWith(pannerNode)
    expect(pannerNode.connect).toHaveBeenCalledWith(ctx.destination)

    metronome.stop()
  })

  it('sets pan to +1 for right channel', () => {
    const ctx = makeMockContext()
    const pannerNode = { pan: { value: 0 }, connect: vi.fn() }
    const sourceNode = { buffer: null, connect: vi.fn(), start: vi.fn() }
    ctx.createStereoPanner.mockReturnValue(pannerNode)
    ctx.createBufferSource.mockReturnValue(sourceNode)
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickChannel('right')
    metronome.start(120)

    expect(pannerNode.pan.value).toBe(1)
    expect(sourceNode.connect).toHaveBeenCalledWith(pannerNode)
    expect(pannerNode.connect).toHaveBeenCalledWith(ctx.destination)

    metronome.stop()
  })

  it('sets pan to 0 for both channels', () => {
    const ctx = makeMockContext()
    const pannerNode = { pan: { value: 99 }, connect: vi.fn() }
    const sourceNode = { buffer: null, connect: vi.fn(), start: vi.fn() }
    ctx.createStereoPanner.mockReturnValue(pannerNode)
    ctx.createBufferSource.mockReturnValue(sourceNode)
    const metronome = createMetronome(ctx as unknown as AudioContext)

    metronome.setClickChannel('both')
    metronome.start(120)

    expect(pannerNode.pan.value).toBe(0)
    expect(sourceNode.connect).toHaveBeenCalledWith(pannerNode)
    expect(pannerNode.connect).toHaveBeenCalledWith(ctx.destination)

    metronome.stop()
  })
})

describe('previewClick - channel param', () => {
  it('accepts an optional channel parameter without throwing', () => {
    expect(() => previewClick('wood', undefined, 'left')).not.toThrow()
    expect(() => previewClick('wood', undefined, 'right')).not.toThrow()
    expect(() => previewClick('wood', undefined, 'both')).not.toThrow()
  })
})

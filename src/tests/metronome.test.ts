import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMetronome, previewClick } from '../lib/metronome'

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
  })

  it('setClickSound can be called while running', () => {
    const metronome = createMetronome(makeMockContext() as unknown as AudioContext)

    metronome.start(120)

    expect(() => metronome.setClickSound('beep')).not.toThrow()

    metronome.stop()
  })
})

describe('previewClick', () => {
  it('is exported', () => {
    expect(typeof previewClick).toBe('function')
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

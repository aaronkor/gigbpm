const LOOKAHEAD_SECONDS = 0.1
const SCHEDULER_INTERVAL_MS = 25
const CLICK_DURATION_SECONDS = 0.04
const CLICK_DECAY = 150

export interface Metronome {
  start(bpm: number): void
  stop(): void
  pause(): void
  resume(): void
  setBpm(bpm: number): void
  onBeat(callback: () => void): void
  readonly isRunning: boolean
  readonly isPaused: boolean
}

export function createMetronome(ctx: AudioContext): Metronome {
  let bpm = 120
  let nextBeatTime = 0
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null
  let beatCallback: (() => void) | null = null
  let running = false
  let paused = false
  let clickBuffer: AudioBuffer | null = null
  const pendingBeatCallbacks: number[] = []

  function buildClickBuffer(): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * CLICK_DURATION_SECONDS)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let index = 0; index < length; index += 1) {
      const time = index / ctx.sampleRate
      data[index] = (Math.random() * 2 - 1) * Math.exp(-time * CLICK_DECAY)
    }

    return buffer
  }

  function getClickBuffer(): AudioBuffer {
    if (!clickBuffer) {
      clickBuffer = buildClickBuffer()
    }

    return clickBuffer
  }

  function scheduleClick(time: number): void {
    const source = ctx.createBufferSource()
    source.buffer = getClickBuffer()
    source.connect(ctx.destination)
    source.start(time)
    pendingBeatCallbacks.push(time)
  }

  function flushBeatCallbacks(): void {
    if (!beatCallback) {
      pendingBeatCallbacks.length = 0
      return
    }

    while (pendingBeatCallbacks[0] !== undefined && pendingBeatCallbacks[0] <= ctx.currentTime) {
      pendingBeatCallbacks.shift()
      beatCallback()
    }
  }

  function stopLoop(): void {
    if (schedulerTimer !== null) {
      clearTimeout(schedulerTimer)
      schedulerTimer = null
    }
  }

  function schedulerLoop(): void {
    if (!running) {
      return
    }

    while (nextBeatTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      scheduleClick(nextBeatTime)
      nextBeatTime += 60 / bpm
    }

    flushBeatCallbacks()
    schedulerTimer = setTimeout(schedulerLoop, SCHEDULER_INTERVAL_MS)
  }

  function resetScheduledState(): void {
    nextBeatTime = ctx.currentTime
    pendingBeatCallbacks.length = 0
  }

  return {
    get isRunning() {
      return running
    },

    get isPaused() {
      return paused
    },

    start(newBpm: number): void {
      stopLoop()
      bpm = newBpm
      resetScheduledState()
      running = true
      paused = false

      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined)
      }

      schedulerLoop()
    },

    stop(): void {
      stopLoop()
      resetScheduledState()
      running = false
      paused = false
    },

    pause(): void {
      if (!running) {
        return
      }

      stopLoop()
      pendingBeatCallbacks.length = 0
      running = false
      paused = true
    },

    resume(): void {
      if (!paused) {
        return
      }

      resetScheduledState()
      running = true
      paused = false
      schedulerLoop()
    },

    setBpm(newBpm: number): void {
      bpm = newBpm
    },

    onBeat(callback: () => void): void {
      beatCallback = callback
    },
  }
}

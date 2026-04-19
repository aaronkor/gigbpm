import type { ClickChannel, ClickSound, CustomSoundParams } from './types'

const LOOKAHEAD_SECONDS = 0.1
const SCHEDULER_INTERVAL_MS = 25

export interface Metronome {
  start(bpm: number): void
  stop(): void
  pause(): void
  resume(): void
  setBpm(bpm: number): void
  setClickSound(sound: ClickSound): void
  setCustomSoundParams(params: CustomSoundParams): void
  setClickChannel(channel: ClickChannel): void
  onBeat(callback: () => void): void
  readonly isRunning: boolean
  readonly isPaused: boolean
}

function createClickBuffer(
  ctx: AudioContext,
  duration: number,
  sampleAtTime: (time: number) => number,
): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let index = 0; index < length; index += 1) {
    const time = index / ctx.sampleRate
    data[index] = sampleAtTime(time)
  }

  return buffer
}

function buildClickBuffer(
  sound: ClickSound,
  ctx: AudioContext,
  customParams?: CustomSoundParams,
): AudioBuffer {
  if (sound === 'custom' && customParams) {
    const duration = customParams.duration / 1000
    const { source, pitch, decay } = customParams

    if (source === 'sine') {
      return createClickBuffer(
        ctx,
        duration,
        (time) => Math.sin(2 * Math.PI * pitch * time) * Math.exp(-time * decay),
      )
    }

    if (source === 'square') {
      return createClickBuffer(
        ctx,
        duration,
        (time) =>
          (Math.sin(2 * Math.PI * pitch * time) > 0 ? 1 : -1) * Math.exp(-time * decay),
      )
    }

    return createClickBuffer(
      ctx,
      duration,
      (time) => (Math.random() * 2 - 1) * Math.exp(-time * decay),
    )
  }

  if (sound === 'beep') {
    const duration = 0.06
    return createClickBuffer(
      ctx,
      duration,
      (time) => Math.sin(2 * Math.PI * 880 * time) * (1 - time / duration),
    )
  }

  if (sound === 'tick') {
    return createClickBuffer(
      ctx,
      0.025,
      (time) => (Math.random() * 2 - 1) * Math.exp(-time * 400),
    )
  }

  return createClickBuffer(
    ctx,
    0.04,
    (time) => (Math.random() * 2 - 1) * Math.exp(-time * 150),
  )
}

function panValue(channel: ClickChannel): number {
  if (channel === 'left') return -1
  if (channel === 'right') return 1
  return 0
}

export function previewClick(
  sound: ClickSound,
  customParams?: CustomSoundParams,
  channel: ClickChannel = 'both',
): void {
  const AudioContextConstructor =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextConstructor) {
    return
  }

  const ctx = new AudioContextConstructor()
  const source = ctx.createBufferSource()
  source.buffer = buildClickBuffer(sound, ctx, customParams)
  const panner = ctx.createStereoPanner()
  panner.pan.value = panValue(channel)
  source.connect(panner)
  panner.connect(ctx.destination)
  source.start()
  source.onended = () => void ctx.close().catch(() => undefined)
}

export function createMetronome(
  ctx: AudioContext,
  initialSound: ClickSound = 'wood',
): Metronome {
  let bpm = 120
  let nextBeatTime = 0
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null
  let beatCallback: (() => void) | null = null
  let running = false
  let paused = false
  let currentSound = initialSound
  let clickBuffer: AudioBuffer | null = null
  let customSoundParams: CustomSoundParams | undefined = undefined
  let currentChannel: ClickChannel = 'both'
  const pendingBeatCallbacks: number[] = []

  function getClickBuffer(): AudioBuffer {
    if (!clickBuffer) {
      clickBuffer = buildClickBuffer(currentSound, ctx, customSoundParams)
    }

    return clickBuffer
  }

  function scheduleClick(time: number): void {
    const source = ctx.createBufferSource()
    source.buffer = getClickBuffer()
    const panner = ctx.createStereoPanner()
    panner.pan.value = panValue(currentChannel)
    source.connect(panner)
    panner.connect(ctx.destination)
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

    setClickSound(sound: ClickSound): void {
      if (currentSound === sound) {
        return
      }

      currentSound = sound
      clickBuffer = null
    },

    setCustomSoundParams(params: CustomSoundParams): void {
      customSoundParams = params
      clickBuffer = null
    },

    setClickChannel(channel: ClickChannel): void {
      currentChannel = channel
    },

    onBeat(callback: () => void): void {
      beatCallback = callback
    },
  }
}

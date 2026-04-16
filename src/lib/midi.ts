import type { MidiCCBinding } from './types'

type LearnTarget = 'advance' | 'pauseStop'

interface IncomingCC {
  channel: number
  cc: number
}

export interface MidiController {
  enable(): Promise<void>
  disable(): void
  setBindings(advance: MidiCCBinding | null, pauseStop: MidiCCBinding | null): void
  startLearn(target: LearnTarget, onLearned: (binding: MidiCCBinding) => void): void
  cancelLearn(): void
  simulateCC(channel: number, cc: number, value: number): void
}

export function isMidiAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
}

export function matchesBinding(incoming: IncomingCC, binding: MidiCCBinding): boolean {
  const channelMatches = binding.channel === 'any' || binding.channel === incoming.channel

  return channelMatches && binding.cc === incoming.cc
}

export function createMidiController(
  onAdvance: () => void,
  onPauseStop: () => void,
): MidiController {
  let advanceBinding: MidiCCBinding | null = null
  let pauseStopBinding: MidiCCBinding | null = null
  let learnTarget: LearnTarget | null = null
  let learnCallback: ((binding: MidiCCBinding) => void) | null = null
  let midiAccess: MIDIAccess | null = null

  function clearLearnState(): void {
    learnTarget = null
    learnCallback = null
  }

  function handleCC(channel: number, cc: number, value: number): void {
    if (value === 0) {
      return
    }

    if (learnTarget && learnCallback) {
      learnCallback({ channel, cc })
      clearLearnState()
      return
    }

    if (advanceBinding && matchesBinding({ channel, cc }, advanceBinding)) {
      onAdvance()
    }

    if (pauseStopBinding && matchesBinding({ channel, cc }, pauseStopBinding)) {
      onPauseStop()
    }
  }

  function onMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data || event.data.length < 3) {
      return
    }

    const status = event.data[0]
    const cc = event.data[1]
    const value = event.data[2]
    const type = status & 0xf0
    const channel = (status & 0x0f) + 1

    if (type === 0xb0) {
      handleCC(channel, cc, value)
    }
  }

  function attachInputs(access: MIDIAccess): void {
    access.inputs.forEach((input) => {
      input.onmidimessage = onMidiMessage
    })
  }

  return {
    async enable(): Promise<void> {
      if (!isMidiAvailable()) {
        return
      }

      try {
        midiAccess = await navigator.requestMIDIAccess()
        attachInputs(midiAccess)
        midiAccess.onstatechange = () => {
          if (midiAccess) {
            attachInputs(midiAccess)
          }
        }
      } catch {
        midiAccess = null
      }
    },

    disable(): void {
      if (!midiAccess) {
        return
      }

      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = null
      })
      midiAccess.onstatechange = null
      midiAccess = null
    },

    setBindings(advance: MidiCCBinding | null, pauseStop: MidiCCBinding | null): void {
      advanceBinding = advance
      pauseStopBinding = pauseStop
    },

    startLearn(target: LearnTarget, onLearned: (binding: MidiCCBinding) => void): void {
      learnTarget = target
      learnCallback = onLearned
    },

    cancelLearn(): void {
      clearLearnState()
    },

    simulateCC(channel: number, cc: number, value: number): void {
      handleCC(channel, cc, value)
    },
  }
}

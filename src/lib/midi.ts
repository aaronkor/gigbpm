import type { MidiBinding } from './types'

type LearnTarget = 'advance' | 'pauseStop'

interface IncomingMessage {
  type: 'cc' | 'note' | 'pc'
  channel: number
  number: number
}

export interface MidiController {
  enable(): Promise<void>
  disable(): void
  setBindings(advance: MidiBinding | null, pauseStop: MidiBinding | null): void
  startLearn(target: LearnTarget, onLearned: (binding: MidiBinding) => void): void
  cancelLearn(): void
  simulateCC(channel: number, cc: number, value: number): void
  simulateNote(channel: number, note: number, velocity: number): void
  simulatePC(channel: number, program: number): void
  simulateRaw(data: Uint8Array): void
}

export function isMidiAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
}

export function matchesBinding(incoming: IncomingMessage, binding: MidiBinding): boolean {
  if (binding.type !== incoming.type) return false

  const channelMatches = binding.channel === 'any' || binding.channel === incoming.channel

  let bindingNumber: number
  if (binding.type === 'cc') {
    bindingNumber = binding.cc
  } else if (binding.type === 'note') {
    bindingNumber = binding.note
  } else {
    bindingNumber = binding.program
  }

  return channelMatches && bindingNumber === incoming.number
}

export function createMidiController(
  onAdvance: () => void,
  onPauseStop: () => void,
): MidiController {
  let advanceBinding: MidiBinding | null = null
  let pauseStopBinding: MidiBinding | null = null
  let learnTarget: LearnTarget | null = null
  let learnCallback: ((binding: MidiBinding) => void) | null = null
  let midiAccess: MIDIAccess | null = null

  function clearLearnState(): void {
    learnTarget = null
    learnCallback = null
  }

  function handleMessage(incoming: IncomingMessage): void {
    if (learnTarget && learnCallback) {
      let learned: MidiBinding
      if (incoming.type === 'cc') {
        learned = { type: 'cc', channel: incoming.channel, cc: incoming.number }
      } else if (incoming.type === 'note') {
        learned = { type: 'note', channel: incoming.channel, note: incoming.number }
      } else {
        learned = { type: 'pc', channel: incoming.channel, program: incoming.number }
      }
      learnCallback(learned)
      clearLearnState()
      return
    }

    if (advanceBinding && matchesBinding(incoming, advanceBinding)) {
      onAdvance()
    }
    if (pauseStopBinding && matchesBinding(incoming, pauseStopBinding)) {
      onPauseStop()
    }
  }

  function onMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data) return

    const status = event.data[0]
    const messageType = status & 0xf0
    const channel = (status & 0x0f) + 1

    if (messageType === 0xb0) {
      // CC: requires 3 bytes, fires when value > 0
      if (event.data.length < 3) return
      const cc = event.data[1]
      const value = event.data[2]
      if (value === 0) return
      handleMessage({ type: 'cc', channel, number: cc })
    } else if (messageType === 0x90) {
      // Note On: requires 3 bytes, velocity 0 is treated as Note Off (ignored)
      if (event.data.length < 3) return
      const note = event.data[1]
      const velocity = event.data[2]
      if (velocity === 0) return
      handleMessage({ type: 'note', channel, number: note })
    } else if (messageType === 0xc0) {
      // Program Change: requires 2 bytes, always fires
      if (event.data.length < 2) return
      const program = event.data[1]
      handleMessage({ type: 'pc', channel, number: program })
    }
    // Note Off (0x80) is ignored
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

    setBindings(advance: MidiBinding | null, pauseStop: MidiBinding | null): void {
      advanceBinding = advance
      pauseStopBinding = pauseStop
    },

    startLearn(target: LearnTarget, onLearned: (binding: MidiBinding) => void): void {
      learnTarget = target
      learnCallback = onLearned
    },

    cancelLearn(): void {
      clearLearnState()
    },

    simulateCC(channel: number, cc: number, value: number): void {
      if (value === 0) return
      handleMessage({ type: 'cc', channel, number: cc })
    },

    simulateNote(channel: number, note: number, velocity: number): void {
      if (velocity === 0) return
      handleMessage({ type: 'note', channel, number: note })
    },

    simulatePC(channel: number, program: number): void {
      handleMessage({ type: 'pc', channel, number: program })
    },

    simulateRaw(data: Uint8Array): void {
      onMidiMessage({ data } as MIDIMessageEvent)
    },
  }
}

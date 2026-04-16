type SpeechSynthesisLike = Pick<SpeechSynthesis, 'cancel' | 'speak'>

function getSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null
  }

  return window.speechSynthesis
}

function createUtterance(text: string): SpeechSynthesisUtterance {
  if (typeof SpeechSynthesisUtterance !== 'undefined') {
    return new SpeechSynthesisUtterance(text)
  }

  return { text } as SpeechSynthesisUtterance
}

export function isTTSAvailable(): boolean {
  return getSpeechSynthesis() !== null
}

export function announce(text: string): void {
  const speech = getSpeechSynthesis()

  if (!speech) {
    return
  }

  speech.cancel()
  speech.speak(createUtterance(text))
}

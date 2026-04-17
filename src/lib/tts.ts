type SpeechSynthesisLike = Pick<SpeechSynthesis, 'cancel' | 'speak' | 'getVoices'>

function getSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null
  }

  return window.speechSynthesis
}

export function detectLang(text: string): string {
  if (/[\u0590-\u05FF]/.test(text)) return 'he'
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'
  if (/[\u0400-\u04FF]/.test(text)) return 'ru'
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko'
  if (/[\u0370-\u03FF]/.test(text)) return 'el'
  return ''
}

function createUtterance(text: string, speech: SpeechSynthesisLike): SpeechSynthesisUtterance {
  let utterance: SpeechSynthesisUtterance

  if (typeof SpeechSynthesisUtterance !== 'undefined') {
    utterance = new SpeechSynthesisUtterance(text)
  } else {
    return { text } as SpeechSynthesisUtterance
  }

  const lang = detectLang(text)
  if (lang) {
    utterance.lang = lang
    const voice = speech.getVoices().find((v) => v.lang.startsWith(lang)) ?? null
    if (voice) {
      utterance.voice = voice
    }
  }

  return utterance
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
  speech.speak(createUtterance(text, speech))
}

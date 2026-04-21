const VIEWPORT_HEIGHT_VAR = '--app-viewport-height'

export function syncAppViewportHeight(target: HTMLElement = document.documentElement): () => void {
  let frame: number | null = null

  const getHeight = (): number => window.visualViewport?.height ?? window.innerHeight

  const applyHeight = (): void => {
    frame = null
    target.style.setProperty(VIEWPORT_HEIGHT_VAR, `${getHeight()}px`)
  }

  const scheduleHeightSync = (): void => {
    if (frame !== null) {
      return
    }

    frame = window.requestAnimationFrame(applyHeight)
  }

  applyHeight()

  window.addEventListener('resize', scheduleHeightSync, { passive: true })
  window.addEventListener('orientationchange', scheduleHeightSync, { passive: true })
  window.addEventListener('pageshow', scheduleHeightSync, { passive: true })
  window.visualViewport?.addEventListener('resize', scheduleHeightSync, { passive: true })
  window.visualViewport?.addEventListener('scroll', scheduleHeightSync, { passive: true })

  return () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame)
    }

    window.removeEventListener('resize', scheduleHeightSync)
    window.removeEventListener('orientationchange', scheduleHeightSync)
    window.removeEventListener('pageshow', scheduleHeightSync)
    window.visualViewport?.removeEventListener('resize', scheduleHeightSync)
    window.visualViewport?.removeEventListener('scroll', scheduleHeightSync)
    target.style.removeProperty(VIEWPORT_HEIGHT_VAR)
  }
}

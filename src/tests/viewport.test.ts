import { afterEach, describe, expect, it, vi } from 'vitest'

import { syncAppViewportHeight } from '../lib/viewport'

const VIEWPORT_HEIGHT_VAR = '--app-viewport-height'

const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
const originalRequestAnimationFrame = window.requestAnimationFrame
const originalCancelAnimationFrame = window.cancelAnimationFrame

function restoreWindowProperty<T>(name: keyof Window, descriptor: PropertyDescriptor | undefined, value: T): void {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor)
    return
  }

  Object.defineProperty(window, name, {
    configurable: true,
    value,
  })
}

function setWindowProperty<T>(name: keyof Window, value: T): void {
  Object.defineProperty(window, name, {
    configurable: true,
    value,
  })
}

function createVisualViewport(height: number) {
  let currentHeight = height
  const listeners = new Map<string, EventListener>()

  const viewport = {
    get height() {
      return currentHeight
    },
    set height(value: number) {
      currentHeight = value
    },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener)
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type)
    }),
    dispatch(type: string) {
      listeners.get(type)?.(new Event(type))
    },
  }

  setWindowProperty('visualViewport', viewport as unknown as VisualViewport)

  return viewport
}

afterEach(() => {
  vi.restoreAllMocks()
  restoreWindowProperty('innerHeight', originalInnerHeight, 768)
  restoreWindowProperty('visualViewport', originalVisualViewport, undefined)
  setWindowProperty('requestAnimationFrame', originalRequestAnimationFrame)
  setWindowProperty('cancelAnimationFrame', originalCancelAnimationFrame)
})

describe('syncAppViewportHeight', () => {
  it('falls back to window.innerHeight when visualViewport is unavailable', () => {
    const target = document.createElement('div')
    setWindowProperty('innerHeight', 812)
    setWindowProperty('visualViewport', undefined)

    const cleanup = syncAppViewportHeight(target)

    expect(target.style.getPropertyValue(VIEWPORT_HEIGHT_VAR)).toBe('812px')

    cleanup()

    expect(target.style.getPropertyValue(VIEWPORT_HEIGHT_VAR)).toBe('')
  })

  it('resyncs from visualViewport resize events', () => {
    const target = document.createElement('div')
    const viewport = createVisualViewport(721)
    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return 1
    })
    const cancelAnimationFrame = vi.fn()

    setWindowProperty('requestAnimationFrame', requestAnimationFrame)
    setWindowProperty('cancelAnimationFrame', cancelAnimationFrame)

    const cleanup = syncAppViewportHeight(target)

    expect(target.style.getPropertyValue(VIEWPORT_HEIGHT_VAR)).toBe('721px')

    viewport.height = 640
    viewport.dispatch('resize')

    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(target.style.getPropertyValue(VIEWPORT_HEIGHT_VAR)).toBe('721px')

    frameCallbacks[0](0)

    expect(target.style.getPropertyValue(VIEWPORT_HEIGHT_VAR)).toBe('640px')

    cleanup()

    expect(viewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(viewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(target.style.getPropertyValue(VIEWPORT_HEIGHT_VAR)).toBe('')
  })
})

import { useCallback, useEffect, useRef, useState } from 'react'

const sectionIds = ['welcome', 'collection', 'services', 'reservation']

export function useJourneyScroll() {
  const scrollRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const goTo = useCallback((index: number) => {
    const root = scrollRef.current
    const section = root?.querySelector<HTMLElement>(`#${sectionIds[index]}`)
    if (!root || !section) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    root.scrollTo({
      top: section.offsetTop,
      behavior: reduce ? 'instant' : 'smooth',
    })
  }, [])

  useEffect(() => {
    const root = scrollRef.current!
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener('change', updateMotion)
    let raf = 0
    const measure = () => {
      let current = 0
      sectionIds.forEach((id, index) => {
        const section = root.querySelector<HTMLElement>(`#${id}`)
        if (
          section &&
          root.scrollTop >= section.offsetTop - root.clientHeight * 0.45
        )
          current = index
      })
      setActive(current)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const canScrollInside = (target: EventTarget | null, direction: number) => {
      let element = target instanceof Element ? target : null
      while (element && element !== root) {
        if (element.matches('select, textarea')) return true
        if (
          /(auto|scroll)/.test(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 2
        ) {
          if (
            direction > 0 &&
            element.scrollTop + element.clientHeight < element.scrollHeight - 2
          )
            return true
          if (direction < 0 && element.scrollTop > 2) return true
        }
        element = element.parentElement
      }
      return false
    }
    const adjacent = (direction: number) => {
      const positions = sectionIds.map(
        (id) => root.querySelector<HTMLElement>(`#${id}`)!.offsetTop,
      )
      if (direction > 0)
        return positions.findIndex((top) => top > root.scrollTop + 2)
      for (let index = positions.length - 1; index >= 0; index--) {
        if (positions[index] < root.scrollTop - 2) return index
      }
      return -1
    }
    let gestureDirection = 0
    let gestureTimer = 0
    const resetGesture = () => {
      gestureDirection = 0
    }
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      const direction = Math.sign(event.deltaY)
      if (canScrollInside(event.target, direction)) {
        resetGesture()
        return
      }
      window.clearTimeout(gestureTimer)
      gestureTimer = window.setTimeout(resetGesture, 180)
      if (gestureDirection === direction) {
        event.preventDefault()
        return
      }
      gestureDirection = direction
      const next = adjacent(direction)
      if (next < 0) return
      // Every first vertical delta moves to an actual boundary, however small.
      // There is no minimum delta, inter-event gap requirement or animation lock.
      event.preventDefault()
      goTo(next)
    }
    const key = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, button, a, dialog, [contenteditable]',
          ))
      )
        return
      let next = -1
      if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = sectionIds.length - 1
      else if (
        ['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp', ' '].includes(event.key)
      ) {
        const direction =
          ['ArrowUp', 'PageUp'].includes(event.key) ||
          (event.key === ' ' && event.shiftKey)
            ? -1
            : 1
        if (canScrollInside(event.target, direction)) return
        next = adjacent(direction)
      }
      if (next >= 0) {
        event.preventDefault()
        goTo(next)
      }
    }
    // Touch, scrollbar dragging, and overflow panels retain native scrolling.
    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('wheel', wheel, { passive: false })
    root.addEventListener('keydown', key)
    window.addEventListener('resize', onScroll)
    measure()
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(gestureTimer)
      media.removeEventListener('change', updateMotion)
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('wheel', wheel)
      root.removeEventListener('keydown', key)
      window.removeEventListener('resize', onScroll)
    }
  }, [goTo])

  return { scrollRef, active, reducedMotion, goTo }
}

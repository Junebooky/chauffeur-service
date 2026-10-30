import { useCallback, useEffect, useRef, useState } from 'react'

const sectionIds = ['welcome', 'collection', 'services', 'reservation']

export function useJourneyScroll() {
  const scrollRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [heroProgress, setHeroProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const movingUntil = useRef(0)
  const lastWheel = useRef(0)
  const activeRef = useRef(0)

  const goTo = useCallback((index: number, heroEnd = false) => {
    const root = scrollRef.current
    const section = document.getElementById(sectionIds[index])
    if (!root || !section) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const top =
      index === 0 && heroEnd
        ? section.offsetHeight - root.clientHeight
        : section.offsetTop
    movingUntil.current = performance.now() + (reduce ? 80 : 850)
    root.scrollTo({ top, behavior: reduce ? 'instant' : 'smooth' })
  }, [])

  useEffect(() => {
    const root = scrollRef.current!
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener('change', updateMotion)
    let raf = 0
    const measure = () => {
      const heroEnd =
        document.getElementById('welcome')!.offsetHeight - root.clientHeight
      setHeroProgress(
        heroEnd > 0 ? Math.max(0, Math.min(1, root.scrollTop / heroEnd)) : 0,
      )
      let current = 0
      sectionIds.forEach((id, i) => {
        if (
          root.scrollTop >=
          document.getElementById(id)!.offsetTop - root.clientHeight * 0.45
        )
          current = i
      })
      activeRef.current = current
      setActive(current)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const canScrollInside = (target: EventTarget | null, delta: number) => {
      let el = target instanceof Element ? target : null
      while (el && el !== root) {
        if (
          el.hasAttribute('data-native-scroll') ||
          el.tagName === 'SELECT' ||
          el.tagName === 'TEXTAREA'
        )
          return true
        const style = getComputedStyle(el)
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          el.scrollHeight > el.clientHeight + 2
        ) {
          if (delta > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 2)
            return true
          if (delta < 0 && el.scrollTop > 2) return true
        }
        el = el.parentElement
      }
      return false
    }
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        event.deltaY === 0
      )
        return
      if (canScrollInside(event.target, event.deltaY)) return
      const now = performance.now()
      const gap = now - lastWheel.current
      lastWheel.current = now
      if (now < movingUntil.current) {
        event.preventDefault()
        return
      }
      const heroEnd =
        document.getElementById('welcome')!.offsetHeight - root.clientHeight
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? root.clientHeight
            : 1)
      if (root.scrollTop < heroEnd - 2 && activeRef.current === 0) {
        if (delta > 0 && root.scrollTop + delta >= heroEnd) {
          event.preventDefault()
          root.scrollTop = heroEnd
        }
        return
      }
      if (activeRef.current === 0 && delta < 0) return
      event.preventDefault()
      // Wait for the current wheel/trackpad gesture to finish before another panel.
      if (gap < 170 || Math.abs(delta) < 5) return
      const index = activeRef.current
      const next = delta > 0 ? Math.min(3, index + 1) : Math.max(0, index - 1)
      if (next !== index) goTo(next, next === 0)
    }
    const key = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          (event.target.matches(
            'input, textarea, select, button, a, [contenteditable]',
          ) ||
            event.target.closest('[role="dialog"]')))
      )
        return
      const index = activeRef.current
      if (event.key === 'Home') {
        event.preventDefault()
        goTo(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        goTo(3)
        return
      }
      if (index === 0) return
      if (
        ['ArrowDown', 'PageDown', ' '].includes(event.key) ||
        ['ArrowUp', 'PageUp'].includes(event.key)
      ) {
        event.preventDefault()
        if (performance.now() < movingUntil.current) return
        const next = Math.max(
          0,
          Math.min(
            3,
            index +
              (['ArrowUp', 'PageUp'].includes(event.key) || event.shiftKey
                ? -1
                : 1),
          ),
        )
        goTo(next, next === 0)
      }
    }
    let startY = 0
    let touchManaged = false
    let touchTarget: EventTarget | null = null
    const touchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      touchTarget = e.target
      const heroEnd =
        document.getElementById('welcome')!.offsetHeight - root.clientHeight
      touchManaged = root.scrollTop >= heroEnd - 2
    }
    const touchMove = (e: TouchEvent) => {
      const delta = startY - e.touches[0].clientY
      if (
        touchManaged &&
        !canScrollInside(touchTarget, delta) &&
        !(activeRef.current === 0 && delta < 0)
      )
        e.preventDefault()
    }
    const touchEnd = (e: TouchEvent) => {
      const delta = startY - e.changedTouches[0].clientY
      if (
        !touchManaged ||
        Math.abs(delta) < 50 ||
        canScrollInside(touchTarget, delta) ||
        performance.now() < movingUntil.current
      )
        return
      if (activeRef.current === 0 && delta < 0) return
      const next = Math.max(
        0,
        Math.min(3, activeRef.current + (delta > 0 ? 1 : -1)),
      )
      goTo(next, next === 0)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('wheel', wheel, { passive: false })
    root.addEventListener('touchstart', touchStart, { passive: true })
    root.addEventListener('touchmove', touchMove, { passive: false })
    root.addEventListener('touchend', touchEnd, { passive: true })
    root.addEventListener('keydown', key)
    window.addEventListener('resize', onScroll)
    measure()
    return () => {
      cancelAnimationFrame(raf)
      media.removeEventListener('change', updateMotion)
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('wheel', wheel)
      root.removeEventListener('touchstart', touchStart)
      root.removeEventListener('touchmove', touchMove)
      root.removeEventListener('touchend', touchEnd)
      root.removeEventListener('keydown', key)
      window.removeEventListener('resize', onScroll)
    }
  }, [goTo])

  return { scrollRef, active, heroProgress, reducedMotion, goTo }
}

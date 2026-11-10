import type { PointerEvent } from 'react'

// Move only a lightweight specular highlight; never transform the content.
export function trackGlassPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return
  const target = event.currentTarget
  const rect = target.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
  target.style.setProperty('--glass-x', x.toFixed(1) + '%')
  target.style.setProperty('--glass-y', y.toFixed(1) + '%')
}

export function resetGlassPointer(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty('--glass-x')
  event.currentTarget.style.removeProperty('--glass-y')
}

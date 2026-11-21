import type { HTMLAttributes } from 'react'
import { resetGlassPointer, trackGlassPointer } from '../../liquidGlass'

export type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  trackLight?: boolean
}

/** Shared interaction shell; each section owns its material and geometry. */
export default function GlassSurface({
  trackLight = true,
  className = '',
  onPointerMove,
  onPointerLeave,
  children,
  ...rest
}: GlassSurfaceProps) {
  return (
    <div
      {...rest}
      className={['relative isolate', className].join(' ')}
      data-liquid-glass="surface"
      onPointerMove={(event) => {
        if (trackLight) trackGlassPointer(event)
        onPointerMove?.(event)
      }}
      onPointerLeave={(event) => {
        if (trackLight) resetGlassPointer(event)
        onPointerLeave?.(event)
      }}
    >
      {children}
    </div>
  )
}

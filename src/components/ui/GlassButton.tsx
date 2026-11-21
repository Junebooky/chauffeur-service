import type { ButtonHTMLAttributes } from 'react'
import { resetGlassPointer, trackGlassPointer } from '../../liquidGlass'

type GlassAppearance = 'glass' | 'subtle' | 'bare'

export type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  appearance?: GlassAppearance
  /** Adds a shared pointer-following highlight without moving content. */
  trackLight?: boolean
}

const appearanceClasses: Record<GlassAppearance, string> = {
  glass:
    'rounded-full border border-white/25 bg-black/40 px-5 py-3 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl hover:border-white/50 hover:bg-white/10',
  subtle:
    'rounded-full border border-white/15 bg-black/30 px-5 py-3 text-white/85 backdrop-blur-lg hover:border-white/35 hover:bg-white/5',
  bare: '',
}

export default function GlassButton({
  appearance = 'glass',
  trackLight = false,
  type = 'button',
  className = '',
  children,
  onPointerMove,
  onPointerLeave,
  ...rest
}: GlassButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[
        'relative isolate inline-flex items-center justify-center gap-2',
        'transition-[background,border-color,box-shadow,color,transform] duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80',
        'disabled:cursor-not-allowed disabled:opacity-55',
        appearanceClasses[appearance],
        className,
      ].join(' ')}
      data-liquid-glass={trackLight ? 'control' : undefined}
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
    </button>
  )
}

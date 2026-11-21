import type { CSSProperties } from 'react'

/**
 * One reusable markup contract with section-owned visual recipes.
 * Fleet, booking and pricing effects intentionally remain different.
 */
export type BorderBeamVariant =
  | 'fleet-card'
  | 'booking-surface'
  | 'booking-card'
  | 'booking-cta'
  | 'pricing-card'

const legacyVariants: Record<
  Exclude<BorderBeamVariant, 'pricing-card'>,
  { halo: string; ring: string; spinner: string }
> = {
  'fleet-card': {
    halo: 'fleet-card-beam-halo',
    ring: 'fleet-card-beam-ring',
    spinner: 'fleet-card-beam-spinner',
  },
  'booking-surface': {
    halo: 'booking-glass-beam-halo',
    ring: 'booking-glass-beam-ring',
    spinner: 'booking-glass-beam-spinner',
  },
  'booking-card': {
    halo: 'booking-glass-beam-halo booking-card-beam-halo',
    ring: 'booking-glass-beam-ring booking-card-beam-ring',
    spinner: 'booking-glass-beam-spinner',
  },
  'booking-cta': {
    halo: 'booking-glass-beam-halo booking-cta-beam-halo',
    ring: 'booking-glass-beam-ring booking-cta-beam-ring',
    spinner: 'booking-glass-beam-spinner',
  },
}

const pricingMask: CSSProperties = {
  WebkitMask:
    'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  maskComposite: 'exclude',
}

const pricingSpinner =
  'absolute top-1/2 left-1/2 aspect-square w-[260%] motion-safe:animate-border-beam ' +
  'bg-[conic-gradient(from_0deg,transparent_0deg,transparent_58deg,rgba(255,255,255,0.22)_72deg,rgba(255,255,255,0.86)_86deg,#ffffff_90deg,rgba(255,255,255,0.86)_94deg,rgba(255,255,255,0.22)_108deg,transparent_122deg,transparent_238deg,rgba(255,255,255,0.22)_252deg,rgba(255,255,255,0.86)_266deg,#ffffff_270deg,rgba(255,255,255,0.86)_274deg,rgba(255,255,255,0.22)_288deg,transparent_302deg,transparent_360deg)]'

export default function BorderBeam({ variant }: { variant: BorderBeamVariant }) {
  if (variant === 'pricing-card') {
    return (
      <>
        <span
          aria-hidden="true"
          style={pricingMask}
          className="pointer-events-none absolute -inset-px z-20 overflow-hidden rounded-[19px] p-[1.5px] opacity-0 blur-[2px] transition-opacity duration-300 group-hover:opacity-45 group-focus-within:opacity-45"
        >
          <span className={pricingSpinner} />
        </span>
        <span
          aria-hidden="true"
          style={pricingMask}
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[18px] p-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <span className={pricingSpinner} />
        </span>
      </>
    )
  }

  const recipe = legacyVariants[variant]
  return (
    <>
      <span className={recipe.halo} aria-hidden="true">
        <span className={recipe.spinner} />
      </span>
      <span className={recipe.ring} aria-hidden="true">
        <span className={recipe.spinner} />
      </span>
    </>
  )
}

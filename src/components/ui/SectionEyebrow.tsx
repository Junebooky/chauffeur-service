import type { ReactNode } from 'react'

type SectionEyebrowProps = {
  children: ReactNode
  linePosition?: 'before' | 'after'
  className?: string
}

/**
 * Shared understated eyebrow for the Fleet, Pricing, and Reservation sections.
 * Typography, white opacity, and rule styling come from one CSS definition.
 */
export default function SectionEyebrow({
  children,
  linePosition = 'before',
  className = '',
}: SectionEyebrowProps) {
  const classes = ['chauffeur-section-eyebrow', className].filter(Boolean).join(' ')

  return (
    <span className={classes}>
      {linePosition === 'before' && (
        <span className="chauffeur-section-eyebrow-rule" aria-hidden="true" />
      )}
      <span className="chauffeur-section-eyebrow-label">{children}</span>
      {linePosition === 'after' && (
        <span className="chauffeur-section-eyebrow-rule" aria-hidden="true" />
      )}
    </span>
  )
}

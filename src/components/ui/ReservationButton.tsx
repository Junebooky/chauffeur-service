import type { ButtonHTMLAttributes } from 'react'
import { resetGlassPointer, trackGlassPointer } from '../../liquidGlass'
import BookingCtaBeam from './BookingCtaBeam'

type ReservationButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * The same reservation CTA is used by Booking and Fleet Specs.
 * Both share the glass surface, rotating highlight, focus and pointer response.
 */
export default function ReservationButton({
  children,
  className = '',
  type = 'button',
  onPointerMove,
  onPointerLeave,
  ...props
}: ReservationButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['booking-cta-pill', className].filter(Boolean).join(' ')}
      data-liquid-glass="control"
      onPointerMove={(event) => {
        trackGlassPointer(event)
        onPointerMove?.(event)
      }}
      onPointerLeave={(event) => {
        resetGlassPointer(event)
        onPointerLeave?.(event)
      }}
    >
      <BookingCtaBeam />
      <span className="booking-cta-pill-inner">{children}</span>
    </button>
  )
}

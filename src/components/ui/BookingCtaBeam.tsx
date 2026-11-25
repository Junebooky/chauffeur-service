/**
 * Shared hairline Border Beam for the booking invitation and ReservationButton.
 * Both highlights use one 1px mask and a symmetric gradient, with no extra
 * blurred halo that could make one side look thicker.
 */
export default function BookingCtaBeam() {
  return (
    <span className="booking-glass-beam-ring booking-cta-beam-ring" aria-hidden="true">
      <span className="booking-glass-beam-spinner" />
    </span>
  )
}

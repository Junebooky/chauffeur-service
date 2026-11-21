/**
 * Shared Border Beam used by Fleet's vehicle selection cards and Specs card.
 * The halo/ring markup and 14s animation remain exactly the Fleet originals;
 * the host surface controls when the beam is visible.
 */
export default function BorderBeam() {
  return (
    <>
      <span className="fleet-card-beam-halo" aria-hidden="true">
        <span className="fleet-card-beam-spinner" />
      </span>
      <span className="fleet-card-beam-ring" aria-hidden="true">
        <span className="fleet-card-beam-spinner" />
      </span>
    </>
  )
}

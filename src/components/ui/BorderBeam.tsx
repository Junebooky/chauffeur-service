import type { CSSProperties } from 'react'

export interface BorderBeamProps {
  /** Animation duration is set for each instance, not globally. */
  duration: string
}

/**
 * One reusable beam, individually paced for Fleet Dock, Interior thumbnails,
 * and Specs. Reduced-motion preferences are handled in the shared stylesheet.
 */
export default function BorderBeam({ duration }: BorderBeamProps) {
  const beamStyle = { '--fleet-border-beam-duration': duration } as CSSProperties

  return (
    <>
      <span className="fleet-card-beam-halo" aria-hidden="true">
        <span className="fleet-card-beam-spinner" style={beamStyle} />
      </span>
      <span className="fleet-card-beam-ring" aria-hidden="true">
        <span className="fleet-card-beam-spinner" style={beamStyle} />
      </span>
    </>
  )
}

import { MoveRight } from 'lucide-react'
import { resetGlassPointer, trackGlassPointer } from './liquidGlass'

export default function Hero({
  reducedMotion: _reducedMotion,
  goTo,
}: {
  reducedMotion: boolean
  goTo: (index: number) => void
}) {
  return (
    <section
      id="welcome"
      className="hero-track"
      aria-label="Welcome to Chauffeur"
    >
      <div className="hero-stage">
        <div className="hero-backdrop">
          <img
            src="/media/bg_01.png"
            alt="Chauffeur Luxury Fleet"
            className="hero-backdrop-img"
          />
          <div className="hero-backdrop-overlay" />
        </div>
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-heading">
          <p className="eyebrow">
            <span className="gold-line" /> PRIVATE CHAUFFEUR · SEOUL
          </p>
          <h1>
            The art of
            <br />
            <em>arriving.</em>
          </h1>
        </div>
        <div className="hero-aside">
          <p>
            Some journeys
            <br />
            deserve more
            <br />
            than a destination.
          </p>
          <span className="tiny-label">THE CHAUFFEUR STANDARD</span>
        </div>
        <div
          className="hero-caption"
          data-liquid-glass="control"
          onPointerMove={trackGlassPointer}
          onPointerLeave={resetGlassPointer}
          role="button"
          tabIndex={0}
          onClick={() => goTo(1)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') goTo(1)
          }}
          style={{ cursor: 'pointer' }}
        >
          <span>THE EXECUTIVE COLLECTION</span>
          <span>
            Quiet confidence. Unmistakable presence. <MoveRight size={13} />
          </span>
        </div>
      </div>
    </section>
  )
}

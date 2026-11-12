import { useEffect, useState } from 'react'

const HERO_SLIDE_COUNT = 4
const HERO_SLIDE_INTERVAL_MS = 5000

export default function Hero({
  reducedMotion,
  goTo: _goTo,
}: {
  reducedMotion: boolean
  goTo?: (index: number) => void
}) {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDE_COUNT)
    }, HERO_SLIDE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return (
    <section
      id="welcome"
      className="hero-track"
      aria-label="Welcome to Chauffeur"
    >
      <div className="hero-stage">
        <div className="hero-backdrop" aria-hidden="true">
          <img
            src="/media/hero/bg_004.png"
            alt=""
            fetchPriority="high"
            className={`hero-backdrop-img ${activeSlide === 0 ? 'is-active' : ''}`}
          />
          <img
            src="/media/hero/bg_02.png"
            alt=""
            fetchPriority="low"
            decoding="async"
            className={`hero-backdrop-img ${activeSlide === 1 ? 'is-active' : ''}`}
          />
          <img
            src="/media/hero/bg_003.png"
            alt=""
            fetchPriority="low"
            decoding="async"
            className={`hero-backdrop-img ${activeSlide === 2 ? 'is-active' : ''}`}
          />
          <img
            src="/media/hero/bg_01.png"
            alt=""
            fetchPriority="low"
            decoding="async"
            className={`hero-backdrop-img ${activeSlide === 3 ? 'is-active' : ''}`}
          />
          <div className="hero-backdrop-overlay" />
        </div>
        <div className="hero-heading">
          <p className="hero-eyebrow">Private Chauffeur · Seoul</p>
          <h1>
            The art of
            <br />
            arriving.
          </h1>
          <p className="hero-subtitle">
            Quiet confidence. Unmistakable presence.
          </p>
        </div>
      </div>
    </section>
  )
}

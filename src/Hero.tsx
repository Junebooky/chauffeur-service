import { useEffect, useState } from 'react'
import { MoveRight } from 'lucide-react'

const HERO_SLIDE_COUNT = 4
const HERO_SLIDE_INTERVAL_MS = 5000

export default function Hero({
  reducedMotion,
  goTo,
}: {
  reducedMotion: boolean
  goTo?: (index: number) => void
}) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => {
      setIsResetting(false)
      setActiveSlide((prev) => (prev >= HERO_SLIDE_COUNT ? 1 : prev + 1))
    }, HERO_SLIDE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  useEffect(() => {
    if (reducedMotion || activeSlide !== HERO_SLIDE_COUNT) return
    const resetTimer = window.setTimeout(() => {
      setIsResetting(true)
      setActiveSlide(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsResetting(false)
        })
      })
    }, 950)
    return () => window.clearTimeout(resetTimer)
  }, [activeSlide, reducedMotion])

  return (
    <section
      id="welcome"
      className="hero-track"
      aria-label="Welcome to Chauffeur"
    >
      <div className="hero-stage">
        <div className="hero-backdrop" aria-hidden="true">
          <div
            className={`hero-backdrop-track ${isResetting ? 'is-resetting' : ''}`}
            style={{
              transform: `translate3d(-${activeSlide * 100}%, 0, 0)`,
            }}
          >
            <div className="hero-backdrop-slide">
              <img
                src="/media/hero/bg_005.png"
                alt=""
                fetchPriority="high"
                className="hero-backdrop-img"
              />
            </div>
            <div className="hero-backdrop-slide">
              <img
                src="/media/hero/bg_004.png"
                alt=""
                fetchPriority="low"
                decoding="async"
                className="hero-backdrop-img"
              />
            </div>
            <div className="hero-backdrop-slide">
              <img
                src="/media/hero/bg_02.png"
                alt=""
                fetchPriority="low"
                decoding="async"
                className="hero-backdrop-img"
              />
            </div>
            <div className="hero-backdrop-slide">
              <img
                src="/media/hero/bg_003.png"
                alt=""
                fetchPriority="low"
                decoding="async"
                className="hero-backdrop-img"
              />
            </div>
            <div className="hero-backdrop-slide">
              <img
                src="/media/hero/bg_005.png"
                alt=""
                fetchPriority="low"
                decoding="async"
                className="hero-backdrop-img"
              />
            </div>
          </div>
          <div className="hero-backdrop-overlay" />
        </div>
        <div className="hero-heading">
          <h1>
            Premium
            <br />
            Chauffeur Service
          </h1>
          <p className="hero-subtitle">
            A discreet, safe, and refined travel experience
            <br />
            for business and personal occasions.
          </p>
          <button
            type="button"
            className="hero-book-link"
            onClick={() => goTo?.(3)}
          >
            <span>Book Now</span>
            <MoveRight size={18} strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}

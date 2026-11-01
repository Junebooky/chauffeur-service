import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, MoveRight, Play } from 'lucide-react'

export default function Hero({
  reducedMotion,
  goTo,
}: {
  reducedMotion: boolean
  goTo: (index: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [needsPlay, setNeedsPlay] = useState(false)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video || reducedMotion) {
      video?.pause()
      return
    }
    let cancelled = false
    // Muted inline playback is supported on mobile. If the browser declines
    // autoplay, offer playback explicitly without ever locking page scrolling.
    video.muted = true
    void video
      .play()
      .then(() => {
        if (!cancelled) setNeedsPlay(false)
      })
      .catch(() => {
        if (!cancelled) setNeedsPlay(true)
      })
    return () => {
      cancelled = true
      video.pause()
    }
  }, [reducedMotion])

  const play = () => {
    void videoRef.current
      ?.play()
      .then(() => setNeedsPlay(false))
      .catch(() => setNeedsPlay(true))
  }

  return (
    <section
      id="welcome"
      className="hero-track"
      aria-label="Welcome to Chauffeur"
    >
      <div className="hero-stage">
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
          <p className="hero-description">
            Exceptional cars. Considered service.
            <br />
            Every journey, a class of its own.
          </p>
          <button className="text-link hero-link" onClick={() => goTo(3)}>
            Make it your journey <ArrowUpRight size={17} />
          </button>
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
        <div className="hero-visual is-loaded">
          {failed || reducedMotion ? (
            <img
              src="/media/exterior.webp"
              alt="A chauffeur welcoming you to a black luxury sedan"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              preload="auto"
              poster="/media/exterior.webp"
              width="1224"
              height="480"
              aria-label="A chauffeur opens the door of your luxury sedan"
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                if (Number.isFinite(v.duration) && v.duration > 0)
                  setProgress(v.currentTime / v.duration)
              }}
              onEnded={() => {
                setProgress(1)
                setNeedsPlay(false)
              }}
              onError={() => {
                setFailed(true)
                setNeedsPlay(false)
              }}
            >
              <source
                src="/media/welcome.mp4"
                type="video/mp4"
                onError={() => {
                  setFailed(true)
                  setNeedsPlay(false)
                }}
              />
            </video>
          )}
        </div>
        <div className="hero-floor" />
        <div className="hero-bottom">

          {needsPlay && !failed && !reducedMotion && (
            <button className="text-link welcome-play" onClick={play}>
              <Play size={13} /> Play welcome film
            </button>
          )}
          {!reducedMotion && !failed && (
            <div className="hero-frame-indicator" aria-hidden="true">
              <span>WELCOME</span>
              <i>
                <b style={{ width: `${Math.max(5, progress * 100)}%` }} />
              </i>
              <span>01</span>
            </div>
          )}
        </div>
        <div className="hero-caption">
          <span>THE EXECUTIVE COLLECTION</span>
          <span>
            Quiet confidence. Unmistakable presence. <MoveRight size={13} />
          </span>
        </div>
      </div>
    </section>
  )
}

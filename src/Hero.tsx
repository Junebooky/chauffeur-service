import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, MoveRight } from 'lucide-react'

const frameCount = 38

export default function Hero({
  progress,
  reducedMotion,
  goTo,
}: {
  progress: number
  reducedMotion: boolean
  goTo: (index: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const images = useRef<(HTMLImageElement | undefined)[]>([])
  const progressRef = useRef(progress)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  progressRef.current = progress

  const draw = (position: number) => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const desired = Math.round(position * (frameCount - 1))
    let frame = images.current[desired]
    if (!frame) {
      for (let distance = 1; distance < frameCount; distance++) {
        frame =
          images.current[Math.max(0, desired - distance)] ||
          images.current[Math.min(frameCount - 1, desired + distance)]
        if (frame) break
      }
    }
    if (frame) {
      ctx.clearRect(0, 0, 1224, 480)
      ctx.drawImage(frame, 0, 0, 1224, 480)
    }
  }
  useEffect(() => {
    let cancelled = false
    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const image = new Image()
        image.onload = () => {
          if (!cancelled) {
            images.current[i] = image
            setLoaded(true)
            draw(progressRef.current)
          }
          resolve()
        }
        image.onerror = () => {
          if (i === 0 && !cancelled) setFailed(true)
          resolve()
        }
        image.src = `/media/hero/${String(i).padStart(3, '0')}.webp`
      })
    // First frame is immediately useful; four workers bound memory/network contention.
    void load(0).then(async () => {
      let next = 1
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (next < frameCount && !cancelled) {
            const index = next++
            await load(index)
          }
        }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    const raf = requestAnimationFrame(() => draw(reducedMotion ? 0 : progress))
    return () => cancelAnimationFrame(raf)
  }, [progress, reducedMotion])

  return (
    <section
      id="welcome"
      className={`hero-track ${reducedMotion ? 'reduced-hero' : ''}`}
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
          <span className="mini-star">✦</span>
          <p>
            Some journeys
            <br />
            deserve more
            <br />
            than a destination.
          </p>
          <span className="tiny-label">THE CHAUFFEUR STANDARD</span>
        </div>
        <div className={`hero-visual ${loaded ? 'is-loaded' : ''}`}>
          {failed ? (
            <img
              src="/media/hero/000.webp"
              alt="A chauffeur opening the door of a black luxury sedan"
            />
          ) : (
            <canvas
              ref={canvas}
              width="1224"
              height="480"
              role="img"
              aria-label="A chauffeur opens your car door as you scroll"
            />
          )}
        </div>
        <div className="hero-floor" />
        <div className="hero-bottom">
          <div className="scroll-prompt">
            <div className="scroll-mouse">
              <span />
            </div>
            <div>
              <span>
                {reducedMotion
                  ? 'YOUR JOURNEY BEGINS HERE'
                  : progress > 0.96
                    ? 'YOUR DOOR IS OPEN'
                    : 'SCROLL TO OPEN THE DOOR'}
              </span>
              <small>A little scroll. A warm welcome.</small>
            </div>
          </div>
          <div className="hero-frame-indicator" aria-hidden="true">
            <span>WELCOME</span>
            <i>
              <b style={{ width: `${Math.max(5, progress * 100)}%` }} />
            </i>
            <span>01</span>
          </div>
          <button
            className="discover-button"
            onClick={() => goTo(1)}
            aria-label="Discover our collection"
          >
            <ArrowDown size={19} />
          </button>
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

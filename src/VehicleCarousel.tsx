import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'
import catalog from './catalog.json'
import { money } from './utils'

export default function VehicleCarousel({
  value,
  onChange,
  availability,
}: {
  value: string
  onChange: (value: string) => void
  availability: Record<string, boolean>
}) {
  const active = catalog.vehicles.findIndex((v) => v.id === value)
  const current = catalog.vehicles[active] || catalog.vehicles[0]
  const touch = useRef({ x: 0, y: 0 })
  const suppressed = useRef(0)
  const [showSpecs, setShowSpecs] = useState(false)

  // Pre-load and pre-decode all 4 vehicle textures into GPU cache
  useEffect(() => {
    catalog.vehicles.forEach((v) => {
      const img = new Image()
      img.src = v.image
      if ('decode' in img) {
        img.decode().catch(() => { })
      }
    })
  }, [])

  const n = catalog.vehicles.length
  const change = (direction: number) => {
    const nextIndex = (active + direction + n) % n
    onChange(catalog.vehicles[nextIndex].id)
  }

  // Calculate convex mirror fisheye position for 5 vehicles
  const getCarStyle = (index: number) => {
    let diff = index - active
    if (diff > n / 2) diff -= n
    if (diff <= -n / 2) diff += n

    // 1. Center focused car: dramatic convex zoom & forward pop
    if (diff === 0) {
      return {
        transform: 'translateX(0%) translateY(4%) scale(1.36) rotateY(0deg)',
        zIndex: 10,
        opacity: 1,
      }
    }
    // 2. Immediate Left flanking car
    if (diff === -1) {
      return {
        transform:
          'translateX(-52%) translateY(-1%) scale(0.74) rotateY(18deg)',
        zIndex: 5,
        opacity: 0.75,
      }
    }
    // 3. Immediate Right flanking car
    if (diff === 1) {
      return {
        transform:
          'translateX(52%) translateY(-1%) scale(0.74) rotateY(-18deg)',
        zIndex: 5,
        opacity: 0.75,
      }
    }
    // 4. Far Left flanking car: outer perimeter of convex mirror
    if (diff === -2) {
      return {
        transform:
          'translateX(-88%) translateY(-4%) scale(0.52) rotateY(26deg)',
        zIndex: 2,
        opacity: 0.45,
      }
    }
    // 5. Far Right flanking car: outer perimeter of convex mirror
    if (diff === 2) {
      return {
        transform:
          'translateX(88%) translateY(-4%) scale(0.52) rotateY(-26deg)',
        zIndex: 2,
        opacity: 0.45,
      }
    }
    return {
      transform: 'translateX(0%) translateY(-12%) scale(0.48) rotateY(0deg)',
      zIndex: 1,
      opacity: 0,
      pointerEvents: 'none' as const,
    }
  }

  return (
    <div
      className="fleet-selector"
      role="region"
      aria-label="Interactive vehicle selection"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(e) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault()
          e.stopPropagation()
          if (e.key === 'Home') onChange(catalog.vehicles[0].id)
          else if (e.key === 'End') onChange(catalog.vehicles.at(-1)!.id)
          else change(e.key === 'ArrowRight' ? 1 : -1)
        }
      }}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        suppressed.current = 0
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touch.current.x
        const dy = e.changedTouches[0].clientY - touch.current.y
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          if (e.cancelable) e.preventDefault()
          suppressed.current = performance.now() + 350
          change(dx < 0 ? 1 : -1)
        }
      }}
    >
      <div className="fleet-selector-heading">
        <span className="fleet-heading-title">Select your vehicle</span>
        <div className="fleet-heading-actions">
          <button
            type="button"
            className="fleet-search-btn"
            aria-label="View fleet overview"
            title="Overview of all vehicles"
            onClick={() => setShowSpecs((prev) => !prev)}
          >
            <Search size={15} />
          </button>
        </div>
      </div>

      <div className="fleet-stage">
        <div className="fleet-orbit" aria-hidden="true" />
        <div className="fleet-lens-glow" aria-hidden="true" />

        {catalog.vehicles.map((v, i) => {
          const style = getCarStyle(i)
          const isSelected = value === v.id
          return (
            <button
              type="button"
              key={v.id}
              aria-label={`${v.name} — ${v.model}`}
              aria-pressed={isSelected}
              className={`fleet-car ${isSelected ? 'fleet-center' : ''}`}
              style={style}
              onClick={() => {
                if (performance.now() >= suppressed.current) onChange(v.id)
              }}
            >
              <img
                src={v.image}
                alt={v.name}
                className="fleet-car-image"
                loading="eager"
                decoding="sync"
                draggable={false}
              />
            </button>
          )
        })}

        <button
          type="button"
          className="fleet-arrow fleet-prev"
          aria-label="Previous vehicle"
          onClick={() => change(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="fleet-arrow fleet-next"
          aria-label="Next vehicle"
          onClick={() => change(1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="fleet-pagination" aria-label="Select a vehicle">
        {catalog.vehicles.map((v, i) => (
          <button
            key={v.id}
            type="button"
            className={value === v.id ? 'active' : ''}
            aria-label={`Select ${v.name} (0${i + 1})`}
            aria-pressed={value === v.id}
            onClick={() => onChange(v.id)}
          />
        ))}
      </div>

      <div className="fleet-selected" aria-live="polite" aria-atomic="true">
        <div>
          <h4>
            {current.name}
          </h4>
          <p>{current.model}</p>
        </div>
        <span className="fleet-surcharge">
          {current.surcharge ? `+${money(current.surcharge)}` : 'Included'}
        </span>
      </div>

      <div className="fleet-selected-meta">
        <span>
          <Users size={12} /> {current.passengers} guests
        </span>
        <span
          className={availability[value] === false ? 'fleet-unavailable' : ''}
        >
          {availability[value] === false
            ? 'Unavailable at this time'
            : 'Private chauffeur'}
        </span>
      </div>

      {showSpecs && (
        <div className="fleet-specs-grid">
          {catalog.vehicles.map((v) => (
            <button
              type="button"
              key={v.id}
              className={`fleet-spec-card ${v.id === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(v.id)
                setShowSpecs(false)
              }}
            >
              <img src={v.image} alt={v.name} />
              <div className="spec-info">
                <strong>{v.name}</strong>
                <small>{v.model}</small>
                <span>
                  {v.surcharge ? `+${money(v.surcharge)}` : 'Included'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="fleet-hint">
        Click or swipe vehicles to select. Convex perspective adapts to your
        collection.
      </p>
    </div>
  )
}

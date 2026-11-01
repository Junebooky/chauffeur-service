import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Luggage, Users } from 'lucide-react'
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
  const current = catalog.vehicles[active]
  const previous =
    catalog.vehicles[
      (active - 1 + catalog.vehicles.length) % catalog.vehicles.length
    ]
  const next = catalog.vehicles[(active + 1) % catalog.vehicles.length]
  const touch = useRef({ x: 0, y: 0 })
  const suppressed = useRef(0)
  const change = (direction: number) =>
    onChange(
      catalog.vehicles[
        (active + direction + catalog.vehicles.length) % catalog.vehicles.length
      ].id,
    )
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
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
          if (e.cancelable) e.preventDefault()
          suppressed.current = performance.now() + 350
          change(dx < 0 ? 1 : -1)
        }
      }}
    >
      <div className="fleet-selector-heading">
        <span>Interactive selection</span>
        <small>
          0{active + 1} / 0{catalog.vehicles.length}
        </small>
      </div>
      <div className="fleet-stage">
        <div className="fleet-orbit" aria-hidden="true" />
        <button
          type="button"
          className="fleet-car fleet-echo"
          aria-label="View previous vehicle"
          onClick={() => {
            if (performance.now() >= suppressed.current) change(-1)
          }}
        >
          <span className={`fleet-car-art art-${previous.id}`} />
        </button>
        {catalog.vehicles.map((v) => (
          <button
            type="button"
            key={v.id}
            aria-label={`${v.name} — ${v.model}`}
            aria-pressed={value === v.id}
            className={`fleet-car ${value === v.id ? 'fleet-center' : next.id === v.id ? 'fleet-right' : 'fleet-hidden'}`}
            onClick={() => {
              if (performance.now() >= suppressed.current) onChange(v.id)
            }}
          >
            <span className={`fleet-car-art art-${v.id}`} aria-hidden="true" />
          </button>
        ))}
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
        {catalog.vehicles.map((v) => (
          <button
            key={v.id}
            type="button"
            className={value === v.id ? 'active' : ''}
            aria-label={`Select ${v.name}`}
            aria-pressed={value === v.id}
            onClick={() => onChange(v.id)}
          />
        ))}
      </div>
      <div className="fleet-selected" aria-live="polite" aria-atomic="true">
        <div>
          <h4>{current.name}</h4>
          <p>{current.model}</p>
        </div>
        <span className="fleet-surcharge">
          {current.quoteRequired
            ? 'Quote on request'
            : current.surcharge
              ? `+${money(current.surcharge)}`
              : 'Included'}
        </span>
      </div>
      <div className="fleet-selected-meta">
        <span>
          <Users size={12} /> {current.passengers} guests
        </span>
        <span>
          <Luggage size={12} />{' '}
          {current.luggage === null
            ? 'Luggage on request'
            : `${current.luggage} bags`}
        </span>
        <span
          className={availability[value] === false ? 'fleet-unavailable' : ''}
        >
          {availability[value] === false
            ? 'Unavailable at this time'
            : 'Private chauffeur'}
        </span>
      </div>
      <p className="fleet-hint">
        Use the arrows, tap a car or swipe to explore. Rates exclude TAX. Images
        are illustrative.
      </p>
    </div>
  )
}

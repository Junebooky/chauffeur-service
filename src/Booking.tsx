import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  Plus,
  X,
} from 'lucide-react'
import catalog from './catalog.json'
import AddressSearch from './AddressSearch'
import type { Place } from './AddressSearch'
import GlassSelect from './GlassSelect'
import VehicleCarousel from './VehicleCarousel'
import { LiquidGlass } from 'simple-liquid-glass'
import { resetGlassPointer, trackGlassPointer } from './liquidGlass'
import DisplayHeading from './components/ui/DisplayHeading'
import ReservationButton from './components/ui/ReservationButton'
import {
  DEFAULT_USD_RATE,
  moneyUsd,
  addDays,
  displayDate,
  journeyDates,
  money,
  seoulDate,
  tomorrow,
} from './utils'

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  return `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
})

type Result = {
  reference: string
  status: string
  total: number | null
  quoteRequired: boolean
  journeys: {
    date: string
    time: string
    vehicle: string
    service: string
    total: number | null
    pickup: string
    destination: string
  }[]
  date: string
  time: string
  vehicle: string
  service: string
}
type DayRoute = {
  pickup: string
  destination: string
  pickupPlace: Place | null
  destinationPlace: Place | null
  flight: string
}

type Props = {
  service: string
  setService: (value: string) => void
  vehicle: string
  setVehicle: (value: string) => void
  showPrivacy: () => void
  onRequestCustom: () => void
  usdRate?: number
}

function Calendar({
  selectedDates,
  onChangeDates,
  multiDay,
  mode,
}: {
  selectedDates: string[]
  onChangeDates: (dates: string[]) => void
  multiDay: boolean
  mode: 'range' | 'discrete'
}) {
  const today = seoulDate()
  const maxDate = addDays(today, 365)
  const initialDate = selectedDates[0] || tomorrow()
  const [viewMonth, setViewMonth] = useState(() => initialDate.slice(0, 7))
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)

  useEffect(() => {
    setRangeAnchor(null)
  }, [multiDay, mode])

  const [y, m] = viewMonth.split('-').map(Number)
  const first = new Date(y, m - 1, 1, 12).getDay()
  const total = new Date(y, m, 0).getDate()

  const changeMonth = (delta: number) => {
    const next = new Date(y, m - 1 + delta, 1, 12)
    setViewMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
    )
  }

  const handleDateClick = (date: string) => {
    if (!multiDay) {
      onChangeDates([date])
      return
    }

    if (mode === 'range') {
      if (!rangeAnchor) {
        setRangeAnchor(date)
        onChangeDates([date])
      } else {
        if (date >= rangeAnchor) {
          const newDates = journeyDates(rangeAnchor, date)
          setRangeAnchor(null)
          onChangeDates(newDates)
        } else {
          setRangeAnchor(date)
          onChangeDates([date])
        }
      }
      return
    }

    // Discrete / Specific dates mode
    if (selectedDates.includes(date)) {
      if (selectedDates.length > 1) {
        onChangeDates(selectedDates.filter((d) => d !== date))
      }
    } else {
      const updated = [...selectedDates, date].sort()
      onChangeDates(updated)
    }
  }

  const startDate = selectedDates[0] || ''
  const endDate =
    selectedDates.length > 1 ? selectedDates[selectedDates.length - 1] : ''

  return (
    <div className="calendar" role="region" aria-label="Journey calendar">
      <div className="calendar-heading">
        <span>
          {new Date(`${viewMonth}-01T12:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </span>
        <div>
          <button
            type="button"
            className="icon-button"
            disabled={viewMonth <= today.slice(0, 7)}
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={viewMonth >= maxDate.slice(0, 7)}
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        className="calendar-grid"
        role="group"
        aria-label="Select your journey date"
      >
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
          <span
            key={day}
            className="calendar-day-name"
            aria-hidden="true"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`empty${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = `${viewMonth}-${String(i + 1).padStart(2, '0')}`
          const isSelected = selectedDates.includes(date)
          const isRangeStart =
            multiDay &&
            mode === 'range' &&
            (rangeAnchor ? date === rangeAnchor : date === startDate)
          const isRangeEnd =
            multiDay &&
            mode === 'range' &&
            !rangeAnchor &&
            endDate &&
            date === endDate &&
            startDate !== endDate
          const isInRange =
            multiDay &&
            mode === 'range' &&
            !rangeAnchor &&
            startDate &&
            endDate &&
            date > startDate &&
            date < endDate

          const classes = []
          if (isSelected) classes.push('selected')
          if (isRangeStart) classes.push('range-start')
          if (isRangeEnd) classes.push('range-end')
          if (isInRange) classes.push('in-range')

          return (
            <button
              type="button"
              key={date}
              aria-label={displayDate(date)}
              aria-pressed={isSelected}
              className={classes.join(' ')}
              disabled={date < today || date > maxDate}
              onClick={() => handleDateClick(date)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="calendar-note">
        <Clock3 size={12} /> Korea time (KST, UTC+9).
      </p>
    </div>
  )
}

export default function Booking({
  service,
  setService,
  vehicle,
  setVehicle,
  showPrivacy,
  onRequestCustom,
  usdRate: initialUsdRate = DEFAULT_USD_RATE,
}: Props) {
  const [usdRate, setUsdRate] = useState<number>(initialUsdRate)
  const [step, setStep] = useState(0)
  const [glassOpen, setGlassOpen] = useState(false)
  const [multiDay, setMultiDay] = useState(false)
  const [multiDayMode, setMultiDayMode] = useState<'range' | 'discrete'>('range')
  const [dates, setDates] = useState<string[]>(() => [tomorrow()])
  const [timesByDate, setTimesByDate] = useState<Record<string, string>>({})
  const [defaultTime, setDefaultTime] = useState('10:00')
  const [vehiclesByDate, setVehiclesByDate] = useState<Record<string, string>>({})
  const [vehicleMode, setVehicleMode] = useState<'same' | 'daily'>('same')
  const [routesByDate, setRoutesByDate] = useState<Record<string, DayRoute>>({})
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [confirmCopySchedule, setConfirmCopySchedule] = useState(false)
  const [activeDate, setActiveDate] = useState('')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [pickupPlace, setPickupPlace] = useState<Place | null>(null)
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null)
  const [flight, setFlight] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contactMethod, setContactMethod] = useState('email')
  const [messengerContact, setMessengerContact] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [availability, setAvailability] = useState<
    Record<string, Record<string, boolean>>
  >({})
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [availabilityVersion, setAvailabilityVersion] = useState(0)
  const form = useRef<HTMLFormElement>(null)
  const idempotency = useRef(crypto.randomUUID())
  const heading = useRef<HTMLHeadingElement>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)
  const glassTrigger = useRef<HTMLButtonElement>(null)
  const refractionBackdrop = useRef<HTMLDivElement>(null)
  const pillsContainerRef = useRef<HTMLDivElement>(null)
  const activePillRef = useRef<HTMLButtonElement>(null)
  const currentService = catalog.services.find((s) => s.id === service)!

  const scrollPills = (delta: number) => {
    pillsContainerRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const currentActiveDate = dates.includes(activeDate)
    ? activeDate
    : dates[0] || tomorrow()

  const activeDayIndex = Math.max(0, dates.indexOf(currentActiveDate))

  useEffect(() => {
    activePillRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [currentActiveDate])

  const getTime = (d: string) => timesByDate[d] || defaultTime
  const setTimeForDate = (d: string, t: string) => {
    setTimesByDate((prev) => ({ ...prev, [d]: t }))
  }
  const applyTimeToAll = (t: string) => {
    const updated: Record<string, string> = {}
    dates.forEach((d) => {
      updated[d] = t
    })
    setTimesByDate(updated)
    setDefaultTime(t)
  }

  const getVehicle = (d: string) =>
    !multiDay || vehicleMode === 'same' ? vehicle : (vehiclesByDate[d] || vehicle)
  const setVehicleForDate = (d: string, vId: string) => {
    setVehiclesByDate((prev) => ({ ...prev, [d]: vId }))
  }
  const applyVehicleToAll = (vId: string) => {
    const updated: Record<string, string> = {}
    dates.forEach((d) => {
      updated[d] = vId
    })
    setVehiclesByDate(updated)
    setVehicle(vId)
  }

  const activeVehicle = getVehicle(currentActiveDate)
  const changeVehicle = (vId: string) => {
    if (!multiDay || vehicleMode === 'same') {
      applyVehicleToAll(vId)
    } else {
      setVehicleForDate(currentActiveDate, vId)
    }
  }

  // Shared route defaults; dates use these until the guest edits a specific day.
  const defaultRoute: DayRoute = {
    pickup, pickupPlace, destination, destinationPlace, flight,
  }
  const getRoute = (day: string): DayRoute =>
    multiDay ? (routesByDate[day] ?? defaultRoute) : defaultRoute
  const setRouteForDate = (day: string, patch: Partial<DayRoute>) => {
    setRoutesByDate((previous) => ({
      ...previous,
      [day]: { ...(previous[day] ?? defaultRoute), ...patch },
    }))
  }
  const customizeDate = (day: string) => {
    // Opening a day does not freeze the defaults. Only changed fields create
    // an override, so untouched dates always inherit the latest shared route.
    setEditingDate((previous) => previous === day ? null : day)
  }
  const applyScheduleToAll = () => {
    const first = dates[0]
    const route = { ...getRoute(first) }
    const time = getTime(first)
    setRoutesByDate(Object.fromEntries(dates.slice(1).map((d) => [d, { ...route }])))
    applyTimeToAll(time)
    setConfirmCopySchedule(false)
    setEditingDate(null)
  }

  const handleModeChange = (newMode: 'range' | 'discrete') => {
    setMultiDayMode(newMode)
    if (newMode === 'range' && dates.length > 1) {
      const start = dates[0]
      const end = dates[dates.length - 1]
      setDates(journeyDates(start, end))
    }
  }

  const journeys = dates.map((day) => ({
    date: day,
    time: getTime(day),
    vehicle: getVehicle(day),
    ...getRoute(day),
  }))

  const extras = catalog.options
    .filter((o) => options.includes(o.id))
    .reduce((sum, o) => sum + o.price, 0)

  const quoteRequired = journeys.some(
    (day) => catalog.vehicles.find((v) => v.id === day.vehicle)!.quoteRequired,
  )

  const vehicleSurcharges = journeys.reduce(
    (sum, day) =>
      sum + catalog.vehicles.find((v) => v.id === day.vehicle)!.surcharge,
    0,
  )

  const total = journeys.reduce((sum, day) => {
    const v = catalog.vehicles.find((veh) => veh.id === day.vehicle)
    return sum + currentService.price + (v?.surcharge || 0) + extras
  }, 0)

  const allAvailable =
    journeys.length > 0 &&
    journeys.every((day) => availability[day.date]?.[day.vehicle] === true)

  const unavailableDay = journeys.find(
    (day) => availability[day.date]?.[day.vehicle] === false,
  )

  const datesKey = dates.join(',')
  const timesKey = dates.map((d) => getTime(d)).join(',')

  // Removing a date also removes its unsent per-day overrides.
  useEffect(() => {
    const present = new Set(datesKey.split(','))
    const prune = <T,>(previous: Record<string, T>): Record<string, T> => {
      const remaining = Object.entries(previous).filter(([date]) => present.has(date))
      return remaining.length === Object.keys(previous).length
        ? previous
        : Object.fromEntries(remaining)
    }
    setRoutesByDate(prune)
    setTimesByDate(prune)
    setVehiclesByDate(prune)
    setEditingDate((previous) => previous && !present.has(previous) ? null : previous)
  }, [datesKey])

  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setAvailability({})
    setError('')
    const params = new URLSearchParams()
    params.set('service', service)
    params.set('dates', dates.join(','))
    params.set('times', dates.map((d) => getTime(d)).join(','))
    params.set('date', dates[0] || tomorrow())
    params.set('time', getTime(dates[0] || tomorrow()))
    if (dates.length > 1) {
      params.set('endDate', dates[dates.length - 1])
    }

    fetch(`/api/availability?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || 'Availability could not be checked.')
        setAvailability(
          Object.fromEntries(
            data.days.map(
              (day: {
                date: string
                vehicles: { id: string; available: boolean }[]
              }) => [
                  day.date,
                  Object.fromEntries(
                    day.vehicles.map((v) => [v.id, v.available]),
                  ),
                ],
            ),
          ),
        )
        if (data?.usdRate && typeof data.usdRate === 'number') {
          setUsdRate(data.usdRate)
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError')
          setError(
            error instanceof TypeError
              ? 'We cannot reach the reservation service. Please try again shortly.'
              : error.message,
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false)
      })
    return () => controller.abort()
  }, [datesKey, timesKey, service, availabilityVersion])
  useEffect(() => {
    if (initialUsdRate) setUsdRate(initialUsdRate)
  }, [initialUsdRate])
  useEffect(() => {
    if (result) successHeading.current?.focus()
  }, [result])
  useEffect(() => {
    if (!glassOpen || result) return
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [glassOpen, result])

  const moveStep = (target: number) => {
    if (target > step && !form.current?.reportValidity()) return
    if (target > step && step === 0) {
      if (multiDay && dates.length < 2) {
        setError('Choose at least two dates, then continue.')
        return
      }
      const invalid = journeys.find((day) =>
        !day.pickupPlace || !day.destinationPlace ||
        day.pickupPlace.id === day.destinationPlace.id
      )
      if (invalid) {
        setError(`Confirm different pick-up and destination places for ${displayDate(invalid.date)}.`)
        setEditingDate(invalid.date !== dates[0] ? invalid.date : null)
        return
      }
    }
    if (target > step && step === 1 && !allAvailable) {
      setError(
        unavailableDay
          ? `Please choose another vehicle or time for ${displayDate(unavailableDay.date)}.`
          : 'Please wait for availability to be checked for every day, or retry.',
      )
      return
    }
    setError('')
    setStep(target)
    requestAnimationFrame(() => heading.current?.focus())
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (step < 2) {
      moveStep(step + 1)
      return
    }
    if (sending) return
    setSending(true)
    setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotency.current,
        },
        body: JSON.stringify({
          date: journeys[0].date,
          time: journeys[0].time,
          pickup,
          destination,
          pickupPlace,
          destinationPlace,
          flight,
          service,
          vehicle: journeys[0].vehicle,
          journeys,
          options,
          name,
          email,
          phone,
          contactMethod,
          messengerContact,
          consent,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409) {
          setStep(1)
          setAvailabilityVersion((v) => v + 1)
        }
        throw new Error(
          data.error || 'We could not save your request. Please try again.',
        )
      }
      setResult(data)
    } catch (error) {
      setError(
        error instanceof Error && error.name === 'AbortError'
          ? 'The request timed out. Please retry; your request will not be duplicated.'
          : error instanceof TypeError
            ? 'Connection interrupted. Please retry; your request will not be duplicated.'
            : (error as Error).message,
      )
    } finally {
      clearTimeout(timeout)
      setSending(false)
    }
  }
  const downloadCalendar = () => {
    if (!result) return
    const stamp = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
    const escape = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&')
    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Chauffeur//Journey Request//EN',
      ...result.journeys.flatMap((day) => {
        const start = new Date(`${day.date}T${day.time}:00+09:00`)
        const end = new Date(
          start.getTime() + currentService.duration * 3600000,
        )
        return [
          'BEGIN:VEVENT',
          `UID:${result.reference}-${day.date}@chauffeur.local`,
          `DTSTAMP:${stamp(new Date())}`,
          `DTSTART:${stamp(start)}`,
          `DTEND:${stamp(end)}`,
          `SUMMARY:${escape(`Chauffeur request ${result.reference} — ${day.vehicle} — pending confirmation`)}`,
          `LOCATION:${escape(day.pickup || pickup)}`,
          'DESCRIPTION:Reservation request only. This journey has not been confirmed. All prices exclude TAX.',
          'STATUS:TENTATIVE',
          'END:VEVENT',
        ]
      }),
      'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(
      new Blob([calendar], { type: 'text/calendar;charset=utf-8' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.reference}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section
      id="reservation"
      className={`screen booking-screen ${glassOpen || result ? "booking-glass-open" : "booking-glass-closed"}`}
      aria-labelledby="booking-title"
    >
      <div className="booking-backdrop" aria-hidden="true">
        <img
          src="/media/reservation/bg_reservation.png"
          alt=""
          className="booking-backdrop-img"
          loading="lazy"
        />
        <div className="booking-backdrop-overlay" />
      </div>
      <div className="section-topline">
        <span className="eyebrow">
          <span className="gold-line" /> YOUR NEXT CHAPTER
        </span>
        <span className="section-numeral">04 / RESERVATION</span>
      </div>
      <div className="section-heading booking-heading">
        <DisplayHeading as="h2" id="booking-title">
          Your journey.
          <br className="mobile-break" /> <em>Your way.</em>
        </DisplayHeading>
        <p>
          A few details. Endless possibilities.
          <br />
          We'll take care of the road ahead.
        </p>
      </div>
      <div className={`booking-glass-stage ${glassOpen || result ? 'is-expanded' : 'is-idle'}`}>
        <div className="booking-glass-refraction-backdrop" ref={refractionBackdrop} aria-hidden="true" />
        {(glassOpen || result) && (
          <nav className="booking-outer-stepper" aria-label="Reservation steps">
            {['Schedule', 'Vehicle', 'Your Details', 'Confirmation'].map((label, i, arr) => {
              const displayStep = result ? 3 : step
              const isActive = displayStep === i
              const isComplete = i < displayStep
              const canJump = !result && i < step && !sending
              return (
                <div className="booking-stepper-item" key={label}>
                  <button
                    type="button"
                    disabled={!canJump && !isActive}
                    className={`booking-stepper-btn ${isActive ? 'active' : isComplete ? 'complete' : ''}`}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => {
                      if (canJump) moveStep(i)
                    }}
                  >
                    <span className="booking-stepper-num">
                      {isComplete ? <Check size={14} /> : i + 1}
                    </span>
                    <span className="booking-stepper-label">{label}</span>
                  </button>
                  {i < arr.length - 1 && (
                    <span
                      className={`booking-stepper-line ${i < displayStep ? 'is-complete' : ''}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </nav>
        )}
        <div
          className={`booking-glass-surface ${step === 0 && glassOpen && !result ? 'is-schedule-step' : ''}`}
          data-liquid-glass="surface"
          onPointerMove={trackGlassPointer}
          onPointerLeave={resetGlassPointer}
        >
          {!glassOpen && !result && (
            <>
              <span className="booking-glass-beam-halo" aria-hidden="true">
                <span className="booking-glass-beam-spinner" />
              </span>
              <span className="booking-glass-beam-ring" aria-hidden="true">
                <span className="booking-glass-beam-spinner" />
              </span>
              <div className="booking-optical-lens" aria-hidden="true">
                <LiquidGlass
                  className="booking-optical-engine"
                  backdropRef={refractionBackdrop}
                  renderer="auto"
                  material="clear"
                  refraction="lens"
                  lensProfile="player"
                  lensOptions={{ strength: 0.1, sheen: 0.45, specular: 0.5 }}
                  radius={42}
                  scale={120}
                  quality="standard"
                  blur={0}
                  frost={0}
                  saturation={115}
                  background="rgba(255, 255, 255, 0.01)"
                  style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                />
              </div>
            </>
          )}
          {(glassOpen || result) && (
            <>
              <span className="booking-glass-beam-halo booking-card-beam-halo" aria-hidden="true">
                <span className="booking-glass-beam-spinner" />
              </span>
              <span className="booking-glass-beam-ring booking-card-beam-ring" aria-hidden="true">
                <span className="booking-glass-beam-spinner" />
              </span>
            </>
          )}
          {!glassOpen && !result && (
            <button
              ref={glassTrigger}
              type="button"
              className="booking-glass-trigger"
              aria-label="Ready to reserve your chauffeur? Begin your journey"
              aria-controls="reservation-glass-content"
              aria-expanded={false}
              onClick={() => setGlassOpen(true)}
            >
              <span className="booking-glass-prompt">Ready to reserve your chauffeur?</span>
              <span className="booking-glass-subtitle">Begin your journey</span>
              <ArrowRight size={18} strokeWidth={1.4} aria-hidden="true" />
            </button>
          )}
          {glassOpen && !result && (
            <button
              type="button"
              className="booking-glass-close"
              aria-label="Close reservation panel"
              onClick={() => {
                setGlassOpen(false)
                requestAnimationFrame(() => glassTrigger.current?.focus({ preventScroll: true }))
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
          <div id="reservation-glass-content" className="booking-glass-content">
            {result ? (
              <div className="booking-success">
                <div className="success-symbol">
                  <CheckCircle2 size={35} strokeWidth={1} />
                </div>
                <p className="eyebrow">YOUR REQUEST HAS BEEN SAVED</p>
                <h3 ref={successHeading} tabIndex={-1}>
                  A beautiful journey
                  <br />
                  <em>starts here.</em>
                </h3>
                <p className="success-reference">{result.reference}</p>
                <div className="success-details">
                  {result.journeys.map((day) => (
                    <span key={day.date}>
                      {displayDate(day.date)} · {day.time} KST · {day.vehicle}
                      <small> · {day.pickup} → {day.destination}</small>
                    </span>
                  ))}
                  <span>
                    {result.service} · {result.journeys.length}{' '}
                    {result.journeys.length === 1 ? 'day' : 'days'}
                  </span>
                  <span>
                    {result.total === null
                      ? 'Quote on request'
                      : `${money(result.total)} estimated total`}{' '}
                    · TAX excluded
                  </span>
                </div>
                <p className="pending-notice">
                  This is a pending reservation request, not a confirmed booking. No
                  payment has been taken. This site stores requests locally; email and
                  operator delivery are not connected.
                </p>
                <div className="success-actions">
                  <button className="button gold-button" onClick={downloadCalendar}>
                    Save to calendar <CalendarDays size={16} />
                  </button>
                  <button
                    className="text-link"
                    onClick={() => {
                      setResult(null)
                      setStep(0)
                      setGlassOpen(false)
                      setName('')
                      setEmail('')
                      setPhone('')
                      setContactMethod('email')
                      setMessengerContact('')
                      setConsent(false)
                      idempotency.current = crypto.randomUUID()
                      setAvailabilityVersion((v) => v + 1)
                    }}
                  >
                    Plan another journey <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            ) : glassOpen ? (
              <form
                id="booking-request-form"
                ref={form}
                onSubmit={submit}
                className={`booking-panel ${step === 0 ? 'is-schedule-only' : 'is-split-view'}`}
              >
                <div className="booking-main">
                  <div className="booking-fields" key={step}>
                    <h3 className="sr-only" tabIndex={-1} ref={heading}>
                      {
                        [
                          'Select your schedule and route',
                          'Choose your vehicle and options',
                          'Enter your contact details',
                        ][step]
                      }
                    </h3>
                    {step === 0 && (
                      <div className="schedule-fields">
                        <div className="schedule-date-col">
                          <div className="schedule-col-header">
                            <CalendarDays size={16} aria-hidden="true" />
                            <span>Select Date</span>
                          </div>
                          <Calendar
                            selectedDates={dates}
                            onChangeDates={(newDates) => {
                              setDates(newDates)
                              if (!newDates.includes(activeDate)) {
                                setActiveDate(newDates[0] || '')
                              }
                            }}
                            multiDay={multiDay}
                            mode={multiDayMode}
                          />
                          <div
                            className="day-mode-segmented"
                            role="radiogroup"
                            aria-label="Trip duration mode"
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!multiDay}
                              className={`day-mode-pill ${!multiDay ? 'active' : ''}`}
                              onClick={() => {
                                setMultiDay(false)
                                const first = dates[0] || tomorrow()
                                setDates([first])
                                setActiveDate(first)
                                setEditingDate(null)
                                setRoutesByDate({})
                                setTimesByDate({})
                                setVehicleMode('same')
                              }}
                            >
                              Single Day
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={multiDay}
                              className={`day-mode-pill ${multiDay ? 'active' : ''}`}
                              onClick={() => {
                                setMultiDay(true)
                                // Guests explicitly select all dates in the calendar.
                              }}
                            >
                              Multiple Days
                            </button>
                          </div>
                          {multiDay && (
                            <div className="multi-day-control">
                              <div
                                className="multi-day-mode-toggle"
                                role="radiogroup"
                                aria-label="Journey scheduling type"
                              >
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={multiDayMode === 'range'}
                                  className={`mode-btn ${multiDayMode === 'range' ? 'active' : ''}`}
                                  onClick={() => handleModeChange('range')}
                                >
                                  <span>
                                    <CalendarRange size={14} /> Consecutive Range
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={multiDayMode === 'discrete'}
                                  className={`mode-btn ${multiDayMode === 'discrete' ? 'active' : ''}`}
                                  onClick={() => handleModeChange('discrete')}
                                >
                                  <span>
                                    <CalendarDays size={14} /> Specific Dates
                                  </span>
                                </button>
                              </div>
                              <div className="selected-dates-summary">
                                <span>
                                  <strong>
                                    {dates.length}{' '}
                                    {dates.length === 1 ? 'day' : 'days'}
                                  </strong>
                                  {multiDayMode === 'range' && dates.length > 1
                                    ? ` · ${displayDate(dates[0])} — ${displayDate(dates[dates.length - 1])}`
                                    : ` · ${dates.map((d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}`}
                                </span>
                                {dates.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setDates([dates[0]])}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              {dates.length > 1 ? (
                                <div className="daily-times-section">
                                  <div className="daily-times-header">
                                    <span className="field-label"><CalendarDays size={14} /> Your Daily Schedule</span>
                                    <button type="button" className="apply-all-btn" onClick={() => setConfirmCopySchedule(true)}>
                                      Copy Day 1 to all
                                    </button>
                                  </div>
                                  {confirmCopySchedule && (
                                    <div className="selected-dates-summary" role="group" aria-label="Confirm schedule copy">
                                      <span>Replace the other days' routes and times with Day 1?</span>
                                      <button type="button" onClick={applyScheduleToAll}>Confirm</button>
                                      <button type="button" onClick={() => setConfirmCopySchedule(false)}>Cancel</button>
                                    </div>
                                  )}
                                  <p className="field-note">
                                    All dates use the default route and time unless you customize them.
                                    Select a date to change its pick-up, destination or time.
                                  </p>
                                  <div className="daily-times-grid" data-native-scroll>
                                    {dates.map((d, index) => {
                                      const route = getRoute(d)
                                      const customized = Boolean(routesByDate[d]) || getTime(d) !== defaultTime
                                      const isOpen = editingDate === d
                                      return (
                                        <div key={d} className={`daily-journey-card ${isOpen ? 'active-day-card' : ''}`}>
                                          <button type="button" className="card-top w-full text-left" aria-expanded={isOpen} onClick={() => customizeDate(d)}>
                                            <span className="day-indicator">
                                              <span className="badge">Day {String(index + 1).padStart(2, '0')}</span>
                                              <strong>{displayDate(d)}</strong>
                                            </span>
                                            <span className="active-hint">{customized ? 'Customized' : 'Default plan'} · {isOpen ? 'Close' : 'Edit'}</span>
                                          </button>
                                          <p className="field-note">
                                            {getTime(d)} · {route.pickup || 'Choose pick-up'} → {route.destination || 'Choose destination'}
                                          </p>
                                          {isOpen && (
                                            <div className="grid gap-3 p-3">
                                              <AddressSearch
                                                name={`pickup-${d}`}
                                                label={`Pick-up for Day ${index + 1}`}
                                                placeholder="Enter pick-up location"
                                                value={route.pickup}
                                                place={route.pickupPlace}
                                                rightIcon="nav"
                                                onChange={(value, place) => setRouteForDate(d, { pickup: value, pickupPlace: place })}
                                              />
                                              <AddressSearch
                                                name={`destination-${d}`}
                                                label={`Destination for Day ${index + 1}`}
                                                placeholder="Enter destination"
                                                value={route.destination}
                                                place={route.destinationPlace}
                                                rightIcon="nav"
                                                onChange={(value, place) => setRouteForDate(d, { destination: value, destinationPlace: place })}
                                              />
                                              {service === 'airport' && (
                                                <label className="field">
                                                  <span>Flight number <small>optional</small></span>
                                                  <input name={`flight-${d}`} maxLength={30} value={route.flight}
                                                    onChange={(event) => setRouteForDate(d, { flight: event.target.value })}
                                                    placeholder="e.g. KE 902" />
                                                </label>
                                              )}
                                              <div className="field">
                                                <span>Pick-up Time</span>
                                                <GlassSelect compact
                                                  ariaLabel={`Pick-up time for Day ${index + 1}`}
                                                  value={getTime(d)}
                                                  onChange={(time) => setTimeForDate(d, time)}
                                                  options={timeOptions.map((time) => ({ value: time, label: time }))}
                                                />
                                              </div>
                                              <button type="button" className="apply-all-btn" onClick={() => {
                                                setRoutesByDate((previous) => {
                                                  const next = { ...previous }
                                                  delete next[d]
                                                  return next
                                                })
                                                setTimesByDate((previous) => {
                                                  const next = { ...previous }
                                                  delete next[d]
                                                  return next
                                                })
                                                setEditingDate(null)
                                              }}>Use default route & time</button>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className="field-note">Select at least two dates in the calendar to continue.</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="schedule-divider" aria-hidden="true" />
                        <div className="route-fields schedule-route-col">
                          <div className="field">
                            <span>
                              <Car size={15} aria-hidden="true" /> Service
                            </span>
                            <GlassSelect
                              ariaLabel="Service"
                              name="service"
                              value={service}
                              onChange={(next) => {
                                if (next === 'custom') onRequestCustom()
                                else setService(next)
                              }}
                              options={[
                                ...catalog.services.filter((s) => s.id === 'airport' || s.id === 'day').map((s) => ({
                                  value: s.id, label: s.name, meta: s.unit,
                                })),
                                { value: 'custom', label: 'Custom', meta: 'Tailored quote' },
                              ]}
                            />
                          </div>
                          <AddressSearch
                            name="pickup"
                            label="Pickup Location"
                            placeholder="Enter pickup location"
                            rightIcon="nav"
                            value={pickup}
                            place={pickupPlace}
                            onChange={(value, selected) => {
                              setPickup(value)
                              setPickupPlace(selected)
                            }}
                          />
                          {service === 'airport' && (
                            <label className="field">
                              <span>
                                Flight number <small>optional</small>
                              </span>
                              <input
                                name="flight"
                                maxLength={30}
                                value={flight}
                                onChange={(e) => setFlight(e.target.value)}
                                placeholder="e.g. KE 902"
                              />
                            </label>
                          )}
                          <AddressSearch
                            name="destination"
                            label="Destination"
                            placeholder="Enter destination"
                            rightIcon="nav"
                            value={destination}
                            place={destinationPlace}
                            onChange={(value, selected) => {
                              setDestination(value)
                              setDestinationPlace(selected)
                            }}
                          />
                          <div className="field time-field">
                            <span>
                              <Clock3 size={15} aria-hidden="true" />{' '}
                              {multiDay ? 'Default Pick-up Time' : 'Pick-up Time'}
                            </span>
                            <GlassSelect
                              ariaLabel={
                                multiDay ? 'Default Pick-up Time' : 'Pick-up Time'
                              }
                              name="pickup-time"
                              value={multiDay ? defaultTime : getTime(dates[0] || tomorrow())}
                              onChange={(t) => {
                                setDefaultTime(t)
                                if (!multiDay) setTimeForDate(dates[0] || tomorrow(), t)
                              }}
                              options={timeOptions.map((t) => ({
                                value: t,
                                label: t,
                              }))}
                            />
                            <small className="field-note">Korea time (KST, UTC+9). All daily times use this time zone.</small>
                          </div>
                        </div>
                      </div>
                    )}
                    {step === 1 && (
                      <div className="preferences-fields">
                        <p className="field-section-title">Select your collection</p>
                        {multiDay && dates.length > 1 && (
                          <div className="daily-schedule-configuration">
                            <div className="daily-schedule-header">
                              <div>
                                <strong>How would you like to travel?</strong>
                                <small>Choose once for the whole trip, or set a vehicle for each day.</small>
                              </div>
                            </div>
                            <div className="day-mode-segmented" role="radiogroup" aria-label="Vehicle assignment">
                              <button type="button" role="radio" aria-checked={vehicleMode === 'same'}
                                className={`day-mode-pill ${vehicleMode === 'same' ? 'active' : ''}`}
                                onClick={() => {
                                  applyVehicleToAll(getVehicle(currentActiveDate))
                                  setVehicleMode('same')
                                }}>
                                Same vehicle for all days
                              </button>
                              <button type="button" role="radio" aria-checked={vehicleMode === 'daily'}
                                className={`day-mode-pill ${vehicleMode === 'daily' ? 'active' : ''}`}
                                onClick={() => setVehicleMode('daily')}>
                                Choose per day
                              </button>
                            </div>
                            {vehicleMode === 'same' ? (
                              <p className="field-note">Select a vehicle in the existing showroom. Your choice applies to every day.</p>
                            ) : (
                              <div className="daily-schedule-cards" role="group" aria-label="Choose a day to assign a vehicle">
                                {dates.map((d, index) => {
                                  const selected = getVehicle(d)
                                  const car = catalog.vehicles.find((item) => item.id === selected)!
                                  const isActive = currentActiveDate === d
                                  const isAvail = availability[d]?.[selected]
                                  return (
                                    <button key={d} type="button"
                                      className={`daily-journey-card w-full text-left ${isActive ? 'active-day-card' : ''}`}
                                      aria-pressed={isActive}
                                      onClick={() => setActiveDate(d)}>
                                      <span className="card-top">
                                        <span className="day-indicator">
                                          <span className="badge">Day {String(index + 1).padStart(2, '0')}</span>
                                          <strong>{displayDate(d)}</strong>
                                        </span>
                                        <span className="day-price"><strong>{money(currentService.price + car.surcharge + extras)}</strong></span>
                                      </span>
                                      <span className="card-footer"><span className="active-hint">
                                        {getTime(d)} · {car.name} {isAvail === false ? '· Unavailable' : ''}
                                      </span></span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="field-section-title extras-title">
                          Make it personal{' '}
                          <span>
                            {dates.length > 1
                              ? 'Optional additions · per day'
                              : 'Optional additions'}
                          </span>
                        </p>
                        <div className="extras">
                          {catalog.options.map((option) => (
                            <button
                              type="button"
                              key={option.id}
                              role="switch"
                              aria-checked={options.includes(option.id)}
                              className="extra-option"
                              onClick={() =>
                                setOptions((previous) =>
                                  previous.includes(option.id)
                                    ? previous.filter((id) => id !== option.id)
                                    : [...previous, option.id],
                                )
                              }
                            >
                              <span>
                                {option.name}
                                <small>{option.description}</small>
                              </span>
                              <span className="extra-price">
                                +{money(option.price)}
                              </span>
                              <span
                                className={`toggle ${options.includes(option.id) ? 'on' : ''}`}
                              >
                                <i />
                              </span>
                            </button>
                          ))}
                        </div>
                        {dates.length > 1 && (
                          <p className="field-note">
                            Selected extras apply to every day of your journey.
                          </p>
                        )}
                      </div>
                    )}
                    {step === 2 && (
                      <div className="contact-fields">
                        <p className="field-section-title">How may we address you?</p>
                        <p className="contact-intro">
                          Your details are used only to arrange your journey.
                        </p>
                        <label className="field">
                          <span>Full name</span>
                          <input
                            name="name"
                            autoComplete="name"
                            required
                            maxLength={100}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your full name"
                          />
                        </label>
                        <div className="contact-field-row">
                          <label className="field">
                            <span>Email address</span>
                            <input
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              maxLength={180}
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@example.com"
                            />
                          </label>
                          <label className="field">
                            <span>Phone number</span>
                            <input
                              name="phone"
                              type="tel"
                              autoComplete="tel"
                              required
                              pattern="\+?[0-9 \(\)\.\-]{7,40}"
                              maxLength={40}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+82 10 1234 5678"
                            />
                          </label>
                        </div>
                        <fieldset className="contact-methods">
                          <legend>How would you prefer to be contacted?</legend>
                          <div className="contact-method-grid">
                            {catalog.contactMethods.map((method) => (
                              <label
                                key={method.id}
                                className={
                                  contactMethod === method.id ? 'selected' : ''
                                }
                              >
                                <input
                                  type="radio"
                                  name="contact-method"
                                  value={method.id}
                                  checked={contactMethod === method.id}
                                  onChange={() => {
                                    setContactMethod(method.id)
                                    setMessengerContact('')
                                  }}
                                />
                                <span>{method.name}</span>
                              </label>
                            ))}
                          </div>
                          {!['email', 'phone'].includes(contactMethod) && (
                            <label className="field messenger-field">
                              <span>
                                {contactMethod === 'whatsapp'
                                  ? 'WhatsApp number'
                                  : `${catalog.contactMethods.find((method) => method.id === contactMethod)!.name} ID`}
                                {contactMethod === 'whatsapp' && (
                                  <small>optional</small>
                                )}
                              </span>
                              <input
                                name="messenger-contact"
                                aria-label={
                                  contactMethod === 'whatsapp'
                                    ? 'WhatsApp number'
                                    : `${catalog.contactMethods.find((method) => method.id === contactMethod)!.name} ID`
                                }
                                type={contactMethod === 'whatsapp' ? 'tel' : 'text'}
                                autoComplete={
                                  contactMethod === 'whatsapp' ? 'tel' : 'off'
                                }
                                required={contactMethod !== 'whatsapp'}
                                maxLength={contactMethod === 'whatsapp' ? 40 : 80}
                                pattern={
                                  contactMethod === 'whatsapp'
                                    ? '\\+?[0-9 \\(\\)\\.\\-]{7,40}'
                                    : '.*\\S.*'
                                }
                                value={messengerContact}
                                onChange={(event) =>
                                  setMessengerContact(event.target.value)
                                }
                                placeholder={
                                  contactMethod === 'whatsapp'
                                    ? phone || '+82 10 1234 5678'
                                    : 'Your messenger ID'
                                }
                                aria-describedby="messenger-help"
                              />
                              <small id="messenger-help" className="messenger-help">
                                {contactMethod === 'whatsapp'
                                  ? 'Leave blank to use the phone number above.'
                                  : 'Enter an ID we can use to find you on this app.'}
                              </small>
                            </label>
                          )}
                          <p className="messenger-help">
                            Your preference is saved with your request. Messaging is
                            not connected yet.
                          </p>
                        </fieldset>
                        <label className="consent">
                          <input
                            type="checkbox"
                            name="consent"
                            required
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          <span>
                            I understand this is a reservation request subject to
                            confirmation, and consent to my details being stored to
                            arrange this journey.
                          </span>
                        </label>
                        <button
                          type="button"
                          className="privacy-inline"
                          onClick={showPrivacy}
                        >
                          Read our reservation & privacy notice{' '}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {step >= 1 && (
                  <aside className="journey-summary">
                    <div className="summary-heading">
                      <span className="eyebrow">YOUR JOURNEY, AT A GLANCE</span>
                    </div>
                    {step === 1 && multiDay && dates.length > 1 && (
                      <div className="showroom-day-bar">
                        <div className="showroom-header-row">
                          <div className="showroom-title-group">
                            <span className="showroom-label">FLEET SHOWROOM</span>
                            <div className="showroom-date-info">
                              <strong>Day 0{activeDayIndex + 1}</strong>
                              <span className="showroom-dot">·</span>
                              <span>{displayDate(currentActiveDate)}</span>
                              <span className="showroom-time">({getTime(currentActiveDate)} KST)</span>
                            </div>
                          </div>
                          <div className="showroom-nav-arrows">
                            <button
                              type="button"
                              className="showroom-arrow-btn"
                              disabled={activeDayIndex <= 0}
                              onClick={() => {
                                if (activeDayIndex > 0) {
                                  setActiveDate(dates[activeDayIndex - 1])
                                }
                              }}
                              aria-label="Previous day"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <span className="showroom-page-counter">
                              {activeDayIndex + 1} / {dates.length}
                            </span>
                            <button
                              type="button"
                              className="showroom-arrow-btn"
                              disabled={activeDayIndex >= dates.length - 1}
                              onClick={() => {
                                if (activeDayIndex < dates.length - 1) {
                                  setActiveDate(dates[activeDayIndex + 1])
                                }
                              }}
                              aria-label="Next day"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="showroom-pills-row">
                          {dates.length > 4 && (
                            <button
                              type="button"
                              className="pills-scroll-btn left"
                              onClick={() => scrollPills(-120)}
                              aria-label="Scroll days left"
                            >
                              <ChevronLeft size={14} />
                            </button>
                          )}
                          <div className="showroom-day-pills" ref={pillsContainerRef}>
                            {dates.map((d, index) => (
                              <button
                                key={d}
                                type="button"
                                ref={currentActiveDate === d ? activePillRef : null}
                                className={`showroom-day-pill ${currentActiveDate === d ? 'active' : ''}`}
                                onClick={() => setActiveDate(d)}
                              >
                                Day 0{index + 1}
                              </button>
                            ))}
                          </div>
                          {dates.length > 4 && (
                            <button
                              type="button"
                              className="pills-scroll-btn right"
                              onClick={() => scrollPills(120)}
                              aria-label="Scroll days right"
                            >
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {step === 1 && (
                      <>
                        <div className="booking-glass-fleet-label">
                          <span>Select your vehicle</span>
                          <small>Click or swipe to explore</small>
                        </div>
                        <VehicleCarousel
                          value={activeVehicle}
                          onChange={changeVehicle}
                          availability={availability[currentActiveDate] || {}}
                        />
                      </>
                    )}
                    {step === 2 && (
                      <div className="summary-route-recap">
                        {journeys.map((day, index) => (
                          <div key={day.date}>
                            <span>Day {String(index + 1).padStart(2, '0')} · {displayDate(day.date)} · {day.time} KST</span>
                            <strong>{day.pickup || '—'} → {day.destination || '—'}</strong>
                            <small>{catalog.vehicles.find((item) => item.id === day.vehicle)?.name}</small>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="summary-lines">
                      <div>
                        <span>
                          <CalendarDays size={14} /> {displayDate(dates[0] || tomorrow())}
                        </span>
                        <span>{getTime(dates[0] || tomorrow())} KST</span>
                      </div>
                      {dates.length > 1 && (
                        <div>
                          <span>
                            {multiDayMode === 'range'
                              ? `Through ${displayDate(dates[dates.length - 1])}`
                              : `${dates.length} scheduled dates`}
                          </span>
                          <span>{dates.length} days</span>
                        </div>
                      )}
                      {dates.length > 1 && (
                        <div className="summary-daily-vehicles">
                          {journeys.map((day, index) => {
                            const v = catalog.vehicles.find(
                              (veh) => veh.id === day.vehicle,
                            )!
                            const dayTotal =
                              currentService.price + v.surcharge + extras
                            return (
                              <div key={day.date}>
                                <span>
                                  Day {String(index + 1).padStart(2, '0')} · {displayDate(day.date)} ({day.time})
                                </span>
                                <span>
                                  {v.name} · {v.quoteRequired ? 'Quote' : money(dayTotal)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div>
                        <span>
                          <Car size={14} /> {currentService.name} ({currentService.duration}h)
                          {dates.length > 1 ? ` × ${dates.length} days` : ''}
                        </span>
                        <span>
                          {quoteRequired
                            ? 'Quote on request'
                            : money(currentService.price * dates.length)}
                        </span>
                      </div>
                      {vehicleSurcharges > 0 && (
                        <div>
                          <span>Vehicle upgrades</span>
                          <span>{money(vehicleSurcharges)}</span>
                        </div>
                      )}
                      {catalog.options
                        .filter((o) => options.includes(o.id))
                        .map((o) => (
                          <div key={o.id}>
                            <span>
                              {o.name}
                              {dates.length > 1 ? ` × ${dates.length}` : ''}
                            </span>
                            <span>{money(o.price * dates.length)}</span>
                          </div>
                        ))}
                    </div>
                    <div className="summary-total">
                      <div>
                        <span>Estimated total</span>
                        <small className="tax-notice">
                          KRW · TAX excluded · approx. {moneyUsd(total, usdRate)} USD
                        </small>
                      </div>
                      <strong className={quoteRequired ? 'quote-on-request' : ''}>
                        {quoteRequired ? 'Quote on request' : money(total)}
                      </strong>
                    </div>
                    {quoteRequired && (
                      <p className="quote-note">
                        This journey needs a tailored quote. TAX is not included.
                      </p>
                    )}
                    <p className="availability-note" aria-live="polite">
                      {checking ? (
                        <>
                          <LoaderCircle size={14} className="spin" /> Checking your{' '}
                          {dates.length > 1 ? 'dates…' : 'date…'}
                        </>
                      ) : unavailableDay ? (
                        <>
                          <X size={14} />{' '}
                          {dates.length > 1
                            ? `Vehicle unavailable on ${displayDate(unavailableDay.date)}`
                            : 'Choose another vehicle or time'}
                        </>
                      ) : allAvailable ? (
                        <>
                          <Check size={14} />{' '}
                          {dates.length > 1
                            ? 'All daily slots open for a request'
                            : 'Time slot open for a request'}
                        </>
                      ) : (
                        <>
                          <Clock3 size={14} /> Availability check required
                        </>
                      )}
                    </p>
                    {error && (
                      <div className="form-error" role="alert">
                        {error}
                        <button
                          type="button"
                          onClick={() => setAvailabilityVersion((v) => v + 1)}
                          aria-label="Recheck availability"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    <p className="privacy-aside-note">
                      <LockKeyhole size={14} aria-hidden="true" /> Your details stay private.
                    </p>
                  </aside>
                )}
              </form>
            ) : null}
          </div>
        </div>
        {glassOpen && !result && (
          <div className="booking-outer-actions">
            {error && step === 0 && (
              <div className="form-error booking-outer-error" role="alert">
                {error}
                <button
                  type="button"
                  onClick={() => setAvailabilityVersion((v) => v + 1)}
                  aria-label="Recheck availability"
                >
                  Retry
                </button>
              </div>
            )}
            <div className="booking-outer-buttons">
              {step > 0 && (
                <button
                  type="button"
                  className="booking-back-btn"
                  disabled={sending}
                  onClick={() => moveStep(step - 1)}
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
              )}
              <ReservationButton
                type="submit"
                form="booking-request-form"
                className={step === 2 ? 'booking-submit' : ''}
                disabled={
                  sending ||
                  (step > 0 && checking) ||
                  (step === 2 && !allAvailable)
                }
              >
                {sending ? (
                  <>
                    Saving your request{' '}
                    <LoaderCircle size={16} className="spin" />
                  </>
                ) : step === 0 ? (
                  <>
                    Continue to Select Vehicle <ArrowRight size={17} />
                  </>
                ) : step === 1 ? (
                  <>
                    Continue to Your Details <ArrowRight size={17} />
                  </>
                ) : (
                  <>
                    Request your journey <ArrowUpRight size={17} />
                  </>
                )}
              </ReservationButton>
            </div>
            {step >= 1 && (
              <p className="no-payment">
                No upfront payment required · Subject to confirmation
              </p>
            )}
          </div>
        )}
      </div>
      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} CHAUFFEUR. A more considered way to
          travel.
        </span>
        <button onClick={showPrivacy}>
          Privacy & reservations <Plus size={12} />
        </button>
        <span>
          SEOUL, SOUTH KOREA <span className="live-dot" />
        </span>
      </footer>
    </section>
  )
}

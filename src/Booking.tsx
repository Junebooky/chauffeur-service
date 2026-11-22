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
  Plus,
  X,
} from 'lucide-react'
import catalog from './catalog.json'
import AddressSearch from './AddressSearch'
import type { Place } from './AddressSearch'
import GlassSelect from './GlassSelect'
import GlassTimeInput from './GlassTimeInput'
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
    stops?: string[]
  }[]
  date: string
  time: string
  vehicle: string
  service: string
}
type DayStop = { location: string; place: Place | null }
type DayRoute = {
  stops: DayStop[]
  pickup: string
  destination: string
  pickupPlace: Place | null
  destinationPlace: Place | null
  flight: string
}

const emptyDayRoute = (): DayRoute => ({
  pickup: '', destination: '', pickupPlace: null, destinationPlace: null,
  flight: '', stops: [],
})
const isRouteComplete = (route: DayRoute) =>
  Boolean(route.pickupPlace && route.destinationPlace &&
    route.pickupPlace.id !== route.destinationPlace.id &&
    route.stops.every((stop) => stop.location.trim() && stop.place))

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
  const [dailyScheduleOpen, setDailyScheduleOpen] = useState(false)
  const [dailyScheduleMode, setDailyScheduleMode] = useState<'same' | 'custom'>('custom')
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
  const [usePhoneForMessenger, setUsePhoneForMessenger] = useState(false)
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
  const currentService = catalog.services.find((s) => s.id === service)!
  // One field works for international names and keeps the existing API stable.
  const nameReady = name.trim().length >= 2
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const phoneReady = /^\+?[\d\s().-]{7,40}$/.test(phone.trim()) &&
    phone.replace(/\D/g, '').length >= 7
  const usesMessengerPhone = ['line', 'kakao', 'wechat'].includes(contactMethod) && usePhoneForMessenger
  const submittedMessengerContact = usesMessengerPhone ? phone.trim() : messengerContact.trim()
  const contactApp = catalog.contactMethods.find((method) => method.id === contactMethod)?.name ?? 'Messenger'

  const shortVehicleName = (vehicleId: string) => {
    switch (vehicleId) {
      case 'staria': return 'Staria'
      case 'carnival_limousine': return 'Carnival'
      case 'g90': return 'Genesis G90'
      case 'sprinter_319':
      case 'sprinter_519': return 'Sprinter'
      default: return catalog.vehicles.find((item) => item.id === vehicleId)?.name ?? 'Vehicle'
    }
  }
  const compactDate = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  const currentActiveDate = dates.includes(activeDate)
    ? activeDate
    : dates[0] || tomorrow()

  const scheduleActiveDate = editingDate && dates.includes(editingDate)
    ? editingDate : (dates[0] || tomorrow())

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

  // A multiple-day route belongs to its date; routes are never shared implicitly.
  const defaultRoute: DayRoute = {
    pickup, pickupPlace, destination, destinationPlace, flight, stops: [],
  }
  const getRoute = (day: string): DayRoute =>
    multiDay ? (routesByDate[day] ?? emptyDayRoute()) : defaultRoute
  const setRouteForDate = (day: string, patch: Partial<DayRoute>) => {
    setRoutesByDate((previous) => ({
      ...previous,
      [day]: { ...(previous[day] ?? emptyDayRoute()), ...patch },
    }))
  }
  const applyScheduleToAll = () => {
    const route = getRoute(scheduleActiveDate)
    if (!isRouteComplete(route)) {
      setError('Complete this day\'s pick-up and schedule before copying it.')
      setConfirmCopySchedule(false)
      return
    }
    const time = getTime(scheduleActiveDate)
    setRoutesByDate((previous) => ({
      ...previous,
      ...Object.fromEntries(dates.map((day) => [day, {
        ...route, stops: route.stops.map((stop) => ({ ...stop })),
      }])),
    }))
    applyTimeToAll(time)
    setConfirmCopySchedule(false)
    setError('')
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
    const validTimeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!dates.every((d) => validTimeRe.test(getTime(d)))) return
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
    if (target > step && step === 0) {
      if (multiDay && dates.length < 2) {
        setError('Choose at least two dates, then continue.')
        return
      }
      if (multiDay && !dailyScheduleOpen) {
        setError('')
        setEditingDate(dates[0])
        setDailyScheduleMode('custom')
        setDailyScheduleOpen(true)
        requestAnimationFrame(() => heading.current?.focus())
        return
      }
      const invalid = journeys.find((day) => !isRouteComplete(day))
      if (invalid) {
        const message = !invalid.pickupPlace || !invalid.destinationPlace ||
          invalid.pickupPlace.id === invalid.destinationPlace.id
          ? 'Choose different pick-up and final drop-off locations'
          : 'Select a valid location for every scheduled stop'
        setError(`${message} for ${displayDate(invalid.date)}.`)
        if (multiDay) setEditingDate(invalid.date)
        return
      }
    }
    if (target > step && !form.current?.reportValidity()) return
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
          pickup: journeys[0].pickup,
          destination: journeys[0].destination,
          pickupPlace: journeys[0].pickupPlace,
          destinationPlace: journeys[0].destinationPlace,
          flight: journeys[0].flight,
          service,
          vehicle: journeys[0].vehicle,
          journeys,
          options,
          name,
          email,
          phone,
          contactMethod,
          messengerContact: submittedMessengerContact,
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
          `LOCATION:${escape(day.pickup)}`,
          `DESCRIPTION:${escape([
            day.stops?.length ? `Stops: ${day.stops.join(' → ')}` : '',
            `Final drop-off: ${day.destination}`,
            'Reservation request only. This journey has not been confirmed. All prices exclude TAX.',
          ].filter(Boolean).join('\\n'))}`,
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
          className={`booking-glass-surface ${step === 0 && glassOpen && !result ? (dailyScheduleOpen ? 'is-daily-schedule-step' : 'is-schedule-step') : ''}`}
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
                      <small> · {[day.pickup, ...(day.stops || []), day.destination].join(' → ')}</small>
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
                      setDailyScheduleOpen(false)
                      setDailyScheduleMode('same')
                      setMultiDay(false)
                      setRoutesByDate({})
                      setTimesByDate({})
                      setVehiclesByDate({})
                      setVehicleMode('same')
                      setEditingDate(null)
                      setConfirmCopySchedule(false)
                      setDates([tomorrow()])
                      setGlassOpen(false)
                      setName('')
                      setEmail('')
                      setPhone('')
                      setContactMethod('email')
                      setMessengerContact('')
                      setUsePhoneForMessenger(false)
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
                className={`booking-panel ${step === 0 ? (dailyScheduleOpen ? 'is-daily-schedule' : 'is-schedule-only') : 'is-split-view'}`}
              >
                <div className="booking-main">
                  <div className="booking-fields" key={step}>
                    <h3 className="sr-only" tabIndex={-1} ref={heading}>
                      {step === 0 && dailyScheduleOpen
                        ? 'Review and customize your daily schedule'
                        : [
                            'Select your schedule and route',
                            'Choose your vehicle and options',
                            'Enter your contact details',
                          ][step]}
                    </h3>
                    {step === 0 && !dailyScheduleOpen && (
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
                                const first = dates[0] || tomorrow()
                                const firstRoute = getRoute(first)
                                setPickup(firstRoute.pickup)
                                setPickupPlace(firstRoute.pickupPlace)
                                setDestination(firstRoute.destination)
                                setDestinationPlace(firstRoute.destinationPlace)
                                setFlight(firstRoute.flight)
                                setDefaultTime(getTime(first))
                                setMultiDay(false)
                                setDates([first])
                                setActiveDate(first)
                                setEditingDate(null)
                                setRoutesByDate({})
                                setTimesByDate({})
                                setVehicleMode('same')
                                setDailyScheduleOpen(false)
                                setDailyScheduleMode('custom')
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
                                const first = dates[0] || tomorrow()
                                if (pickupPlace || destinationPlace || flight) {
                                  setRoutesByDate((previous) => ({
                                    ...previous, [first]: { ...defaultRoute },
                                  }))
                                }
                                setTimesByDate((previous) => ({
                                  ...previous, [first]: getTime(first),
                                }))
                                setMultiDay(true)
                                setDailyScheduleOpen(false)
                                // Each new date has its own itinerary, not a shared route.
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
                              <p className="field-note booking-daily-next-note">
                                {dates.length > 1
                                  ? 'Next, set the pick-up and schedule for each date.'
                                  : 'Select at least two dates in the calendar to continue.'}
                              </p>
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
                          {multiDay ? (
                            <div className="booking-daily-intro">
                              <span className="field-section-title">A schedule for every day</span>
                              <p className="field-note">Each date has its own pick-up, time, stops and final drop-off. Set these in the next step.</p>
                              <p className="field-note">You can copy any finished day's itinerary when needed.</p>
                            </div>
                          ) : (
                            <>
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
                            <span className="booking-time-label">
                              <span className="booking-time-heading"><Clock3 size={15} aria-hidden="true" /> Pick-up Time</span>
                              <small className="booking-timezone">Korea time (KST, UTC+9)</small>
                            </span>
                            <GlassTimeInput
                              ariaLabel="Pick-up Time"
                              name="pickup-time"
                              value={getTime(dates[0] || tomorrow())}
                              onChange={(t) => {
                                setDefaultTime(t)
                                setTimeForDate(dates[0] || tomorrow(), t)
                              }}
                              options={timeOptions}
                            />
                          </div>
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
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {step === 0 && dailyScheduleOpen && (
                      <section className="booking-daily-screen" aria-label="Daily Schedule">
                        <div className="day-mode-segmented booking-daily-choice" role="radiogroup" aria-label="Daily schedule mode">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={dailyScheduleMode === 'same'}
                            className={`day-mode-pill ${dailyScheduleMode === 'same' ? 'active' : ''}`}
                            onClick={() => setDailyScheduleMode('same')}
                          >
                            Same schedule for all days
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={dailyScheduleMode === 'custom'}
                            className={`day-mode-pill ${dailyScheduleMode === 'custom' ? 'active' : ''}`}
                            onClick={() => {
                              setDailyScheduleMode('custom')
                              setEditingDate((previous) =>
                                previous && dates.includes(previous) ? previous : dates[0],
                              )
                            }}
                          >
                            Customize individual days
                          </button>
                        </div>
                        {dailyScheduleMode === 'same' ? (
                          <div className="booking-daily-same">
                            <p className="field-note">
                              Your pick-up, destination and time apply to every day.
                              You can go straight to vehicle selection.
                            </p>
                            <div className="booking-daily-days">
                              {dates.map((day, index) => (
                                <div className="daily-journey-card" key={day}>
                                  <div className="card-top">
                                    <span className="day-indicator">
                                      <span className="badge">Day {String(index + 1).padStart(2, '0')}</span>
                                      <strong>{displayDate(day)}</strong>
                                    </span>
                                    <span className="active-hint">Shared</span>
                                  </div>
                                  <p className="field-note">
                                    {defaultTime} · {pickup || 'Pick-up not set'} → {destination || 'Destination not set'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="booking-daily-layout">
                            <div className="booking-daily-day-list" role="group" aria-label="Select a date to customize">
                              {dates.map((day, index) => {
                                const customized = Boolean(routesByDate[day]) ||
                                  (timesByDate[day] !== undefined && timesByDate[day] !== defaultTime)
                                const route = getRoute(day)
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    className={`daily-journey-card ${scheduleActiveDate === day ? 'active-day-card' : ''}`}
                                    aria-pressed={scheduleActiveDate === day}
                                    onClick={() => setEditingDate(day)}
                                  >
                                    <span className="card-top">
                                      <span className="day-indicator">
                                        <span className="badge">Day {String(index + 1).padStart(2, '0')}</span>
                                        <strong>{displayDate(day)}</strong>
                                      </span>
                                      <span className="active-hint">
                                        {customized ? 'Customized' : 'Shared'}
                                      </span>
                                    </span>
                                    <span className="field-note">
                                      {getTime(day)} · {route.pickup || 'Pick-up'} → {route.destination || 'Destination'}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                            <div className="booking-daily-editor" key={scheduleActiveDate}>
                              <div className="daily-times-header">
                                <span className="field-label">
                                  <CalendarDays size={14} /> {displayDate(scheduleActiveDate)}
                                </span>
                                <button
                                  type="button"
                                  className="apply-all-btn"
                                  onClick={() => {
                                    setRoutesByDate((previous) => {
                                      const next = { ...previous }
                                      delete next[scheduleActiveDate]
                                      return next
                                    })
                                    setTimesByDate((previous) => {
                                      const next = { ...previous }
                                      delete next[scheduleActiveDate]
                                      return next
                                    })
                                  }}
                                >
                                  Use shared
                                </button>
                              </div>
                              <AddressSearch
                                name={`pickup-${scheduleActiveDate}`}
                                label="Pick-up Location"
                                placeholder="Enter pick-up location"
                                value={getRoute(scheduleActiveDate).pickup}
                                place={getRoute(scheduleActiveDate).pickupPlace}
                                rightIcon="nav"
                                onChange={(value, place) => setRouteForDate(scheduleActiveDate, {
                                  pickup: value, pickupPlace: place,
                                })}
                              />
                              <AddressSearch
                                name={`destination-${scheduleActiveDate}`}
                                label="Destination"
                                placeholder="Enter destination"
                                value={getRoute(scheduleActiveDate).destination}
                                place={getRoute(scheduleActiveDate).destinationPlace}
                                rightIcon="nav"
                                onChange={(value, place) => setRouteForDate(scheduleActiveDate, {
                                  destination: value, destinationPlace: place,
                                })}
                              />
                              <div className="field time-field">
                                <span className="booking-time-label">
                                  <span className="booking-time-heading"><Clock3 size={15} aria-hidden="true" /> Pick-up Time</span>
                                  <small className="booking-timezone">Korea time (KST, UTC+9)</small>
                                </span>
                                <GlassTimeInput
                                  ariaLabel={`Pick-up time for ${displayDate(scheduleActiveDate)}`}
                                  value={getTime(scheduleActiveDate)}
                                  onChange={(time) => setTimeForDate(scheduleActiveDate, time)}
                                  options={timeOptions}
                                />
                              </div>
                              {service === 'airport' && (
                                <label className="field">
                                  <span>Flight number <small>optional</small></span>
                                  <input
                                    name={`flight-${scheduleActiveDate}`}
                                    maxLength={30}
                                    value={getRoute(scheduleActiveDate).flight}
                                    onChange={(event) => setRouteForDate(scheduleActiveDate, { flight: event.target.value })}
                                    placeholder="e.g. KE 902"
                                  />
                                </label>
                              )}
                              <div className="booking-daily-copy">
                                {confirmCopySchedule ? (
                                  <div className="selected-dates-summary">
                                    <span>Replace the other days with Day 1's route and time?</span>
                                    <button type="button" onClick={applyScheduleToAll}>Confirm</button>
                                    <button type="button" onClick={() => setConfirmCopySchedule(false)}>Cancel</button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="apply-all-btn"
                                    onClick={() => setConfirmCopySchedule(true)}
                                  >
                                    Copy Day 1 to all
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </section>
                    )}
                    {step === 1 && (
                      <div className="preferences-fields">
                        {multiDay && dates.length > 1 && (
                          <div className="daily-schedule-configuration">
                            <div className="daily-schedule-header">
                              <div>
                                <strong>How would you like to arrange your vehicles?</strong>
                                <small>Choose one model for the whole trip, or a different one for each date.</small>
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
                              <p className="field-note">
                                Your showroom selection applies to all {dates.length} dates.
                              </p>
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
                                          <strong title={displayDate(d)}>{compactDate(d)}</strong>
                                        </span>
                                        <span className="day-price"><strong>{money(currentService.price + car.surcharge + extras)}</strong></span>
                                      </span>
                                      <span className="card-footer"><span className="active-hint">
                                        {getTime(d)} · {car.name} {isAvail === false ? '· Unavailable' : ''}
                                        <small>{getRoute(d).pickup || 'Pick-up'} → {getRoute(d).destination || 'Destination'}</small>
                                      </span></span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="field-section-title extras-title">
                          {dates.length > 1
                            ? 'Optional additions · per day'
                            : 'Optional additions'}
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
                      </div>
                    )}
                    {step === 2 && (
                      <div className="contact-fields">
                        <label className="field">
                          <span>Full name</span>
                          <div className="contact-input-wrap">
                            <input
                              name="name"
                              autoComplete="name"
                              required
                              maxLength={100}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              placeholder="Your full name"
                            />
                            {nameReady && <Check size={16} className="contact-input-valid" aria-hidden="true" />}
                          </div>
                        </label>
                        <div className="contact-field-row">
                          <label className="field">
                            <span>Email address</span>
                            <div className="contact-input-wrap">
                              <input
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                maxLength={180}
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="you@example.com"
                              />
                              {emailReady && <Check size={16} className="contact-input-valid" aria-hidden="true" />}
                            </div>
                          </label>
                          <label className="field">
                            <span>Phone number</span>
                            <div className="contact-input-wrap">
                              <input
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                required
                                pattern="\+?[0-9 \(\)\.\-]{7,40}"
                                maxLength={40}
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                placeholder="+82 10 1234 5678"
                              />
                              {phoneReady && <Check size={16} className="contact-input-valid" aria-hidden="true" />}
                            </div>
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
                                    setUsePhoneForMessenger(false)
                                  }}
                                />
                                <span>{method.name}</span>
                              </label>
                            ))}
                          </div>
                          {!['email', 'phone'].includes(contactMethod) && (
                            <div className="messenger-preference">
                              {['line', 'kakao', 'wechat'].includes(contactMethod) && (
                                <label className="messenger-use-phone">
                                  <input
                                    type="checkbox"
                                    name="use-phone-for-messenger"
                                    checked={usePhoneForMessenger}
                                    onChange={(event) => setUsePhoneForMessenger(event.target.checked)}
                                  />
                                  <span>Use the phone number above for {contactApp}</span>
                                </label>
                              )}
                              {usesMessengerPhone ? (
                                <p className="messenger-help" role="status">
                                  {phone || 'Your phone number'} will be used for {contactApp}.
                                  Make sure people can contact you on that app using this number.
                                </p>
                              ) : (
                                <label className="field messenger-field">
                                  <span>
                                    {contactMethod === 'whatsapp'
                                      ? 'WhatsApp number'
                                      : `${contactApp} ID or phone number`}
                                    {contactMethod === 'whatsapp' && <small>optional</small>}
                                  </span>
                                  <div className="contact-input-wrap">
                                    <input
                                      name="messenger-contact"
                                      aria-label={contactMethod === 'whatsapp'
                                        ? 'WhatsApp number'
                                        : `${contactApp} ID or phone number`}
                                      type={contactMethod === 'whatsapp' ? 'tel' : 'text'}
                                      autoComplete={contactMethod === 'whatsapp' ? 'tel' : 'off'}
                                      required={contactMethod !== 'whatsapp'}
                                      maxLength={contactMethod === 'whatsapp' ? 40 : 80}
                                      pattern={contactMethod === 'whatsapp'
                                        ? '\\+?[0-9 \\(\\)\\.\\-]{7,40}' : '.*\\S.*'}
                                      value={messengerContact}
                                      onChange={(event) => setMessengerContact(event.target.value)}
                                      placeholder={contactMethod === 'whatsapp'
                                        ? phone || '+82 10 1234 5678'
                                        : 'Messenger ID or linked phone number'}
                                      aria-describedby="messenger-help"
                                    />
                                    {messengerContact.trim().length > 1 &&
                                      <Check size={16} className="contact-input-valid" aria-hidden="true" />}
                                  </div>
                                  <small id="messenger-help" className="messenger-help">
                                    {contactMethod === 'whatsapp'
                                      ? 'Leave blank to use your phone number above.'
                                      : 'Use an ID or a phone number that others can reach on this app.'}
                                  </small>
                                </label>
                              )}
                            </div>
                          )}
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
                  <aside className={`journey-summary ${step === 2 ? 'is-details-summary' : ''}`}>
                    {step === 1 && (
                      <VehicleCarousel
                        value={activeVehicle}
                        onChange={changeVehicle}
                        availability={availability[currentActiveDate] || {}}
                        ariaLabel={multiDay && vehicleMode === 'daily'
                          ? `Choose a vehicle for Day ${dates.indexOf(currentActiveDate) + 1}, ${displayDate(currentActiveDate)}`
                          : 'Interactive vehicle selection'}
                      />
                    )}
                    {step === 2 && (
                      <div className="summary-route-recap" aria-label="Your daily itinerary">
                        {journeys.map((day, index) => {
                          const vehicleName = catalog.vehicles.find((item) => item.id === day.vehicle)?.name ?? 'Vehicle'
                          return (
                            <div key={day.date} className="summary-journey-item">
                              <div className="summary-journey-header">
                                <span className="summary-journey-date">
                                  Day {String(index + 1).padStart(2, '0')} · {compactDate(day.date)} · {day.time} KST
                                </span>
                                <span className="summary-journey-vehicle" title={vehicleName}>
                                  {shortVehicleName(day.vehicle)}
                                </span>
                              </div>
                              <p className="summary-journey-route" title={[day.pickup, ...day.stops.map((stop) => stop.location), day.destination].filter(Boolean).join(' → ')}>
                                {[day.pickup, ...day.stops.map((stop) => stop.location), day.destination].filter(Boolean).join(' → ')}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="summary-lines">
                      {step !== 2 && (
                        <div>
                          <span>
                            <CalendarDays size={14} /> {displayDate(dates[0] || tomorrow())}
                          </span>
                          <span>{getTime(dates[0] || tomorrow())} KST</span>
                        </div>
                      )}
                      {step !== 2 && dates.length > 1 && (
                        <div>
                          <span>
                            {multiDayMode === 'range'
                              ? `Through ${displayDate(dates[dates.length - 1])}`
                              : `${dates.length} scheduled dates`}
                          </span>
                          <span>{dates.length} days</span>
                        </div>
                      )}
                      {step === 1 && dates.length > 1 && (
                        <div className="summary-daily-vehicles booking-vehicle-day-summary">
                          {journeys.map((day, index) => {
                            const v = catalog.vehicles.find(
                              (veh) => veh.id === day.vehicle,
                            )!
                            const dayTotal =
                              currentService.price + v.surcharge + extras
                            return (
                              <div key={day.date}>
                                <span className="booking-vehicle-day-date" title={displayDate(day.date)}>
                                  Day {String(index + 1).padStart(2, '0')} · {compactDate(day.date)} · {day.time}
                                </span>
                                <span className="booking-vehicle-day-price">
                                  <span title={v.name}>{shortVehicleName(day.vehicle)}</span> · {v.quoteRequired ? 'Quote' : money(dayTotal)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div>
                        <span>
                          {step !== 2 && <Car size={14} />} {currentService.name} ({currentService.duration}h)
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
            <div className={`booking-outer-buttons ${step === 2 ? 'is-details-actions' : ''}`}>
              {(step > 0 || (step === 0 && dailyScheduleOpen)) && (
                <ReservationButton
                  type="button"
                  className="booking-back-btn"
                  disabled={sending}
                  onClick={() => {
                    if (step === 0) {
                      setDailyScheduleOpen(false)
                      setError('')
                    } else {
                      moveStep(step - 1)
                    }
                  }}
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </ReservationButton>
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
                    {multiDay && !dailyScheduleOpen ? 'Continue to Daily Schedule' : 'Continue to Select Vehicle'} <ArrowRight size={17} />
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

import { curatedLabels } from './i18n/curated-places.mjs'
import { useLocale } from './i18n/provider'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  FileDown,
  Image,
  Mail,
  Phone,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  MessageCircleMore,
  Plus,
  X,
} from 'lucide-react'
import catalog from './catalog.json'
import AddressSearch from './AddressSearch'
import type { Place } from './AddressSearch'
import GlassSelect from './GlassSelect'
import GlassTimeInput from './GlassTimeInput'
import VehicleCarousel from './VehicleCarousel'
import { exportItineraryPdf, exportItineraryPng } from './itineraryExport'
import { composeEmail, customQuoteEmail } from './contact'
import { LiquidGlass } from 'simple-liquid-glass'
import { resetGlassPointer, trackGlassPointer } from './liquidGlass'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import ReservationButton from './components/ui/ReservationButton'
import BookingCtaBeam from './components/ui/BookingCtaBeam'
import {
  trackBookingEmailFallback,
  trackBookingLead,
  trackBookingOpen,
  trackBookingStep,
  trackContactClick,
  trackItineraryExport,
} from './analytics.mjs'
import {
  DEFAULT_USD_RATE,
  moneyUsd,
  addDays,
  displayDate as englishDisplayDate,
  journeyDates,
  money,
  seoulDate,
  tomorrow,
} from './utils'

const CONTACT_METHOD_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  line: MessageSquare,
  kakao: MessagesSquare,
  wechat: MessageCircleMore,
}

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  return `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
})

type Result = {
  preferredLocale?: 'en' | 'ko'
  reference: string
  status: string
  total: number | null
  quoteRequired: boolean
  journeys: {
    date: string
    time: string
    vehicle: string
    service: string
    duration?: number
    total: number | null
    pickup: string
    destination: string
    pickupName?: string
    destinationName?: string
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
  Boolean(
    route.pickupPlace &&
    route.destinationPlace &&
    route.stops.every((stop) => stop.location.trim() && stop.place),
  )

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
  const { locale, t } = useLocale()
  const displayDate = (date: string) => locale === 'ko' ? date.replace(/-/g, '.') : englishDisplayDate(date)
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
          {new Date(`${viewMonth}-01T12:00:00`).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
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
            {t(day)}
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
  const { locale, t } = useLocale()
  const displayDate = (date: string) => locale === 'ko' ? date.replace(/-/g, '.') : englishDisplayDate(date)
  const [usdRate, setUsdRate] = useState<number>(initialUsdRate)
  const [step, setStep] = useState(0)
  const [glassOpen, setGlassOpen] = useState(false)
  const [multiDay, setMultiDay] = useState(false)
  const [dailyScheduleOpen, setDailyScheduleOpen] = useState(false)
  const [multiDayMode, setMultiDayMode] = useState<'range' | 'discrete'>('range')
  const [dates, setDates] = useState<string[]>(() => [tomorrow()])
  const [timesByDate, setTimesByDate] = useState<Record<string, string>>({})
  const [servicesByDate, setServicesByDate] = useState<Record<string, string>>({})
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
  const [verifiedAvailabilityKey, setVerifiedAvailabilityKey] = useState('')
  const [bookingSubmissionReady, setBookingSubmissionReady] = useState(false)
  const [availabilityIssue, setAvailabilityIssue] = useState<{
    kind: 'invalid' | 'unreachable'
    message: string
  } | null>(null)
  const [emailDraftOpened, setEmailDraftOpened] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [exportError, setExportError] = useState('')
  const [availabilityVersion, setAvailabilityVersion] = useState(0)
  const form = useRef<HTMLFormElement>(null)
  const idempotency = useRef(crypto.randomUUID())
  const heading = useRef<HTMLHeadingElement>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)
  const glassTrigger = useRef<HTMLButtonElement>(null)
  const refractionBackdrop = useRef<HTMLDivElement>(null)
  const currentService = catalog.services.find((s) => s.id === service)!
  const bookableServices = catalog.services
    .filter((item) => item.id === 'airport' || item.id === 'day')
    .map((item) => ({
      value: item.id,
      label: item.name,
      meta: item.unit,
      labelClassName: `service-tone service-tone-${item.id}`,
    }))
  // One field works for international names and keeps the existing API stable.
  const nameReady = name.trim().length >= 2
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const phoneReady = /^\+?[\d\s().-]{7,40}$/.test(phone.trim()) &&
    phone.replace(/\D/g, '').length >= 7
  const usesMessengerPhone = ['whatsapp', 'line', 'kakao', 'wechat'].includes(contactMethod) && usePhoneForMessenger
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
    new Date(`${value}T12:00:00`).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', { day: 'numeric', month: 'short' })

  const currentActiveDate = dates.includes(activeDate)
    ? activeDate
    : dates[0] || tomorrow()

  const scheduleActiveDate = editingDate && dates.includes(editingDate)
    ? editingDate : (dates[0] || tomorrow())

  const getService = (d: string) =>
    multiDay ? (servicesByDate[d] || service) : service
  const setServiceForDate = (d: string, serviceId: string) => {
    setServicesByDate((previous) => ({ ...previous, [d]: serviceId }))
  }
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

  const activeVehicle = getVehicle(currentActiveDate)
  const changeVehicle = (vId: string) => {
    // Do not leave a stale unavailable warning visible after changing vehicle.
    setError((previous) =>
      previous.startsWith('Please choose another vehicle or time') ? '' : previous)
    if (!multiDay || vehicleMode === 'same') {
      // Keep any per-day vehicle selections intact if the guest toggles modes.
      setVehicle(vId)
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
    const dailyService = getService(scheduleActiveDate)
    setServicesByDate((previous) => ({
      ...previous,
      ...Object.fromEntries(dates.map((day) => [day, dailyService])),
    }))
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

  // Session-only address reuse: prioritize the first day's confirmed places,
  // then later days. Never cache unresolved text or persist private trip data.
  const recentTripPlaces: Place[] = []
  if (multiDay) {
    const used = new Set<string>()
    dates.forEach((day) => {
      const route = getRoute(day)
      const selections = [
        route.pickupPlace,
        route.destinationPlace,
        ...route.stops.map((stop) => stop.place),
      ]
      selections.forEach((selected) => {
        if (selected && !used.has(selected.id)) {
          used.add(selected.id)
          recentTripPlaces.push(selected)
        }
      })
    })
  }

  const journeys = dates.map((day) => ({
    date: day,
    time: getTime(day),
    vehicle: getVehicle(day),
    service: getService(day),
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
  const upgradedVehicleCounts = new Map<string, number>()
  for (const day of journeys) {
    const v = catalog.vehicles.find((item) => item.id === day.vehicle)
    if (v && v.surcharge > 0) {
      upgradedVehicleCounts.set(v.name, (upgradedVehicleCounts.get(v.name) ?? 0) + 1)
    }
  }
  const upgradedVehicleSummary = Array.from(upgradedVehicleCounts.entries())
    .map(([label, count]) => (count > 1 ? `${label} × ${count}` : label))
    .join(', ')

  const serviceBaseTotal = journeys.reduce((sum, day) =>
    sum + (catalog.services.find((item) => item.id === day.service)?.price ?? 0), 0)
  const total = journeys.reduce((sum, day) => {
    const v = catalog.vehicles.find((veh) => veh.id === day.vehicle)
    const selectedService = catalog.services.find((item) => item.id === day.service)
    return sum + (selectedService?.price ?? 0) + (v?.surcharge || 0) + extras
  }, 0)
  const mixedServices = new Set(journeys.map((day) => day.service)).size > 1
  const summaryService = catalog.services.find((item) => item.id === journeys[0]?.service) ?? currentService

  const datesKey = dates.join(',')
  const timesKey = dates.map((d) => getTime(d)).join(',')
  const servicesKey = dates.map((d) => getService(d)).join(',')
  const availabilityKey = [datesKey, timesKey, servicesKey].join('|')
  // Results are valid only for their exact date/time/service inputs; a former
  // response must never be used for a newly edited single-day itinerary.
  const availabilityCurrent = verifiedAvailabilityKey === availabilityKey
  const allAvailable =
    availabilityCurrent && journeys.length > 0 &&
    journeys.every((day) => availability[day.date]?.[day.vehicle] !== undefined)

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
    setServicesByDate(prune)
    setVehiclesByDate(prune)
    setEditingDate((previous) => previous && !present.has(previous) ? null : previous)
  }, [datesKey])

  useEffect(() => {
    const validTimeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!dates.every((d) => validTimeRe.test(getTime(d)))) {
      setAvailability({})
      setBookingSubmissionReady(false)
      setAvailabilityIssue({
        kind: 'invalid',
        message: 'Choose a valid pickup time for every date.',
      })
      setChecking(false)
      return
    }
    const controller = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 10000)
    setChecking(true)
    setAvailability({})
    setVerifiedAvailabilityKey('')
    setBookingSubmissionReady(false)
    setAvailabilityIssue(null)
    setEmailDraftOpened(false)
    const params = new URLSearchParams()
    params.set('service', getService(dates[0] || tomorrow()))
    params.set('dates', dates.join(','))
    params.set('times', dates.map((d) => getTime(d)).join(','))
    params.set('services', servicesKey)
    params.set('date', dates[0] || tomorrow())
    params.set('time', getTime(dates[0] || tomorrow()))
    if (dates.length > 1) params.set('endDate', dates[dates.length - 1])

    fetch(`/api/availability?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (controller.signal.aborted) return
        // A Vite-only static deployment may return HTML or 404 for /api.
        // Neither means that a vehicle is booked: do not invent availability.
        if (!(response.headers.get('content-type') || '').includes('application/json'))
          throw new Error('The online reservation API is not connected.')
        const data = await response.json()
        if (!response.ok) {
          if (response.status === 400) {
            setAvailabilityIssue({
              kind: 'invalid',
              message: typeof data?.error === 'string'
                ? data.error : 'Please check the selected date and pickup time.',
            })
            return
          }
          throw new Error('The online reservation API is temporarily unavailable.')
        }
        if (!Array.isArray(data?.days) ||
            data.days.length !== dates.length ||
            data.days.some((day: { date?: string; vehicles?: unknown }) =>
              !dates.includes(day.date || '') ||
              !Array.isArray(day.vehicles) ||
              !catalog.vehicles.every((vehicle) =>
                (day.vehicles as { id: string; available: boolean }[]).some(
                  (entry) => entry.id === vehicle.id &&
                    typeof entry.available === 'boolean',
                ),
              ),
            )) {
          throw new Error('The reservation API returned an incomplete availability check.')
        }
        if (controller.signal.aborted) return
        // Requestability alone never proves the booking persistence API is online.
        setBookingSubmissionReady(data.bookingSubmissionReady === true)
        setVerifiedAvailabilityKey(availabilityKey)
        setAvailability(
          Object.fromEntries(
            data.days.map(
              (day: {
                date: string
                vehicles: { id: string; available: boolean }[]
              }) => [
                day.date,
                Object.fromEntries(day.vehicles.map((v) => [v.id, v.available])),
              ],
            ),
          ),
        )
        if (typeof data.usdRate === 'number' && Number.isFinite(data.usdRate))
          setUsdRate(data.usdRate)
      })
      .catch((error) => {
        if (controller.signal.aborted && !timedOut) return
        setAvailabilityIssue({
          kind: 'unreachable',
          message: timedOut
            ? 'The availability check timed out.'
            : error instanceof TypeError
              ? 'We cannot reach the reservation service.'
              : 'The online reservation service is not available.',
        })
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!controller.signal.aborted || timedOut) setChecking(false)
      })
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [availabilityKey, availabilityVersion])
  useEffect(() => {
    if (initialUsdRate) setUsdRate(initialUsdRate)
  }, [initialUsdRate])
  useEffect(() => {
    if (result) successHeading.current?.focus()
  }, [result])
  const prevGlassOpenRef = useRef(false)
  useEffect(() => {
    if (glassOpen && !result && !prevGlassOpenRef.current) {
      trackBookingOpen(service, vehicle, locale)
    }
    prevGlassOpenRef.current = glassOpen
  }, [glassOpen, result, service, vehicle, locale])

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
        if (!isRouteComplete(getRoute(dates[0]))) {
          setError('Choose pickup and destination locations for the first date before continuing.')
          return
        }
        if (!form.current?.reportValidity()) return
        setError('')
        setEditingDate(dates[0])
        setDailyScheduleOpen(true)
        trackBookingStep({
          stepName: 'daily_schedule',
          tripMode: 'multi_day',
          dayCount: dates.length,
          serviceId: journeys[0]?.service || service,
          vehicleId: journeys[0]?.vehicle || vehicle,
          locale,
        })
        requestAnimationFrame(() => heading.current?.focus())
        return
      }
      const invalid = journeys.find((day) => !isRouteComplete(day))
      if (invalid) {
        const message = !invalid.pickupPlace || !invalid.destinationPlace
          ? 'Choose pick-up and final drop-off locations'
          : 'Select a valid location for every scheduled stop'
        setError(`${message} for ${displayDate(invalid.date)}.`)
        if (multiDay) setEditingDate(invalid.date)
        return
      }
    }
    if (target > step && !form.current?.reportValidity()) return
    if (target > step && step === 1 && availabilityIssue?.kind === 'invalid') {
      setError(availabilityIssue.message)
      return
    }
    // If the API is unreachable, let guests review their details and use the
    // clearly labelled email enquiry fallback. Never call this availability.
    setError('')
    setStep(target)
    if (target > step) {
      trackBookingStep({
        stepName: target === 1 ? 'vehicle' : 'details',
        tripMode: multiDay ? 'multi_day' : 'single_day',
        dayCount: journeys.length,
        serviceId: journeys[0]?.service || service,
        vehicleId: journeys[0]?.vehicle || vehicle,
        locale,
      })
    }
    requestAnimationFrame(() => heading.current?.focus())
  }
  const emailEnquiry = () => {
    const mailLabel = (en: string, ko: string) => locale === 'ko' ? ko : en
    const itinerary = journeys.map((day, index) => [
      `Day ${String(index + 1).padStart(2, '0')}: ${displayDate(day.date)} · ${day.time} KST`,
      `${mailLabel("Service", "서비스")}: ${catalog.services.find((item) => item.id === day.service)?.name || day.service}`,
      `${mailLabel("Vehicle", "차량")}: ${catalog.vehicles.find((item) => item.id === day.vehicle)?.name || day.vehicle}`,
      `${mailLabel("Pickup", "승차 장소")}: ${day.pickup}`,
      ...day.stops.map((stop, i) => `${mailLabel('Stop','경유지')} ${i + 1}: ${stop.location}`),
      `${mailLabel("Destination", "하차 장소")}: ${day.destination}`,
      ...(day.flight ? [`${mailLabel("Flight", "항공편명")}: ${day.flight}`] : []),
    ].join('\n')).join('\n\n')
    const additions = catalog.options
      .filter((option) => options.includes(option.id))
      .map((option) => option.name).join(', ') || 'None'
    const message = [
      mailLabel('Hello CHAUFFEUR,','CHAUFFEUR 담당자님,'),
      '',
      mailLabel('Please review my booking enquiry. I understand this is not confirmed.','예약 문의드립니다. 아직 예약이 확정되지 않은 것을 확인했습니다.'),
      '',
      `${mailLabel("Name", "예약자 성함")}: ${name}`, `${mailLabel("Email", "이메일")}: ${email}`, `${mailLabel("Phone", "연락처")}: ${phone}`,
      `${mailLabel("Preferred contact", "선호 연락 수단")}: ${contactMethod}`,
      ...(submittedMessengerContact ? [`${mailLabel("Messenger", "메신저")}: ${submittedMessengerContact}`] : []),
      '',
      mailLabel('ITINERARY','운행 일정'),
      itinerary,
      '',
      `${mailLabel("Add-ons", "추가 옵션")}: ${additions}`,
      `${mailLabel("Estimated total (tax excluded)", "예상 이용 금액 (부가세 별도)")}: ${quoteRequired ? t('Quote on request') : money(total)}`,
      '',
      mailLabel('Please confirm availability and follow up with me.','예약 가능 여부를 확인하신 후 연락 부탁드립니다.'),
    ].join('\n')
    setError('')
    setEmailDraftOpened(true)
    trackBookingEmailFallback(journeys.length, locale)
    window.location.href = composeEmail('CHAUFFEUR · Booking enquiry', message)
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (step < 2) {
      moveStep(step + 1)
      return
    }
    if (sending) return
    if (!bookingSubmissionReady || !allAvailable) {
      emailEnquiry()
      return
    }
    setSending(true)
    setError('')
    const controller = new AbortController()
    const requestKey = idempotency.current
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: JSON.stringify({
          date: journeys[0].date,
          time: journeys[0].time,
          pickup: journeys[0].pickup,
          destination: journeys[0].destination,
          pickupPlace: journeys[0].pickupPlace,
          destinationPlace: journeys[0].destinationPlace,
          flight: journeys[0].flight,
          service: journeys[0].service,
          vehicle: journeys[0].vehicle,
          journeys,
          options,
          name,
          email,
          phone,
          contactMethod,
          messengerContact: submittedMessengerContact,
          preferredLocale: locale,
          consent,
        }),
      })
      if (!(response.headers.get('content-type') || '').includes('application/json'))
        throw new TypeError('Reservation API response was not JSON.')
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
      setExportError('')
      setResult({
        ...data,
        preferredLocale: locale,
        journeys: data.journeys.map((day: Result['journeys'][number], i: number) => ({
          ...day,
          pickupName: (journeys[i]?.pickupPlace && curatedLabels(journeys[i].pickupPlace!.id, locale)?.name) || journeys[i]?.pickupPlace?.name || day.pickup,
          destinationName: (journeys[i]?.destinationPlace && curatedLabels(journeys[i].destinationPlace!.id, locale)?.name) || journeys[i]?.destinationPlace?.name || day.destination,
        })),
      })
      trackBookingLead({
        total: typeof data.total === 'number' ? data.total : null,
        serviceId: journeys[0]?.service || service,
        vehicleId: journeys[0]?.vehicle || vehicle,
        tripMode: journeys.length > 1 ? 'multi_day' : 'single_day',
        dayCount: journeys.length,
        optionCount: options.length,
        contactMethod,
        locale,
        journeys: journeys.map(({ service, vehicle }) => ({ service, vehicle })),
        requestKey,
      })
    } catch (error) {
      if (error instanceof TypeError) {
        setAvailabilityIssue({
          kind: 'unreachable',
          message: 'The online reservation API is unavailable. You can email your enquiry instead.',
        })
      }
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
  const exportPdf = async () => {
    if (!result) return
    try {
      setExportError('')
      await exportItineraryPdf({ ...result, preferredLocale: locale })
      trackItineraryExport('pdf', result.journeys.length, locale)
    } catch {
      setExportError('Could not save the PDF. Please try again.')
    }
  }
  const exportPng = async () => {
    if (!result) return
    try {
      setExportError('')
      await exportItineraryPng({ ...result, preferredLocale: locale })
      trackItineraryExport('png', result.journeys.length, locale)
    } catch {
      setExportError('Could not save the image. Please try again.')
    }
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
        <SectionEyebrow>YOUR NEXT CHAPTER</SectionEyebrow>
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
            {['Schedule', 'Vehicle', 'Details', 'Confirmation'].map((label, i, arr) => {
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
                    <span className="booking-stepper-label">{locale === 'ko' && label === 'Vehicle' ? t('Vehicle Selection') : t(label)}</span>
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
              <BookingCtaBeam />
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
              <span className="booking-glass-prompt">{t("Ready to reserve your chauffeur?")}</span>
              <span className="booking-glass-subtitle">{t("Begin your journey")}</span>
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
                <div className="booking-confirmation-header">
                  <div className="booking-confirmation-status">
                    <CheckCircle2 size={22} strokeWidth={1.5} aria-hidden="true" />
                    <span>{t("REQUEST SAVED")}</span>
                  </div>
                  <span className="booking-confirmation-pending">{t("Awaiting Confirmation")}</span>
                </div>
                <div className="booking-confirmation-heading">
                  <div>
                    <p className="booking-confirmation-kicker">{t("YOUR RESERVATION REQUEST")}</p>
                    <h3 ref={successHeading} tabIndex={-1}>{t("Your journey, arranged.")}</h3>
                    <p>{t("Your itinerary is saved and ready for our team to review.")}</p>
                  </div>
                  <div className="booking-confirmation-reference">
                    <small>{t("REFERENCE")}</small>
                    <strong>{result.reference}</strong>
                  </div>
                </div>
                <div className="booking-confirmation-stats">
                  <div>
                    <small>{t("DATES")}</small>
                    <strong>{displayDate(result.journeys[0].date)}
                      {result.journeys.length > 1 && ' – ' + displayDate(result.journeys[result.journeys.length - 1].date)}
                    </strong>
                  </div>
                  <div>
                    <small>{t("JOURNEYS")}</small>
                    <strong>{locale === 'ko' ? `${result.journeys.length}일` : `${result.journeys.length} ${result.journeys.length === 1 ? 'day' : 'days'}`}</strong>
                  </div>
                  <div>
                    <small>{t("ESTIMATED TOTAL")}</small>
                    <strong>{result.total === null ? t('Quote on request') : money(result.total)}</strong>
                    <span>{t("KRW · Tax excluded")}</span>
                  </div>
                </div>
                <div className="booking-confirmation-itinerary">
                  <div className="booking-confirmation-itinerary-heading">
                    <h4>{t("Daily itinerary")}</h4>
                  </div>
                  <div className="booking-confirmation-days">
                    {result.journeys.map((day, index) => (
                      <article className="booking-confirmation-day" key={day.date}>
                        <div className="booking-confirmation-day-date">
                          <small>DAY {String(index + 1).padStart(2, '0')}</small>
                          <strong>{displayDate(day.date)}</strong>
                        </div>
                        <div className="booking-confirmation-day-info">
                          <div className="booking-confirmation-day-meta">
                            <strong>{day.service} · {day.time} KST (UTC+9)</strong>
                            <span>{day.vehicle}</span>
                          </div>
                          <div className="booking-confirmation-route">
                            <span>{day.pickupName || day.pickup}</span>
                            <span className="booking-confirmation-route-arrow" aria-hidden="true">→</span>
                            <span>{day.destinationName || day.destination}</span>
                          </div>
                          {!!day.stops?.length && (
                            <p className="booking-confirmation-stops">
                              Via {day.stops.join(' · ')}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="booking-confirmation-footer">
                  <p><strong>{t("Request saved · Not yet confirmed.")}</strong> {t('No payment has been taken.')}</p>
                  <div className="success-actions">
                    <button type="button" className="booking-confirmation-export" aria-label={t("Download PDF")} onClick={() => { void exportPdf() }}>
                      <FileDown size={16} aria-hidden="true" /> PDF
                    </button>
                    <button type="button" className="booking-confirmation-export" aria-label={t("Download PNG")} onClick={() => { void exportPng() }}>
                      <Image size={16} aria-hidden="true" /> PNG
                    </button>
                    <a
                      className="booking-confirmation-email"
                      href={customQuoteEmail()}
                      onClick={() => trackContactClick('booking_confirmation', 'email')}
                    >
                      <Mail size={16} aria-hidden="true" /> {t("Email Us")}
                    </a>
                  </div>
                  {exportError && <p className="booking-confirmation-error" role="alert">{t(exportError)}</p>}
                </div>
                <div className="booking-confirmation-secondary">
                  <button
                    className="text-link"
                    onClick={() => {
                      setResult(null)
                      setStep(0)
                      setDailyScheduleOpen(false)
                      setMultiDay(false)
                      setRoutesByDate({})
                      setTimesByDate({})
                      setServicesByDate({})
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
                    {t("Plan another journey")} <ArrowUpRight size={16} />
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
                      {t(step === 0 && dailyScheduleOpen
                        ? 'Review and customize your daily schedule'
                        : [
                            'Select your schedule and route',
                            'Choose your vehicle and options',
                            'Enter your contact details',
                          ][step])}
                    </h3>
                    {step === 0 && !dailyScheduleOpen && (
                      <div className="schedule-fields">
                        <div className="schedule-date-col">
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
                                setService(getService(first))
                                setMultiDay(false)
                                setDates([first])
                                setActiveDate(first)
                                setEditingDate(null)
                                setRoutesByDate({})
                                setTimesByDate({})
                                setServicesByDate({})
                                setVehicleMode('same')
                                setDailyScheduleOpen(false)
                              }}
                            >
                              {t("Single Day")}
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
                              {t("Multiple Days")}
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
                                    {t("Consecutive Range")}
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
                                    {t("Specific Dates")}
                                  </span>
                                </button>
                              </div>
                              <div className="selected-dates-summary">
                                <span>
                                  <strong>
                                    {locale === 'ko' ? `${dates.length}일` : `${dates.length} ${dates.length === 1 ? 'day' : 'days'}`}
                                  </strong>
                                  {multiDayMode === 'range' && dates.length > 1
                                    ? ` · ${displayDate(dates[0])} — ${displayDate(dates[dates.length - 1])}`
                                    : ` · ${dates.map((d) => new Date(`${d}T12:00:00`).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', { day: 'numeric', month: 'short' })).join(', ')}`}
                                </span>
                                {dates.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setDates([dates[0]])}
                                  >
                                    {t("Reset")}
                                  </button>
                                )}
                              </div>
                              <div className="booking-first-day-note field-note">
                                <span>{t("Day 01 · Set pickup, time, and stops for each day next.")}</span>
                                <span>{t("Copy any day's itinerary to other days anytime.")}</span>
                              </div>
                              {dates.length < 2 && (
                                <p className="field-note booking-daily-next-note">
                                  {t("Select at least two dates in the calendar to continue.")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="schedule-divider" aria-hidden="true" />
                        <div className="route-fields schedule-route-col">
                          <div className="field">
                            <span>
                              {t("Service")}
                            </span>
                            <GlassSelect
                              ariaLabel="Service"
                              name="service"
                              value={getService(dates[0] || tomorrow())}
                              onChange={(next) => {
                                setService(next)
                                if (multiDay) setServiceForDate(dates[0], next)
                              }}
                              options={bookableServices}
                            />
                          </div>
                          <AddressSearch
                                labelIcon={false}

                                recentPlaces={multiDay ? recentTripPlaces : []}
                            name="pickup"
                            label="Pickup Location"
                            placeholder="Enter pickup location"
                            value={multiDay ? getRoute(dates[0]).pickup : pickup}
                            place={multiDay ? getRoute(dates[0]).pickupPlace : pickupPlace}
                            onChange={(value, selected) => {
                              if (multiDay) setRouteForDate(dates[0], {
                                pickup: value, pickupPlace: selected,
                              })
                              else {
                                setPickup(value)
                                setPickupPlace(selected)
                              }
                            }}
                          />
                          <AddressSearch
                                labelIcon={false}

                                recentPlaces={multiDay ? recentTripPlaces : []}
                            name="destination"
                            label="Destination"
                            placeholder="Enter destination"
                            value={multiDay ? getRoute(dates[0]).destination : destination}
                            place={multiDay ? getRoute(dates[0]).destinationPlace : destinationPlace}
                            onChange={(value, selected) => {
                              if (multiDay) setRouteForDate(dates[0], {
                                destination: value, destinationPlace: selected,
                              })
                              else {
                                setDestination(value)
                                setDestinationPlace(selected)
                              }
                            }}
                          />
                          <div className="field time-field">
                            <span className="booking-time-label">
                              <span className="booking-time-heading">{t("Pickup Time")}</span>
                              <small className="booking-timezone">KST (UTC+9)</small>
                            </span>
                            <GlassTimeInput
                              ariaLabel="Pickup Time"
                              name="pickup-time"
                              value={getTime(dates[0] || tomorrow())}
                              onChange={(t) => {
                                if (!multiDay) setDefaultTime(t)
                                setTimeForDate(dates[0] || tomorrow(), t)
                              }}
                              options={timeOptions}
                            />
                          </div>
                          {getService(dates[0] || tomorrow()) === 'airport' && (
                            <label className="field">
                              <span>
                                {t("Flight number")} <small>{t("optional")}</small>
                              </span>
                              <input
                                name="flight"
                                maxLength={30}
                                value={multiDay ? getRoute(dates[0]).flight : flight}
                                onChange={(e) => {
                                  if (multiDay) setRouteForDate(dates[0], { flight: e.target.value })
                                  else setFlight(e.target.value)
                                }}
                                placeholder={t("e.g. KE 902")}
                              />
                            </label>
                          )}
                          <div className="booking-custom-footer">
                            <button type="button" className="booking-custom-contact" onClick={onRequestCustom}>
                              {t("Need a custom itinerary? Email us")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {step === 0 && dailyScheduleOpen && (
                      <section className="booking-daily-screen" aria-label="Daily Schedule">
                        <div className="booking-daily-progress">
                          <div>
                            <span className="field-section-title">{t("Your daily itinerary")}</span>
                            <p className="field-note">{t("Set the pick-up, schedule and time for each date.")}</p>
                          </div>
                          <span className="booking-daily-progress-count">
                            {locale === 'ko' ? `${dates.filter((day) => isRouteComplete(getRoute(day))).length}/${dates.length} 입력 완료` : <>{dates.filter((day) => isRouteComplete(getRoute(day))).length} of {dates.length} ready</>}
                          </span>
                        </div>
                          <div className="booking-daily-layout">
                            <div className="booking-daily-day-list" role="group" aria-label="Select a date to customize">
                              {dates.map((day, index) => {
                                const ready = isRouteComplete(getRoute(day))
                                const route = getRoute(day)
                                const selectedService = catalog.services.find((item) => item.id === getService(day))
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    className={`daily-journey-card ${scheduleActiveDate === day ? 'active-day-card' : ''}`}
                                    aria-pressed={scheduleActiveDate === day}
                                    onClick={() => {
                                      setEditingDate(day)
                                      setConfirmCopySchedule(false)
                                      setError('')
                                    }}
                                  >
                                    <span className="card-top">
                                      <span className="day-indicator">
                                        <span className="badge">Day {String(index + 1).padStart(2, '0')}</span>
                                        <strong>{displayDate(day)}</strong>
                                      </span>
                                      <span className={`active-hint ${ready ? 'is-ready' : ''}`}>
                                        {ready && <Check size={13} strokeWidth={1.7} aria-hidden="true" />}
                                        {t(ready ? 'Ready' : 'To complete')}
                                      </span>
                                    </span>
                                    <span className="field-note booking-day-card-summary">
                                      <span className="booking-day-card-meta">
                                        <span className={`service-tone service-tone-${getService(day)}`}>
                                          {selectedService?.name ?? 'Service'}
                                        </span> · {getTime(day)}
                                      </span>
                                      <span className="booking-day-card-route">
                                        {(route.pickupPlace && curatedLabels(route.pickupPlace.id, locale)?.name) || route.pickup || t('Pickup Location')} → {(route.destinationPlace && curatedLabels(route.destinationPlace.id, locale)?.name) || route.destination || t('Destination')}
                                      </span>
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                            <div className="booking-daily-editor" key={scheduleActiveDate}>
                              <div className="daily-times-header">
                                <span className="field-label">
                                  Day {String(dates.indexOf(scheduleActiveDate) + 1).padStart(2, '0')} · {displayDate(scheduleActiveDate)}
                                </span>
                              </div>
                              <div className="field">
                                <span>{t("Service")}</span>
                                <GlassSelect
                                  ariaLabel={`Service for ${displayDate(scheduleActiveDate)}`}
                                  name={`service-${scheduleActiveDate}`}
                                  value={getService(scheduleActiveDate)}
                                  onChange={(next) => setServiceForDate(scheduleActiveDate, next)}
                                  options={bookableServices}
                                />
                              </div>
                              <div className="booking-daily-route-flow">
                                <AddressSearch
                                  labelIcon={false}
                                  recentPlaces={recentTripPlaces}
                                  name={`pickup-${scheduleActiveDate}`}
                                  label="Pickup Location"
                                  placeholder="Enter pickup location"
                                  value={getRoute(scheduleActiveDate).pickup}
                                  place={getRoute(scheduleActiveDate).pickupPlace}
                                  onChange={(value, place) => setRouteForDate(scheduleActiveDate, {
                                    pickup: value, pickupPlace: place,
                                  })}
                                />
                                {getRoute(scheduleActiveDate).stops.map((stop, index) => (
                                  <div className="booking-daily-stop-leg" key={index}>
                                    <div className="booking-route-connector is-compact" aria-hidden="true">
                                      <span className="booking-route-stem" />
                                      <svg className="booking-route-chevron" width="10" height="7" viewBox="0 0 10 7" fill="none" focusable="false">
                                        <path d="M1 1.25L5 5.5L9 1.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </div>
                                    <div className="booking-daily-stop">
                                      <AddressSearch
                                        labelIcon={false}
                                        recentPlaces={recentTripPlaces}
                                        name={`stop-${scheduleActiveDate}-${index}`}
                                        label={locale === 'ko' ? `경유지 ${index + 1}` : `Stop ${index + 1}`}
                                        placeholder="Add a stop to this day"
                                        value={stop.location}
                                        place={stop.place}
                                        onChange={(value, place) => {
                                          const stops = getRoute(scheduleActiveDate).stops.map((item, i) =>
                                            i === index ? { location: value, place } : item)
                                          setRouteForDate(scheduleActiveDate, { stops })
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="booking-daily-remove-stop"
                                        aria-label={`Remove stop ${index + 1}`}
                                        onClick={() => setRouteForDate(scheduleActiveDate, {
                                          stops: getRoute(scheduleActiveDate).stops.filter((_, i) => i !== index),
                                        })}
                                      >
                                        {t("Remove")}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <div className={`booking-route-connector ${getRoute(scheduleActiveDate).stops.length < 8 ? 'has-action' : 'is-compact'}`}>
                                  <span className="booking-route-stem" aria-hidden="true" />
                                  {getRoute(scheduleActiveDate).stops.length < 8 && (
                                    <button
                                      type="button"
                                      className="apply-all-btn booking-daily-add-stop"
                                      onClick={() => setRouteForDate(scheduleActiveDate, {
                                        stops: [...getRoute(scheduleActiveDate).stops, { location: '', place: null }],
                                      })}
                                    >
                                      <Plus size={13} aria-hidden="true" /> {t("Add Stop")}
                                    </button>
                                  )}
                                  <span className="booking-route-arrow" aria-hidden="true">
                                    {getRoute(scheduleActiveDate).stops.length < 8 && <span className="booking-route-stem" />}
                                    <svg className="booking-route-chevron" width="10" height="7" viewBox="0 0 10 7" fill="none" focusable="false">
                                      <path d="M1 1.25L5 5.5L9 1.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                </div>
                                <AddressSearch
                                  labelIcon={false}
                                  recentPlaces={recentTripPlaces}
                                  name={`destination-${scheduleActiveDate}`}
                                  label="Destination"
                                  placeholder="Enter destination"
                                  value={getRoute(scheduleActiveDate).destination}
                                  place={getRoute(scheduleActiveDate).destinationPlace}
                                  onChange={(value, place) => setRouteForDate(scheduleActiveDate, {
                                    destination: value, destinationPlace: place,
                                  })}
                                />
                              </div>
                              <div className="field time-field">
                                <span className="booking-time-label">
                                  <span className="booking-time-heading">{t("Pickup Time")}</span>
                                  <small className="booking-timezone">KST (UTC+9)</small>
                                </span>
                                <GlassTimeInput
                                  ariaLabel={`Pickup time for ${displayDate(scheduleActiveDate)}`}
                                  value={getTime(scheduleActiveDate)}
                                  onChange={(time) => setTimeForDate(scheduleActiveDate, time)}
                                  options={timeOptions}
                                />
                              </div>
                              {getService(scheduleActiveDate) === 'airport' && (
                                <label className="field">
                                  <span>{t("Flight number")} <small>{t("optional")}</small></span>
                                  <input
                                    name={`flight-${scheduleActiveDate}`}
                                    maxLength={30}
                                    value={getRoute(scheduleActiveDate).flight}
                                    onChange={(event) => setRouteForDate(scheduleActiveDate, { flight: event.target.value })}
                                    placeholder={t("e.g. KE 902")}
                                  />
                                </label>
                              )}
                              <div className="booking-daily-copy">
                                {confirmCopySchedule ? (
                                  <div className="selected-dates-summary">
                                    <span>{t("Copy this day's service, route, stops and time to all other dates? Existing plans will be replaced.")}</span>
                                    <button type="button" onClick={applyScheduleToAll}>{t("Confirm")}</button>
                                    <button type="button" onClick={() => setConfirmCopySchedule(false)}>{t("Cancel")}</button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="apply-all-btn"
                                    onClick={() => {
                                      if (!isRouteComplete(getRoute(scheduleActiveDate))) {
                                        setError('Finish this day before copying its schedule.')
                                        return
                                      }
                                      setError('')
                                      setConfirmCopySchedule(true)
                                    }}
                                  >
                                    {t("Copy this day to all")}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                      </section>
                    )}
                    {step === 1 && (
                      <div className="preferences-fields">
                        {multiDay && dates.length > 1 && (
                          <div className="daily-schedule-configuration">
                            <div className="daily-schedule-header">
                              <div>
                                <strong>{t("Vehicle Selection")}</strong>
                                <small>{t("Use one vehicle for all days, or choose per day.")}</small>
                              </div>
                            </div>
                            <div className="day-mode-segmented" role="radiogroup" aria-label="Vehicle assignment">
                              <button type="button" role="radio" aria-checked={vehicleMode === 'same'}
                                className={`day-mode-pill ${vehicleMode === 'same' ? 'active' : ''}`}
                                onClick={() => setVehicleMode('same')}>
                                {t("Same for All Days")}
                              </button>
                              <button type="button" role="radio" aria-checked={vehicleMode === 'daily'}
                                className={`day-mode-pill ${vehicleMode === 'daily' ? 'active' : ''}`}
                                onClick={() => {
                                  setVehiclesByDate((prev) => {
                                    const next = { ...prev }
                                    let changed = false
                                    for (const d of dates) {
                                      if (!next[d]) {
                                        next[d] = vehicle
                                        changed = true
                                      }
                                    }
                                    return changed ? next : prev
                                  })
                                  setVehicleMode('daily')
                                }}>
                                {t("Choose Per Day")}
                              </button>
                            </div>
                            {vehicleMode === 'same' ? (
                              <p className="field-note">
                                {locale === 'ko' ? `총 ${dates.length}일 일정에 적용됩니다.` : `Applies to all ${dates.length} days.`}
                              </p>
                            ) : (
                              <div className="daily-schedule-cards" role="group" aria-label="Choose a day to assign a vehicle">
                                {dates.map((d, index) => {
                                  const selected = getVehicle(d)
                                  const car = catalog.vehicles.find((item) => item.id === selected)!
                                  const selectedService = catalog.services.find((item) => item.id === getService(d))
                                  const isActive = currentActiveDate === d
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
                                        <span className="day-price"><strong>{money((selectedService?.price ?? 0) + car.surcharge + extras)}</strong></span>
                                      </span>
                                      <span className="card-footer"><span className="active-hint">
                                        <span className={`service-tone service-tone-${getService(d)}`}>
                                          {selectedService?.name ?? 'Service'}
                                        </span> · {getTime(d)} · {car.name}
                                        <small>{getRoute(d).pickup || t('Pick-up')} → {getRoute(d).destination || t('Destination')}</small>
                                      </span></span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="field-section-title extras-title">
                          {t(dates.length > 1
                            ? 'Add-ons · Per Day'
                            : 'Add-ons')}
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
                                {t(option.name)}
                                <small>{t(option.description)}</small>
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
                          <span>{t("Full name")}</span>
                          <div className="contact-input-wrap">
                            <input
                              name="name"
                              autoComplete="name"
                              required
                              maxLength={100}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              placeholder={t("Your full name")}
                            />
                            {nameReady && <Check size={16} className="contact-input-valid" aria-hidden="true" />}
                          </div>
                        </label>
                        <div className="contact-field-row">
                          <label className="field">
                            <span>{t("Email address")}</span>
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
                            <span>{t("Phone number")}</span>
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
                          <legend>{t("Preferred Contact Method")}</legend>
                          <div className="contact-method-grid">
                            {catalog.contactMethods.map((method) => {
                              const ContactIcon = CONTACT_METHOD_ICONS[method.id] ?? MessageCircle
                              return (
                                <label
                                  key={method.id}
                                  className={contactMethod === method.id ? 'selected' : ''}
                                >
                                  <input
                                    className="contact-method-native-radio"
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
                                  <ContactIcon
                                    className="contact-method-icon"
                                    size={15}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />
                                  <span>{t(method.name)}</span>
                                </label>
                              )
                            })}
                          </div>
                          {!['email', 'phone'].includes(contactMethod) && (
                            <div className="messenger-preference">
                              {['whatsapp', 'line', 'kakao', 'wechat'].includes(contactMethod) && (
                                <label className="messenger-use-phone">
                                  <input
                                    type="checkbox"
                                    name="use-phone-for-messenger"
                                    checked={usePhoneForMessenger}
                                    onChange={(event) => setUsePhoneForMessenger(event.target.checked)}
                                  />
                                  <span>{locale === 'ko' ? `위 연락처를 ${contactApp}에 사용` : `Use the phone number above for ${contactApp}`}</span>
                                </label>
                              )}
                              {usesMessengerPhone ? (
                                <p className="messenger-help" role="status">
                                  {locale === 'ko' ? `${phone || t('Your phone number')}을(를) ${contactApp}에 사용합니다.` : `${phone || 'Your phone number'} will be used for ${contactApp}.`}
                                  {t("Make sure people can contact you on that app using this number.")}
                                </p>
                              ) : (
                                <label className="field messenger-field">
                                  <span>
                                    {contactMethod === 'whatsapp'
                                      ? 'WhatsApp number'
                                      : `${contactApp} ID or phone number`}
                                    {contactMethod === 'whatsapp' && <small>{t("optional")}</small>}
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
                                        : t('Messenger ID or linked phone number')}
                                      aria-describedby="messenger-help"
                                    />
                                    {messengerContact.trim().length > 1 &&
                                      <Check size={16} className="contact-input-valid" aria-hidden="true" />}
                                  </div>
                                  <small id="messenger-help" className="messenger-help">
                                    {contactMethod === 'whatsapp'
                                      ? t('Leave blank to use your phone number above.')
                                      : t('Use an ID or a phone number that others can reach on this app.')}
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
                            {t("I consent to storing my details to arrange this reservation.")}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="privacy-inline"
                          onClick={showPrivacy}
                        >
                          {t("Reservation & Privacy Notice")}{' '}
                          <ArrowUpRight size={14} />
                        </button>
                        {(availabilityIssue?.kind === 'unreachable' ||
                          (allAvailable && !bookingSubmissionReady)) && (
                          <p className="booking-email-fallback-note" role="status">
                            {t("All vehicle types are open for enquiries. Online booking storage is not connected, so this opens an email draft instead; it will not be saved or sent until you send it from your email app.")}
                          </p>
                        )}
                        {emailDraftOpened && (
                          <p className="booking-email-fallback-note" role="status">
                            {t("Your email app should open with a draft. Please send it from your email app. No booking has been confirmed or saved online.")}
                          </p>
                        )}
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
                        availability={{}}
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
                                  Day {String(index + 1).padStart(2, '0')} · {compactDate(day.date)} · {day.time} KST ·{' '}
                                  <span className={`service-tone service-tone-${day.service}`}>
                                    {catalog.services.find((item) => item.id === day.service)?.name ?? 'Service'}
                                  </span>
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
                              ? `Until ${displayDate(dates[dates.length - 1])}`
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
                            const selectedService = catalog.services.find((item) => item.id === day.service)
                            const dayTotal =
                              (selectedService?.price ?? 0) + v.surcharge + extras
                            return (
                              <div key={day.date}>
                                <span className="booking-vehicle-day-date" title={displayDate(day.date)}>
                                  Day {String(index + 1).padStart(2, '0')} · {compactDate(day.date)} · {day.time}
                                </span>
                                <span className="booking-vehicle-day-price">
                                  <span title={v.name}>{shortVehicleName(day.vehicle)}</span> ·{' '}
                                  <span className={`service-tone service-tone-${day.service}`}>
                                    {selectedService?.name ?? 'Service'}
                                  </span> · {v.quoteRequired ? 'Quote' : money(dayTotal)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div>
                        <span>
                          {step !== 2 && <Car size={14} />} {mixedServices
                            ? t('Services · per day')
                            : `${summaryService.name} (${summaryService.duration}h)${dates.length > 1 ? ` × ${dates.length} days` : ''}`}
                        </span>
                        <span>
                          {quoteRequired
                            ? t('Quote on request')
                            : money(serviceBaseTotal)}
                        </span>
                      </div>
                      {vehicleSurcharges > 0 && (
                        <div>
                          <span>
                            {upgradedVehicleSummary
                              ? `${t('Vehicle Upgrade')} (${upgradedVehicleSummary})`
                              : t('Vehicle Upgrade')}
                          </span>
                          <span>{money(vehicleSurcharges)}</span>
                        </div>
                      )}
                      {catalog.options
                        .filter((o) => options.includes(o.id))
                        .map((o) => (
                          <div key={o.id}>
                            <span>
                              {t(o.name)}
                              {dates.length > 1 ? ` × ${dates.length}` : ''}
                            </span>
                            <span>{money(o.price * dates.length)}</span>
                          </div>
                        ))}
                    </div>
                    <div className="summary-total">
                      <div>
                        <span>{t("Estimated total")}</span>
                        <small className="tax-notice">
                          {locale === 'ko' ? '부가세 별도 · ~' : 'KRW · Tax excl. · ~'}{moneyUsd(total, usdRate)} USD
                        </small>
                      </div>
                      <strong className={quoteRequired ? 'quote-on-request' : ''}>
                        {quoteRequired ? t('Quote on request') : money(total)}
                      </strong>
                    </div>
                    {quoteRequired && (
                      <p className="quote-note">
                        {t("This journey needs a tailored quote. TAX is not included.")}
                      </p>
                    )}
                    <p className="availability-note" aria-live="polite">
                      {checking ? (
                        <>
                          <LoaderCircle size={14} className="spin" /> {locale === 'ko' ? '예약 가능 여부 확인 중…' : <>Checking your{' '}{dates.length > 1 ? 'dates…' : 'date…'}</>}
                        </>
                      ) : allAvailable ? (
                        <>
                          <Check size={14} />{' '}
                          {t(dates.length > 1
                            ? 'All dates open for requests'
                            : 'Vehicle request accepted for review')}
                        </>
                      ) : availabilityIssue?.kind === 'unreachable' ? (
                        <>
                          <Clock3 size={14} /> {t("Availability not verified online. You can continue to Details and email your enquiry.")}
                        </>
                      ) : availabilityIssue?.kind === 'invalid' ? (
                        <>
                          <X size={14} /> {t(availabilityIssue.message)}
                        </>
                      ) : (
                        <>
                          <Clock3 size={14} /> {t("Checking availability is required before sending a request.")}
                        </>
                      )}
                    </p>
                    {availabilityIssue && (
                      <button
                        type="button"
                        className="booking-availability-retry"
                        onClick={() => setAvailabilityVersion((v) => v + 1)}
                      >
                        {t("Recheck availability")}
                      </button>
                    )}
                    {error && (
                      <div className="form-error" role="alert">
                        {t(error)}
                        <button
                          type="button"
                          onClick={() => setAvailabilityVersion((v) => v + 1)}
                          aria-label={t("Recheck availability")}
                        >
                          {t("Retry")}
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
                {t(error)}
                <button
                  type="button"
                  onClick={() => setAvailabilityVersion((v) => v + 1)}
                  aria-label={t("Recheck availability")}
                >
                  {t("Retry")}
                </button>
              </div>
            )}
            <div className={`booking-outer-buttons ${step === 2 ? 'is-details-actions' : ''}`}>
              {(step > 0 || (step === 0 && dailyScheduleOpen)) && (
                <ReservationButton
                  type="button"
                  className="booking-back-btn"
                  showBeam={false}
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
                  {step > 0 && <ArrowLeft size={16} aria-hidden="true" />} {t('Back')}
                </ReservationButton>
              )}
              <ReservationButton
                type="submit"
                form="booking-request-form"
                className={step === 2 ? 'booking-submit' : ''}
                disabled={
                  sending ||
                  (step === 2 && (checking ||
                    (!allAvailable && availabilityIssue?.kind !== 'unreachable')))
                }
              >
                {sending ? (
                  <>
                    {t("Saving your request")}{' '}
                    <LoaderCircle size={16} className="spin" />
                  </>
                ) : step === 0 ? (
                  <>
                    {t(multiDay && !dailyScheduleOpen ? 'Continue to Daily Schedule' : 'Continue to Vehicle')} <span aria-hidden="true">→</span>
                  </>
                ) : step === 1 ? (
                  <>
                    {t('Continue to Details')} <ArrowRight size={17} />
                  </>
                ) : !bookingSubmissionReady || availabilityIssue?.kind === 'unreachable' ? (
                  <>
                    {t("Email Booking Enquiry")} <ArrowUpRight size={17} />
                  </>
                ) : (
                  <>
                    {t("Request Booking")} <ArrowUpRight size={17} />
                  </>
                )}
              </ReservationButton>
            </div>
            {step >= 1 && (
              <p className="no-payment">
                {t('No upfront payment · Subject to confirmation')}
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
          {t("Privacy & reservations")} <Plus size={12} />
        </button>
        <span>
          SEOUL, SOUTH KOREA <span className="live-dot" />
        </span>
      </footer>
    </section>
  )
}

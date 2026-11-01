import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react'
import catalog from './catalog.json'
import AddressSearch from './AddressSearch'
import type { Place } from './AddressSearch'
import VehicleCarousel from './VehicleCarousel'
import {
  DEFAULT_USD_RATE,
  displayDate,
  money,
  moneyUsd,
  seoulDate,
  tomorrow,
} from './utils'

type Result = {
  reference: string
  status: string
  total: number
  date: string
  time: string
  vehicle: string
  service: string
}
type Props = {
  service: string
  setService: (value: string) => void
  vehicle: string
  setVehicle: (value: string) => void
  showPrivacy: () => void
  usdRate?: number
}

function Calendar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [month, setMonth] = useState(
    () => new Date(`${value.slice(0, 7)}-01T12:00:00`),
  )
  const today = seoulDate()
  const lastDate = new Date(`${today}T12:00:00`)
  lastDate.setDate(lastDate.getDate() + 365)
  const maxDate = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const first = (month.getDay() + 6) % 7
  const changeMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12))
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <span>
          {month.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </span>
        <div>
          <button
            type="button"
            className="icon-button"
            disabled={prefix <= today.slice(0, 7)}
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={prefix >= maxDate.slice(0, 7)}
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
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
          <span
            key={`day${i}`}
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
          const date = `${prefix}-${String(i + 1).padStart(2, '0')}`
          return (
            <button
              type="button"
              key={date}
              aria-label={displayDate(date)}
              aria-pressed={value === date}
              className={value === date ? 'selected' : ''}
              disabled={date < today || date > maxDate}
              onClick={() => onChange(date)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="calendar-note">
        <Clock3 size={12} /> All times are Seoul time (KST).
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
  usdRate: initialUsdRate = DEFAULT_USD_RATE,
}: Props) {
  const [usdRate, setUsdRate] = useState<number>(initialUsdRate)
  const [step, setStep] = useState(0)
  const [date, setDate] = useState(tomorrow)
  const [time, setTime] = useState('10:00')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [pickupPlace, setPickupPlace] = useState<Place | null>(null)
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null)
  const [flight, setFlight] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [availabilityVersion, setAvailabilityVersion] = useState(0)
  const form = useRef<HTMLFormElement>(null)
  const idempotency = useRef(crypto.randomUUID())
  const heading = useRef<HTMLHeadingElement>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)
  const currentService = catalog.services.find((s) => s.id === service)!
  const currentVehicle = catalog.vehicles.find((v) => v.id === vehicle)!
  const total =
    currentService.price +
    currentVehicle.surcharge +
    catalog.options
      .filter((o) => options.includes(o.id))
      .reduce((sum, o) => sum + o.price, 0)

  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setAvailability({})
    setError('')
    fetch(`/api/availability?${new URLSearchParams({ date, time, service })}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || 'Availability could not be checked.')
        setAvailability(
          Object.fromEntries(
            data.vehicles.map((v: { id: string; available: boolean }) => [
              v.id,
              v.available,
            ]),
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
  }, [date, time, service, availabilityVersion])
  useEffect(() => {
    if (initialUsdRate) setUsdRate(initialUsdRate)
  }, [initialUsdRate])
  useEffect(() => {
    if (result) successHeading.current?.focus()
  }, [result])

  const moveStep = (target: number) => {
    if (target > step && !form.current?.reportValidity()) return
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
          date,
          time,
          pickup,
          destination,
          pickupPlace,
          destinationPlace,
          flight,
          service,
          vehicle,
          options,
          name,
          email,
          phone,
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
    const start = new Date(`${result.date}T${result.time}:00+09:00`)
    const end = new Date(start.getTime() + currentService.duration * 3600000)
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
      'BEGIN:VEVENT',
      `UID:${result.reference}@chauffeur.local`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(`Chauffeur request ${result.reference} — pending confirmation`)}`,
      `LOCATION:${escape(pickup)}`,
      'DESCRIPTION:Reservation request only. This journey has not been confirmed.',
      'STATUS:TENTATIVE',
      'END:VEVENT',
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
      className="screen booking-screen"
      aria-labelledby="booking-title"
    >
      <div className="section-topline">
        <span className="eyebrow">
          <span className="gold-line" /> YOUR NEXT CHAPTER
        </span>
        <span className="section-numeral">04 / RESERVATION</span>
      </div>
      <div className="section-heading booking-heading">
        <h2 id="booking-title">
          Your journey.
          <br className="mobile-break" /> <em>Your way.</em>
        </h2>
        <p>
          A few details. Endless possibilities.
          <br />
          We'll take care of the road ahead.
        </p>
      </div>
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
            <span>
              {displayDate(result.date)} · {result.time} KST
            </span>
            <span>
              {result.vehicle} · {result.service}
            </span>
            <span>
              {money(result.total)} estimated total · approx.{' '}
              {moneyUsd(result.total, usdRate)} USD
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
                setName('')
                setEmail('')
                setPhone('')
                setConsent(false)
                idempotency.current = crypto.randomUUID()
                setAvailabilityVersion((v) => v + 1)
              }}
            >
              Plan another journey <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <form ref={form} onSubmit={submit} className="booking-panel">
          <div className="booking-main">
            <div className="booking-steps" aria-label="Reservation steps">
              {['When & where', 'The finer details', 'About you'].map(
                (label, i) => (
                  <button
                    type="button"
                    key={label}
                    disabled={i > step || sending}
                    className={
                      step === i ? 'active' : i < step ? 'complete' : ''
                    }
                    aria-current={step === i ? 'step' : undefined}
                    onClick={() => moveStep(i)}
                  >
                    <span>{i < step ? <Check size={12} /> : `0${i + 1}`}</span>
                    <span>{label}</span>
                  </button>
                ),
              )}
            </div>
            <div className="booking-fields" key={step}>
              <h3 className="sr-only" tabIndex={-1} ref={heading}>
                {
                  [
                    'Choose your date and route',
                    'Choose your vehicle and options',
                    'Enter your contact details',
                  ][step]
                }
              </h3>
              {step === 0 && (
                <div className="journey-fields">
                  <div>
                    <Calendar value={date} onChange={setDate} />
                    <label className="field time-field">
                      <span>
                        <Clock3 size={13} /> Pick-up time
                      </span>
                      <select
                        aria-label="Pick-up time"
                        name="pickup-time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const t = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
                          return <option key={t}>{t}</option>
                        })}
                      </select>
                    </label>
                  </div>
                  <div className="route-fields">
                    <label className="field">
                      <span>Your service</span>
                      <select
                        aria-label="Your service"
                        name="service"
                        value={service}
                        onChange={(e) => setService(e.target.value)}
                      >
                        {catalog.services.map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name} · {s.duration}h
                          </option>
                        ))}
                      </select>
                    </label>
                    <AddressSearch
                      name="pickup"
                      label="Pick-up location"
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
                      value={destination}
                      place={destinationPlace}
                      onChange={(value, selected) => {
                        setDestination(value)
                        setDestinationPlace(selected)
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
                    <p className="field-note">
                      <ShieldCheck size={14} /> A minimum of two hours' notice,
                      please.
                    </p>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="preferences-fields">
                  <p className="field-section-title extras-title">
                    Make it personal <span>Optional additions</span>
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
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              )}
            </div>
            <div className="form-navigation">
              {step > 0 ? (
                <button
                  type="button"
                  className="text-link"
                  disabled={sending}
                  onClick={() => moveStep(step - 1)}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <span>
                  <LockKeyhole size={12} /> Your details stay private.
                </span>
              )}
              <span>STEP 0{step + 1} OF 03</span>
            </div>
          </div>
          <aside className="journey-summary">
            <div className="summary-heading">
              <span className="eyebrow">YOUR JOURNEY, AT A GLANCE</span>
            </div>
            <VehicleCarousel
              value={vehicle}
              onChange={setVehicle}
              availability={availability}
            />
            <div className="summary-lines">
              <div>
                <span>
                  <CalendarDays size={13} /> {displayDate(date)}
                </span>
                <span>{time} KST</span>
              </div>
              <div>
                <span>{currentService.name}</span>
                <span>{money(currentService.price)}</span>
              </div>
              <div>
                <span>{currentVehicle.name}</span>
                <span>
                  {currentVehicle.surcharge > 0
                    ? `+${money(currentVehicle.surcharge)}`
                    : 'Included'}
                </span>
              </div>
              {catalog.options
                .filter((o) => options.includes(o.id))
                .map((o) => (
                  <div key={o.id}>
                    <span>{o.name}</span>
                    <span>{money(o.price)}</span>
                  </div>
                ))}
            </div>
            <div className="summary-total">
              <div>
                <span>Estimated total</span>
                <small>
                  KRW · approx. {moneyUsd(total, usdRate)} USD (incl. taxes)
                </small>
              </div>
              <strong className="lining-price">
                <span className="currency-symbol">₩</span>
                <span>{total.toLocaleString()}</span>
              </strong>
            </div>
            <p className="availability-note" aria-live="polite">
              {checking ? (
                <>
                  <LoaderCircle size={12} className="spin" /> Checking your
                  date…
                </>
              ) : availability[vehicle] === false ? (
                <>
                  <X size={12} /> Choose another vehicle or time
                </>
              ) : (
                <>
                  <Check size={12} /> Available for instant request
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
            <button
              type="submit"
              className="button gold-button booking-submit"
              disabled={sending || checking || availability[vehicle] === false}
            >
              {sending ? (
                <>
                  Saving your request{' '}
                  <LoaderCircle size={16} className="spin" />
                </>
              ) : step === 2 ? (
                <>
                  Request your journey <ArrowUpRight size={17} />
                </>
              ) : (
                <>
                  Continue your journey <ArrowRight size={17} />
                </>
              )}
            </button>
            <p className="no-payment">
              No upfront payment required · Subject to confirmation
            </p>
          </aside>
        </form>
      )}
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

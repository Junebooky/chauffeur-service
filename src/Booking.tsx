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
  addDays,
  displayDate,
  journeyDates,
  money,
  seoulDate,
  tomorrow,
} from './utils'

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
  }[]
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
}: Props) {
  const [step, setStep] = useState(0)
  const [date, setDate] = useState(tomorrow)
  const [multiDay, setMultiDay] = useState(false)
  const [endDate, setEndDate] = useState(() => addDays(tomorrow(), 1))
  const [dailyVehicles, setDailyVehicles] = useState(false)
  const [vehiclesByDate, setVehiclesByDate] = useState<Record<string, string>>(
    {},
  )
  const [editingDate, setEditingDate] = useState('')
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
  const currentService = catalog.services.find((s) => s.id === service)!
  const lastDate = multiDay ? (endDate >= date ? endDate : date) : date
  const dates = journeyDates(date, lastDate)
  const customVehicles = multiDay && dailyVehicles
  const journeys = dates.map((day) => ({
    date: day,
    vehicle: customVehicles ? vehiclesByDate[day] || vehicle : vehicle,
  }))
  const activeDate =
    customVehicles && dates.includes(editingDate) ? editingDate : date
  const activeVehicle = journeys.find((day) => day.date === activeDate)!.vehicle
  const firstVehicle = catalog.vehicles.find(
    (v) => v.id === journeys[0].vehicle,
  )!
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
  const total =
    (currentService.price + extras) * dates.length + vehicleSurcharges
  const allAvailable = journeys.every(
    (day) => availability[day.date]?.[day.vehicle] === true,
  )
  const unavailableDay = journeys.find(
    (day) => availability[day.date]?.[day.vehicle] === false,
  )
  const changeVehicle = (value: string) => {
    if (customVehicles)
      setVehiclesByDate((previous) => ({ ...previous, [activeDate]: value }))
    else setVehicle(value)
  }
  const changeDate = (value: string) => {
    setDate(value)
    if (endDate < value) setEndDate(value)
  }

  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setAvailability({})
    setError('')
    fetch(
      `/api/availability?${new URLSearchParams({ date, endDate: lastDate, time, service })}`,
      {
        signal: controller.signal,
      },
    )
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
  }, [date, lastDate, time, service, availabilityVersion])
  useEffect(() => {
    if (result) successHeading.current?.focus()
  }, [result])

  const moveStep = (target: number) => {
    if (target > step && !form.current?.reportValidity()) return
    if (target > step && step === 1 && !allAvailable) {
      setError(
        unavailableDay
          ? `Please choose another vehicle for ${displayDate(unavailableDay.date)}.`
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
          date,
          time,
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
          `LOCATION:${escape(pickup)}`,
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
            {result.journeys.map((day) => (
              <span key={day.date}>
                {displayDate(day.date)} · {day.time} KST · {day.vehicle}
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
                    <Calendar value={date} onChange={changeDate} />
                    <div className="multi-day-control">
                      <label className="multi-day-toggle">
                        <input
                          type="checkbox"
                          checked={multiDay}
                          onChange={(event) => {
                            setMultiDay(event.target.checked)
                            if (endDate <= date)
                              setEndDate(
                                addDays(date, 1) <= addDays(seoulDate(), 365)
                                  ? addDays(date, 1)
                                  : date,
                              )
                          }}
                        />
                        <span>Travel over multiple days</span>
                      </label>
                      {multiDay && (
                        <label className="field last-day-field">
                          <span>
                            Last day{' '}
                            <small>
                              {dates.length}{' '}
                              {dates.length === 1 ? 'day' : 'days'}, including
                              your first day
                            </small>
                          </span>
                          <input
                            type="date"
                            name="end-date"
                            aria-label="Last day"
                            required
                            min={date}
                            max={addDays(seoulDate(), 365)}
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                          />
                        </label>
                      )}
                    </div>
                    <label className="field time-field">
                      <span>
                        <Clock3 size={13} /> Pickup time
                      </span>
                      <select
                        aria-label="Pickup time"
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
                    {multiDay && (
                      <p className="field-note multi-day-note">
                        Your pickup time, service and route apply each day. You
                        can choose a different vehicle for each date in the next
                        step.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="preferences-fields">
                  <p className="field-section-title">Select your collection</p>
                  {multiDay && dates.length > 1 && (
                    <>
                      <fieldset className="vehicle-mode">
                        <legend>
                          Vehicles for your {dates.length}-day journey
                        </legend>
                        <label>
                          <input
                            type="radio"
                            name="vehicle-mode"
                            value="same"
                            checked={!dailyVehicles}
                            onChange={() => setDailyVehicles(false)}
                          />
                          <span>Same vehicle every day</span>
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="vehicle-mode"
                            value="daily"
                            checked={dailyVehicles}
                            onChange={() => setDailyVehicles(true)}
                          />
                          <span>Choose a vehicle by date</span>
                        </label>
                      </fieldset>
                      {dailyVehicles && (
                        <div className="daily-vehicle-picker">
                          <p>Select a day, then choose its vehicle below.</p>
                          <div
                            className="daily-vehicle-list"
                            role="group"
                            aria-label="Daily vehicle selections"
                          >
                            {journeys.map((day, index) => {
                              const selected = catalog.vehicles.find(
                                (v) => v.id === day.vehicle,
                              )!
                              const available =
                                availability[day.date]?.[day.vehicle]
                              return (
                                <button
                                  key={day.date}
                                  type="button"
                                  className={`daily-vehicle-day ${activeDate === day.date ? 'active' : ''}`}
                                  aria-pressed={activeDate === day.date}
                                  onClick={() => setEditingDate(day.date)}
                                >
                                  <span>
                                    Day {index + 1}
                                    <small>{displayDate(day.date)}</small>
                                  </span>
                                  <span>
                                    {selected.name}
                                    <small
                                      className={
                                        available === false
                                          ? 'day-unavailable'
                                          : ''
                                      }
                                    >
                                      {available === false
                                        ? 'Unavailable — choose another'
                                        : checking
                                          ? 'Checking…'
                                          : 'Select vehicle'}
                                    </small>
                                  </span>
                                  <ChevronRight size={14} />
                                </button>
                              )
                            })}
                          </div>
                          <p className="editing-day" aria-live="polite">
                            Choosing for {displayDate(activeDate)}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <VehicleCarousel
                    value={activeVehicle}
                    onChange={changeVehicle}
                    availability={availability[activeDate] || {}}
                  />
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
              <span className="mini-star">✦</span>
            </div>
            <div className="summary-car">
              <div
                className={`summary-fleet-art art-${firstVehicle.id}`}
                role="img"
                aria-label={firstVehicle.model}
              />
              <span>
                {customVehicles && dates.length > 1
                  ? 'Your daily collection'
                  : firstVehicle.name}
              </span>
              <small>
                {customVehicles && dates.length > 1
                  ? `${dates.length} days · selected individually`
                  : firstVehicle.model}
              </small>
            </div>
            <div className="summary-lines">
              <div>
                <span>
                  <CalendarDays size={13} /> {displayDate(date)}
                </span>
                <span>{time} KST</span>
              </div>
              {dates.length > 1 && (
                <div>
                  <span>Through {displayDate(lastDate)}</span>
                  <span>{dates.length} days</span>
                </div>
              )}
              {dates.length > 1 && (
                <div className="summary-daily-vehicles">
                  {journeys.map((day, index) => (
                    <div key={day.date}>
                      <span>
                        Day {index + 1} · {displayDate(day.date)}
                      </span>
                      <span>
                        {
                          catalog.vehicles.find((v) => v.id === day.vehicle)!
                            .name
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <span>
                  {currentService.name}
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
                <small className="tax-notice">KRW · TAX excluded</small>
              </div>
              <strong className={quoteRequired ? 'quote-on-request' : ''}>
                {quoteRequired ? 'Quote on request' : money(total)}
              </strong>
            </div>
            {quoteRequired && (
              <p className="quote-note">
                Sprinter pricing requires a separate quote. TAX is not included.
              </p>
            )}
            <p className="availability-note" aria-live="polite">
              {checking ? (
                <>
                  <LoaderCircle size={12} className="spin" /> Checking your
                  {dates.length > 1 ? 'dates…' : 'date…'}
                </>
              ) : unavailableDay ? (
                <>
                  <X size={12} />{' '}
                  {dates.length > 1
                    ? `Vehicle unavailable on ${displayDate(unavailableDay.date)}`
                    : 'Choose another vehicle or time'}
                </>
              ) : allAvailable ? (
                <>
                  <Check size={12} />{' '}
                  {dates.length > 1
                    ? 'All daily slots open for a request'
                    : 'Time slot open for a request'}
                </>
              ) : (
                <>
                  <Clock3 size={12} /> Availability check required
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
            <p className="no-payment">No payment now. Confirmation required.</p>
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

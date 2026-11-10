import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import Hero from './Hero'
import FleetSection from './FleetSection'
import Booking from './Booking'
import { resetGlassPointer, trackGlassPointer } from './liquidGlass'
import { useJourneyScroll } from './useJourneyScroll'
import catalog from './catalog.json'
import { DEFAULT_USD_RATE, moneyUsd } from './utils'

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Chauffeur home">
      <svg
        className="brand-mark"
        width="49"
        height="37"
        viewBox="0 0 60 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m7 15 13 5M3 20l17 5M10 26l12 3m31-14-13 5m17 0-17 5m10 1-12 3M34 12a13 13 0 1 0 4 19"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M30 7v31m-7-32 2 4h10l2-4-4 2-3-5-3 5-4-2Z"
          stroke="currentColor"
          strokeWidth="1.1"
        />
      </svg>
      <span>
        CHAUFFEUR<small>PRIVATE TRAVEL, PERFECTED</small>
      </span>
    </button>
  )
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    else if (!open && ref.current?.open) ref.current?.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="info-dialog"
      onClose={onClose}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-content">
        <button
          onClick={onClose}
          className="icon-button dialog-close"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <p className="eyebrow">THE CHAUFFEUR STANDARD</p>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}

export default function App() {
  const { scrollRef, active, reducedMotion, goTo } = useJourneyScroll()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [modal, setModal] = useState<'contact' | 'privacy' | null>(null)
  const [service, setService] = useState('hourly')
  const [vehicle, setVehicle] = useState('staria')
  const [usdRate, setUsdRate] = useState<number>(DEFAULT_USD_RATE)
  const nav = (index: number) => {
    goTo(index)
    setMobileMenu(false)
    scrollRef.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    fetch('/api/rates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.rate && typeof data.rate === 'number') {
          setUsdRate(data.rate)
        }
      })
      .catch(() => { })
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenu(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <a
        className="skip-link"
        href="#reservation"
        onClick={(e) => {
          e.preventDefault()
          nav(3)
        }}
      >
        Skip to reservation
      </a>
      <header className={`site-header ${active > 0 ? 'header-solid' : ''}`}>
        <Brand onClick={() => nav(0)} />
        <nav className="desktop-nav" aria-label="Main navigation">
          <button
            className={active === 1 ? 'active' : ''}
            onClick={() => nav(1)}
          >
            The collection
          </button>
          <button
            className={active === 2 ? 'active' : ''}
            onClick={() => nav(2)}
          >
            Our services
          </button>
          <button
            className={active === 3 ? 'active' : ''}
            onClick={() => nav(3)}
          >
            Your journey
          </button>
          <button onClick={() => setModal('contact')}>
            Concierge <ArrowUpRight size={11} />
          </button>
        </nav>
        <div className="header-actions">
          <span className="language">
            <Globe2 size={13} /> EN
          </span>
          <button className="header-book"
            data-liquid-glass="control"
            onPointerMove={trackGlassPointer}
            onPointerLeave={resetGlassPointer}
            onClick={() => nav(3)}>
            Reserve your journey <ArrowUpRight size={14} />
          </button>
          <button
            className="icon-button mobile-menu-toggle"
            aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenu}
            aria-controls="mobile-nav"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>
      {mobileMenu && (
        <nav
          id="mobile-nav"
          className="mobile-nav"
          aria-label="Mobile navigation"
        >
          <button onClick={() => nav(0)}>
            The welcome <span>01</span>
          </button>
          <button onClick={() => nav(1)}>
            The collection <span>02</span>
          </button>
          <button onClick={() => nav(2)}>
            Our services <span>03</span>
          </button>
          <button onClick={() => nav(3)}>
            Your journey <span>04</span>
          </button>
          <button
            onClick={() => {
              setModal('contact')
              setMobileMenu(false)
            }}
          >
            Concierge <ArrowUpRight size={20} />
          </button>
        </nav>
      )}
      <main
        ref={scrollRef}
        className="journey-scroll"
        tabIndex={-1}
        aria-label="Chauffeur experience"
      >
        <Hero reducedMotion={reducedMotion} goTo={nav} />
        <FleetSection goTo={nav} onSelectVehicle={setVehicle} />
        <section
          id="services"
          className="screen services-screen"
          aria-labelledby="services-title"
        >
          <div className="section-topline">
            <span className="eyebrow">
              <span className="gold-line" /> HOWEVER YOUR DAY UNFOLDS
            </span>
            <span className="section-numeral">03 / OUR SERVICES</span>
          </div>
          <div className="section-heading services-heading">
            <h2 id="services-title">
              Extraordinary service.
              <br />
              <em>Perfectly simple.</em>
            </h2>
            <p>
              One exceptional standard.
              <br />
              Three ways to make it yours.
            </p>
          </div>
          <div className="service-cards">
            {catalog.services.map((s, i) => (
              <article
                key={s.id}
                className={`service-card ${s.id === 'hourly' ? 'featured' : ''}`}
              >
                {s.id === 'hourly' && (
                  <span className="popular-label">
                    <span className="live-dot" /> THE SIGNATURE EXPERIENCE
                  </span>
                )}
                <div className="service-card-top">
                  <span className="service-number">0{i + 1}</span>
                  {s.id === 'airport' ? (
                    <ArrowUpRight size={24} strokeWidth={1} />
                  ) : s.id === 'hourly' ? (
                    <Clock3 size={24} strokeWidth={1} />
                  ) : (
                    <Sparkles size={24} strokeWidth={1} />
                  )}
                </div>
                <p className="service-eyebrow">{s.eyebrow}</p>
                <h3>{s.name}</h3>
                <p className="service-description">{s.description}</p>
                <div className="service-price">
                  <span className="price-from">FROM</span>
                  <strong className="lining-price">
                    <span className="currency-symbol">₩</span>
                    <span>{s.price.toLocaleString()}</span>
                  </strong>
                  <span>
                    / {s.unit} · approx. {moneyUsd(s.price, usdRate)} USD
                  </span>
                </div>
                <p className="service-tax-notice">TAX excluded</p>
                <ul>
                  {s.features.map((feature) => (
                    <li key={feature}>
                      <Check size={13} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={`button ${s.id === 'hourly' ? 'gold-button' : 'outline-button'}`}
                  data-liquid-glass="control"
                  onPointerMove={trackGlassPointer}
                  onPointerLeave={resetGlassPointer}
                  onClick={() => {
                    setService(s.id)
                    nav(3)
                  }}
                >
                  Choose your journey <ArrowUpRight size={16} />
                </button>
              </article>
            ))}
          </div>
          <div className="services-footnote">
            <span>Standard Executive rates · KRW · TAX excluded</span>
            <span>
              Thoughtful extras. Always transparent. <ChevronDown size={12} />
            </span>
          </div>
        </section>
        <Booking
          service={service}
          setService={setService}
          vehicle={vehicle}
          setVehicle={setVehicle}
          usdRate={usdRate}
          showPrivacy={() => setModal('privacy')}
        />
      </main>
      <aside className="section-rail" aria-label="Page sections">
        {['The welcome', 'The collection', 'Our services', 'Your journey'].map(
          (label, i) => (
            <button
              className={active === i ? 'active' : ''}
              key={label}
              onClick={() => nav(i)}
              aria-label={label}
              aria-current={active === i ? 'location' : undefined}
            >
              <span>{`0${i + 1}`}</span>
              <i />
            </button>
          ),
        )}
      </aside>
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === 'contact' ? 'At your service.' : 'A note on your journey.'
        }
      >
        {modal === 'contact' ? (
          <>
            <p>
              For an airport arrival, a considered day in the city, or something
              entirely your own, start with a few journey details.
            </p>
            <div className="concierge-detail">
              <Clock3 size={19} />
              <div>
                Private travel in Seoul
                <small>
                  All journey times are Korean Standard Time (UTC+9).
                </small>
              </div>
            </div>
            <div className="concierge-detail">
              <ShieldCheck size={19} />
              <div>
                A personal request, thoughtfully prepared
                <small>
                  Reservations are subject to vehicle and chauffeur
                  confirmation.
                </small>
              </div>
            </div>
            <p className="dialog-note">
              The online request service is available here. Live concierge
              messaging and email delivery have not been connected.
            </p>
            <button
              className="button gold-button"
              onClick={() => {
                setModal(null)
                nav(3)
              }}
            >
              Tell us about your journey <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <h3>Reservation requests</h3>
            <p>
              Submitting the form saves a pending request. It does not confirm a
              vehicle, assign a driver, or take payment. Prices are illustrative
              service rates in Korean won. All displayed prices exclude TAX; any
              applicable tax is additional. Vehicle images are representative;
              the final model must be confirmed separately.
            </p>
            <h3>Your details</h3>
            <p>
              Your name, email, phone number, preferred contact app, messenger
              details, route, and daily vehicle preferences are stored in this
              application's local reservation database. They are not sent to an
              operator or an email service. Please use sample details while
              evaluating this site.
            </p>
            <h3>Availability & changes</h3>
            <p>
              Availability reflects requests held in this local system, not a
              live fleet feed. Overlapping requests for the same vehicle class
              are prevented. Allow at least two hours before departure. Online
              cancellation, payment, and operator confirmation are not
              connected.
            </p>
            <h3>Finding your address</h3>
            <p>
              When live address search is enabled, your search text is sent to
              Google Maps to find locations in South Korea. Popular-location
              search is handled locally. Selected addresses and building-level
              coordinates are saved with your request; confirm the exact meeting
              point with your chauffeur. Google Maps use is subject to the{' '}
              <a
                href="https://maps.google.com/help/terms_maps/"
                target="_blank"
                rel="noreferrer"
              >
                Google Maps terms
              </a>{' '}
              and{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Google Privacy Policy
              </a>
              .
            </p>
          </>
        )}
      </Modal>
    </>
  )
}

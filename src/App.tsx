import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Globe2,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import Hero from './Hero'
import FleetSection from './FleetSection'
import PricingSection from './PricingSection'
import Booking from './Booking'
import { customQuoteEmail, OPERATOR_EMAIL } from './contact'
import { useJourneyScroll } from './useJourneyScroll'
import { DEFAULT_USD_RATE } from './utils'

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="brand"
      onClick={onClick}
      aria-label="Chauffeur home"
    >
      <img
        className="brand-mark"
        src="/media/brand/chauffeur-mark.png"
        alt=""
        width={38}
        height={38}
        draggable={false}
      />
      <span className="brand-lockup">
        <span className="brand-wordmark">CHAUFFEUR</span>
        <small className="brand-byline">Team of Premium Chauffeur Service</small>
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
  const [service, setService] = useState('airport')
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
      <header className="site-header">
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
        <PricingSection
          onSelectService={setService}
          goTo={nav}
          usdRate={usdRate}
        />
        <Booking
          service={service}
          setService={setService}
          vehicle={vehicle}
          setVehicle={setVehicle}
          usdRate={usdRate}
          showPrivacy={() => setModal('privacy')}
          onRequestCustom={() => { window.location.href = customQuoteEmail() }}
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
              For a custom itinerary, send us an email directly. Online reservation
              requests are saved pending confirmation; delivery requires a configured mail service.
            </p>
            <a className="button gold-button" href={customQuoteEmail()}>
              Email {OPERATOR_EMAIL} <ArrowRight size={16} />
            </a>
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

import { useLocale } from './i18n/provider'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Globe2,
  Menu,
  X,
} from 'lucide-react'
import Hero from './Hero'
import FleetSection from './FleetSection'
import PricingSection from './PricingSection'
import Booking from './Booking'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import { customQuoteEmail, OPERATOR_EMAIL } from './contact'
import { useJourneyScroll } from './useJourneyScroll'
import { DEFAULT_USD_RATE } from './utils'
import { trackCtaClick, trackSectionView } from './analytics.mjs'

const SECTION_IDS = ['welcome', 'collection', 'services', 'reservation'] as const

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
        src="/media/brand/logo_brand.webp"
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
          type="button"
          onClick={onClose}
          className="icon-button dialog-close"
          aria-label="Close dialog"
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <SectionEyebrow className="dialog-eyebrow">
          THE CHAUFFEUR STANDARD
        </SectionEyebrow>
        <DisplayHeading as="h2" id="dialog-title">{title}</DisplayHeading>
        {children}
      </div>
    </dialog>
  )
}

export default function App() {
  const { locale, setLocale, t } = useLocale()
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
    if (window.location.hash === '#reservation') {
      const frame = requestAnimationFrame(() => goTo(3))
      return () => cancelAnimationFrame(frame)
    }
  }, [goTo])
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
  useEffect(() => {
    const id = SECTION_IDS[active]
    if (id) trackSectionView(id, locale)
  }, [active, locale])

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
        {t("Skip to reservation")}
      </a>
      <header className="site-header">
        <Brand onClick={() => nav(0)} />
        <nav className="desktop-nav" aria-label="Main navigation">
          <button
            className={active === 1 ? 'active' : ''}
            onClick={() => nav(1)}
          >
            {t("The collection")}
          </button>
          <button
            className={active === 2 ? 'active' : ''}
            onClick={() => nav(2)}
          >
            {t("Our services")}
          </button>
          <button
            className={active === 3 ? 'active' : ''}
            onClick={() => nav(3)}
          >
            {t("Your journey")}
          </button>
          <button onClick={() => { trackCtaClick('concierge_open', 'header'); setModal('contact') }}>
            {t("Concierge")} <ArrowUpRight size={11} />
          </button>
        </nav>
        <div className="header-actions">
          <button type="button" className="language language-switcher" aria-label={locale === 'en' ? 'Switch to Korean' : '영어로 전환'} onClick={() => setLocale(locale === 'en' ? 'ko' : 'en')}>
            <Globe2 size={13} /> {locale.toUpperCase()}
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
        <>
          <div
            className="mobile-nav-backdrop"
            aria-hidden="true"
            onClick={() => setMobileMenu(false)}
          />
          <nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            <button
              className={active === 0 ? 'active' : ''}
              aria-current={active === 0 ? 'location' : undefined}
              onClick={() => nav(0)}
            >
              {t("The welcome")} <span>01</span>
            </button>
            <button
              className={active === 1 ? 'active' : ''}
              aria-current={active === 1 ? 'location' : undefined}
              onClick={() => nav(1)}
            >
              {t("The collection")} <span>02</span>
            </button>
            <button
              className={active === 2 ? 'active' : ''}
              aria-current={active === 2 ? 'location' : undefined}
              onClick={() => nav(2)}
            >
              {t("Our services")} <span>03</span>
            </button>
            <button
              className={active === 3 ? 'active' : ''}
              aria-current={active === 3 ? 'location' : undefined}
              onClick={() => nav(3)}
            >
              {t("Your journey")} <span>04</span>
            </button>
            <button
              onClick={() => {
                trackCtaClick('concierge_open', 'mobile_nav')
                setModal('contact')
                setMobileMenu(false)
              }}
            >
              {t("Concierge")} <ArrowUpRight size={20} />
            </button>
            <button type="button" className="mobile-language-switch" onClick={() => { setLocale(locale === 'en' ? 'ko' : 'en'); setMobileMenu(false) }}>
              {locale === 'en' ? '한국어' : 'English'} <span>{locale === 'en' ? 'KO' : 'EN'}</span>
            </button>
          </nav>
        </>
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
              aria-label={t(label)}
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
          modal === 'contact' ? t("Contact our team.") : t("Reservation & privacy.")
        }
      >
        {modal === 'contact' ? (
          <>
            <p className="dialog-contact-intro">
              {t("Planning something beyond our standard services? Email us your dates and itinerary. We'll help with the details.")}
            </p>
            <div className="dialog-contact-card">
              <small>{t("DIRECT CONTACT")}</small>
              <strong>{OPERATOR_EMAIL}</strong>
              <span>{t("Custom journeys · Private transfers · Special requests")}</span>
            </div>
            <p className="dialog-note">
              {t("All journey requests are subject to confirmation. No upfront payment is taken.")}
            </p>
            <a
              className="button gold-button"
              href={customQuoteEmail()}
              onClick={() => trackCtaClick('concierge_email', 'concierge_modal')}
            >
              {t("Write an email")} <ArrowRight size={16} aria-hidden="true" />
            </a>
          </>
        ) : (
          <div className="dialog-policy-list">
            <section className="dialog-policy-section" aria-labelledby="privacy-status">
              <h3 id="privacy-status">{t("Reservation status")}</h3>
              <p>
                {t("Your request is pending until we confirm the vehicle and chauffeur. No payment is taken online. Prices are in KRW and exclude tax.")}
              </p>
            </section>
            <section className="dialog-policy-section" aria-labelledby="privacy-information">
              <h3 id="privacy-information">{t("Your information")}</h3>
              <p>
                {t("When online booking is available, we store your contact details, itinerary and vehicle choices to manage your request. An email notification is sent to our operator when email delivery is configured. An email enquiry opens your mail app and is only sent when you send it.")}
              </p>
            </section>
            <section className="dialog-policy-section" aria-labelledby="privacy-availability">
              <h3 id="privacy-availability">{t("Availability & changes")}</h3>
              <p>
                {t("Vehicle availability is indicative, not a live fleet guarantee. Final arrangements are confirmed by our team. Online cancellation and payment are not currently available.")}
              </p>
            </section>
            <section className="dialog-policy-section" aria-labelledby="privacy-places">
              <h3 id="privacy-places">{t("Addresses & maps")}</h3>
              <p>
                {t("Live place searches use Google Maps when enabled. Selected locations are used to plan your journey. Please confirm the exact meeting point with your chauffeur. See")}{' '}
                <a
                  href="https://maps.google.com/help/terms_maps/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Maps Terms
                </a>{' '}
                and{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google's Privacy Policy
                </a>.
              </p>
            </section>
          </div>
        )}
      </Modal>
    </>
  )
}

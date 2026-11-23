import catalog from './catalog.json'
import { money } from './utils'
import { customQuoteEmail } from './contact'
import SectionEyebrow from './components/ui/SectionEyebrow'

type PricingSectionProps = {
  onSelectService: (serviceId: string) => void
  goTo: (index: number) => void
  usdRate?: number
}

const airportService = catalog.services.find((service) => service.id === 'airport')!
const scheduleService = catalog.services.find((service) => service.id === 'day')!

/** Vehicle surcharges are defined once in catalog.json and shared with Booking. */
const PRICE_TIERS = [
  {
    id: 'standard',
    label: 'Carnival · Staria',
    category: 'STANDARD FLEET',
    representativeVehicleId: 'carnival_limousine',
  },
  {
    id: 'premium',
    label: 'Genesis G90 · Mercedes-Benz Sprinter',
    category: 'PREMIUM FLEET',
    representativeVehicleId: 'g90',
  },
] as const

function priceForTier(serviceId: 'airport' | 'day', vehicleId: string) {
  const service = catalog.services.find((item) => item.id === serviceId)
  const vehicle = catalog.vehicles.find((item) => item.id === vehicleId)
  if (!service || !vehicle) return null
  return service.price + vehicle.surcharge
}

const PRICING_PLANS = [
  {
    id: 'pickup',
    serviceId: 'airport',
    lines: ['Pick-up', 'Service'] as const,
    image: '/media/price/price_airport.png',
    alt: 'Private jet parked on an illuminated runway at night',
    eyebrow: `SERVICE · ${airportService.unit.toUpperCase()}`,
    subtitle: 'Airport arrivals & departures',
  },
  {
    id: 'schedule',
    serviceId: 'day',
    lines: ['Schedule', 'Service'] as const,
    image: '/media/price/price_full.png',
    alt: 'Scenic mountain highway at sunset',
    eyebrow: `SERVICE · ${scheduleService.unit.toUpperCase()}`,
    subtitle: 'Dedicated service for your schedule',
  },
  {
    id: 'custom',
    serviceId: null,
    lines: ['Custom'] as const,
    image: '/media/price/price_custom.png',
    alt: 'Illuminated luxury hotel entrance at night',
    eyebrow: 'BESPOKE ITINERARY',
    subtitle: 'Tailored to your plans',
  },
] as const

const BEAM_GRADIENT =
  'bg-[conic-gradient(from_0deg,transparent_0deg,transparent_58deg,rgba(246,234,216,0.25)_72deg,rgba(255,250,242,0.92)_86deg,#ffffff_90deg,rgba(255,250,242,0.92)_94deg,rgba(246,234,216,0.25)_108deg,transparent_122deg,transparent_238deg,rgba(246,234,216,0.25)_252deg,rgba(255,250,242,0.92)_266deg,#ffffff_270deg,rgba(255,250,242,0.92)_274deg,rgba(246,234,216,0.25)_288deg,transparent_302deg,transparent_360deg)]'

const BEAM_MASK_STYLE = {
  WebkitMask:
    'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  maskComposite: 'exclude',
} as const

export default function PricingSection({
  onSelectService,
  goTo,
}: PricingSectionProps) {
  const navigateToReservation = (serviceId: 'airport' | 'day' | null) => {
    if (serviceId === null) {
      window.location.href = customQuoteEmail()
      return
    }
    onSelectService(serviceId)
    goTo(3)
  }

  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="relative flex min-h-dvh w-full snap-start snap-always flex-col overflow-hidden bg-[#050608] px-[clamp(20px,4.5vw,84px)] pt-[calc(var(--header)+24px)] pb-14 antialiased select-none lg:h-dvh lg:pb-0"
    >
      {/* Full-bleed architectural lighting background */}
      <img
        src="/media/price/bg_price.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center brightness-115 contrast-105"
      />

      {/* Content Wrapper */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1380px] flex-1 flex-col gap-9 lg:gap-0">
        {/* Section Header positioned higher up */}
        <div className="pl-1">
          <div className="mb-3.5">
            <SectionEyebrow linePosition="after">PRICING PLANS</SectionEyebrow>
          </div>
          <h2
            id="services-title"
            className="!m-0 !font-sans !text-[clamp(34px,3.6vw,56px)] !font-thin !tracking-[-0.018em] !leading-[1.1] !text-[#f4f5f7]"
          >
            Tailored Chauffeur Services
          </h2>
          <p className="!mt-3 !font-sans !text-[clamp(12.5px,1.04vw,16px)] !font-extralight !tracking-[0.01em] !text-[#d1d5db]/85">
            Choose a pick-up, plan your schedule, or tell us what you have in mind.
          </p>
        </div>

        {/* Three equally sized editorial cards; stacked on smaller screens. */}
        <div className="grid w-full grid-cols-1 gap-5 lg:my-auto lg:grid-cols-3 lg:gap-7 xl:gap-8">
          {PRICING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="group relative flex h-[clamp(400px,49vh,525px)] flex-col justify-between rounded-[18px] border border-[#e5dfd5]/35 bg-[#050608] shadow-[0_26px_60px_rgba(0,0,0,0.84),inset_0_1px_0_rgba(255,250,242,0.26)] transition-all duration-300 hover:-translate-y-1 hover:border-[#f4f5f7]/30 focus-within:-translate-y-1 focus-within:border-[#f4f5f7]/40"
            >
              {/* Clockwise Border Beam Halo (subtle soft bloom on hover/focus) */}
              <span
                aria-hidden="true"
                style={BEAM_MASK_STYLE}
                className="pointer-events-none absolute -inset-[1px] z-20 overflow-hidden rounded-[19px] p-[1.5px] opacity-0 blur-[2px] transition-opacity duration-300 group-hover:opacity-45 group-focus-within:opacity-45"
              >
                <span
                  className={`absolute top-1/2 left-1/2 aspect-square w-[260%] motion-safe:animate-border-beam ${BEAM_GRADIENT}`}
                />
              </span>

              {/* Clockwise Border Beam Crisp 1px Ring (on hover/focus) */}
              <span
                aria-hidden="true"
                style={BEAM_MASK_STYLE}
                className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[18px] p-[1px] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <span
                  className={`absolute top-1/2 left-1/2 aspect-square w-[260%] motion-safe:animate-border-beam ${BEAM_GRADIENT}`}
                />
              </span>

              {/* Clipped Card Interior */}
              <div className="relative flex h-full w-full flex-col justify-between overflow-clip rounded-[17px]">
                <img
                  src={plan.image}
                  alt={plan.alt}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[79%] w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />

                {/* Seamless gradient fade between the top #050608 header area and the card artwork */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#050608_0%,#050608_21%,rgba(5,6,8,0.78)_34%,rgba(5,6,8,0)_49%)]"
                />

                <header className="relative z-10 px-6 pt-7 sm:px-8 sm:pt-8">
                  <span
                    aria-hidden="true"
                    className="mb-4 block h-px w-8 bg-[#f4f5f7]/80"
                  />
                  <h3 className="!m-0 !font-sans !font-thin">
                    <button
                      type="button"
                      onClick={() => navigateToReservation(plan.serviceId)}
                      className="text-left !font-sans !text-[clamp(22px,2vw,31px)] !font-thin !leading-[1.18] !tracking-[-0.012em] !text-[#f4f5f7] focus-visible:outline-offset-4 focus-visible:outline-white/80"
                    >
                      {plan.lines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </button>
                  </h3>
                </header>

                {/* Hover/focus drawer; on touch devices both rates stay visible. */}
                <div className="pointer-events-auto relative z-10 mt-auto translate-y-full bg-[linear-gradient(180deg,rgba(5,6,8,0)_0%,rgba(5,6,8,0.87)_25%,rgba(5,6,8,0.97)_100%)] px-6 pt-10 pb-6 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:px-8 sm:pb-7 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
                  <div className="border-t border-white/20 pt-4">
                    <span className="block !font-sans text-[10px] !font-normal tracking-[0.2em] text-white/75 uppercase">
                      {plan.eyebrow}
                    </span>
                    {plan.serviceId !== null ? (
                      <>
                        <div className="mt-3 flex flex-col gap-3">
                          {PRICE_TIERS.map((tier) => {
                            const price = priceForTier(
                              plan.serviceId,
                              tier.representativeVehicleId,
                            )
                            return (
                              <div
                                key={tier.id}
                                className="flex items-center justify-between gap-3 border-b border-white/15 pb-3 last:border-b-0 last:pb-0"
                              >
                                <div className="min-w-0">
                                  <p className="!m-0 !font-sans text-[clamp(12px,1vw,14px)] !font-light leading-[1.3] text-white">
                                    {tier.label}
                                  </p>
                                  <span className="mt-1 block !font-sans text-[9px] font-normal tracking-[0.13em] text-white/55">
                                    {tier.category}
                                  </span>
                                </div>
                                <strong className="shrink-0 !font-sans text-[clamp(19px,1.65vw,25px)] !font-extralight tracking-[-0.035em] text-white tabular-nums">
                                  {price === null ? 'Ask for rate' : money(price)}
                                </strong>
                              </div>
                            )
                          })}
                        </div>
                        <p className="!mt-3 !mb-0 !font-sans text-[10.5px] !font-light text-white/70">
                          KRW · TAX excluded
                        </p>
                      </>
                    ) : (
                      <>
                        <strong className="mt-3 block !font-sans text-[clamp(24px,2vw,30px)] !font-extralight tracking-[-0.02em] text-white">
                          Tailored Quote
                        </strong>
                        <p className="!mt-1.5 !mb-0 !font-sans text-[12px] !font-light text-white/75">
                          {plan.subtitle}
                        </p>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => navigateToReservation(plan.serviceId)}
                      aria-label={plan.serviceId === null ? 'Email us for a custom quote' : `Plan your ${plan.lines.join(' ').toLowerCase()} journey`}
                      className="relative z-40 mt-3 inline-flex cursor-pointer items-center gap-1.5 !font-sans text-[11px] !font-light text-white/90 transition-colors hover:text-white hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      {plan.serviceId === null ? 'Email us for a custom quote' : 'Plan your journey'}
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

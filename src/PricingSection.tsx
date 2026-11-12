import catalog from './catalog.json'
import { DEFAULT_USD_RATE, money, moneyUsd } from './utils'

type PricingSectionProps = {
  onSelectService: (serviceId: string) => void
  goTo: (index: number) => void
  usdRate?: number
}

const airportService = catalog.services.find((s) => s.id === 'airport')!
const hourlyService = catalog.services.find((s) => s.id === 'hourly')!
const dayService = catalog.services.find((s) => s.id === 'day')!

const PRICING_PLANS = [
  {
    id: 'airport',
    serviceId: 'airport',
    lines: ['Airport', 'Transfer'] as const,
    image: '/media/price/price_airport.png',
    alt: 'Private jet parked on an illuminated runway at night',
    eyebrow: `FROM · ${airportService.unit.toUpperCase()}`,
    price: airportService.price,
    unit: airportService.unit,
    subtitle: 'Incheon & Gimpo Airport protocol',
  },
  {
    id: 'hourly',
    serviceId: 'hourly',
    lines: ['By the', 'Hour'] as const,
    image: '/media/price/price_hour.png',
    alt: 'Close-up of a luxury minimalist black dial timepiece',
    eyebrow: `FROM · ${hourlyService.unit.toUpperCase()}`,
    price: hourlyService.price,
    unit: hourlyService.unit,
    subtitle: 'Flexible point-to-point charter',
  },
  {
    id: 'day',
    serviceId: 'day',
    lines: ['Full', 'Day'] as const,
    image: '/media/price/price_full.png',
    alt: 'Scenic mountain highway at sunset',
    eyebrow: `FROM · ${dayService.unit.toUpperCase()}`,
    price: dayService.price,
    unit: dayService.unit,
    subtitle: '9 hours dedicated VIP service',
  },
  {
    id: 'custom',
    serviceId: 'day',
    lines: ['Custom'] as const,
    image: '/media/price/price_custom.png',
    alt: 'Illuminated luxury hotel entrance at night',
    eyebrow: 'BESPOKE ITINERARY',
    price: null as number | null,
    unit: 'Tailored schedule',
    subtitle: 'Multi-day & diplomatic protocol',
  },
] as const

export default function PricingSection({
  onSelectService,
  goTo,
  usdRate = DEFAULT_USD_RATE,
}: PricingSectionProps) {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="relative flex h-dvh w-full snap-start snap-always flex-col justify-end overflow-clip bg-[#050608] px-[clamp(24px,4vw,64px)] pt-[clamp(84px,11vh,116px)] pb-[clamp(76px,16.2vh,152px)] antialiased select-none"
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
      <div className="relative z-10 mx-auto flex w-full max-w-[1340px] flex-col">
        {/* Section Header */}
        <div className="mb-8 pl-2">
          <div className="mb-3 flex items-center gap-4">
            <span className="!font-sans text-[10.5px] !font-normal tracking-[0.26em] text-[#e5e7eb]/90 uppercase">
              PRICING PLANS
            </span>
            <span
              aria-hidden="true"
              className="h-px w-9 bg-[#e5e7eb]/65"
            />
          </div>
          <h2
            id="services-title"
            className="!m-0 !font-sans !text-[clamp(30px,3.35vw,48px)] !font-thin !tracking-[-0.018em] !leading-[1.12] !text-[#f4f5f7]"
          >
            Tailored Chauffeur Services
          </h2>
          <p className="!mt-2.5 !font-sans !text-[clamp(12px,0.98vw,14.5px)] !font-extralight !tracking-[0.01em] !text-[#d1d5db]/85">
            Choose the ideal plan for your travel needs, from airport transfers to fully customized service.
          </p>
        </div>

        {/* 4 Pricing Plan Cards */}
        <div className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[18px]">
          {PRICING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="group relative flex h-[clamp(270px,45.5vh,405px)] flex-col justify-between overflow-clip rounded-[18px] border border-[#e5dfd5]/35 bg-[#050608] shadow-[0_24px_56px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,250,242,0.28)] transition-all duration-300 hover:border-[#f4f5f7]/60 focus-within:border-[#f4f5f7]/70"
            >
              <img
                src={plan.image}
                alt={plan.alt}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />

              {/* Seamless gradient fade between the top #050608 header area and the card artwork */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#050608_0%,#050608_22%,rgba(5,6,8,0.78)_35%,rgba(5,6,8,0)_50%)]"
              />

              <header className="relative z-10 px-6 pt-6 sm:px-7 sm:pt-7">
                <span
                  aria-hidden="true"
                  className="mb-3.5 block h-px w-7 bg-[#f4f5f7]/80"
                />
                <h3 className="!m-0 !font-sans !font-thin">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectService(plan.serviceId)
                      goTo(3)
                    }}
                    className="text-left !font-sans !text-[clamp(21px,1.85vw,27px)] !font-thin !leading-[1.2] !tracking-[-0.012em] !text-[#f4f5f7] focus-visible:outline-none after:absolute after:inset-0"
                  >
                    {plan.lines.map((line, idx) => (
                      <span key={line} className="block">
                        {line}
                        {idx < plan.lines.length - 1 ? '' : ''}
                      </span>
                    ))}
                  </button>
                </h3>
              </header>

              {/* Hover / Focus Slide-Up Price Drawer */}
              <div className="pointer-events-none relative z-10 mt-auto translate-y-full bg-[linear-gradient(180deg,rgba(5,6,8,0)_0%,rgba(5,6,8,0.84)_28%,rgba(5,6,8,0.96)_100%)] px-6 pt-12 pb-5 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:px-7 sm:pb-6 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
                <div className="border-t border-white/15 pt-3.5">
                  <span className="block !font-sans text-[9.5px] !font-normal tracking-[0.22em] text-[#d1d5db]/75 uppercase">
                    {plan.eyebrow}
                  </span>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <strong className="!font-sans text-[clamp(22px,1.9vw,29px)] !font-extralight tracking-[-0.02em] text-[#f4f5f7] tabular-nums">
                      {plan.price !== null ? money(plan.price) : 'Tailored Quote'}
                    </strong>
                    <span className="!font-sans text-[11px] !font-light tracking-[0.04em] text-[#f4f5f7]/85">
                      Reserve →
                    </span>
                  </div>
                  <p className="!mt-1 !font-sans text-[10.5px] !font-extralight text-[#9ca3af]">
                    {plan.price !== null
                      ? `KRW · TAX excluded · approx. ${moneyUsd(plan.price, usdRate)} USD`
                      : plan.subtitle}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

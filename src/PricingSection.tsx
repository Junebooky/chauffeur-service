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
  usdRate = DEFAULT_USD_RATE,
}: PricingSectionProps) {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="relative flex h-dvh w-full snap-start snap-always flex-col justify-between overflow-clip bg-[#050608] px-[clamp(28px,4.5vw,84px)] pt-[clamp(78px,9.6vh,126px)] pb-[clamp(66px,12.8vh,148px)] antialiased select-none"
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
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1540px] flex-col justify-between 2xl:max-w-[1720px]">
        {/* Section Header positioned higher up */}
        <div className="pl-1">
          <div className="mb-3.5 flex items-center gap-4">
            <span className="!font-sans text-[11px] !font-normal tracking-[0.26em] text-[#e5e7eb]/90 uppercase">
              PRICING PLANS
            </span>
            <span
              aria-hidden="true"
              className="h-px w-10 bg-[#e5e7eb]/65"
            />
          </div>
          <h2
            id="services-title"
            className="!m-0 !font-sans !text-[clamp(34px,3.6vw,56px)] !font-thin !tracking-[-0.018em] !leading-[1.1] !text-[#f4f5f7]"
          >
            Tailored Chauffeur Services
          </h2>
          <p className="!mt-3 !font-sans !text-[clamp(12.5px,1.04vw,16px)] !font-extralight !tracking-[0.01em] !text-[#d1d5db]/85">
            Choose the ideal plan for your travel needs, from airport transfers to fully customized service.
          </p>
        </div>

        {/* 4 Pricing Plan Cards with wider horizontal gaps & taller stature */}
        <div className="grid w-full grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-7 xl:gap-8 2xl:gap-10">
          {PRICING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="group relative flex h-[clamp(320px,53vh,640px)] flex-col justify-between rounded-[18px] border border-[#e5dfd5]/35 bg-[#050608] shadow-[0_26px_60px_rgba(0,0,0,0.84),inset_0_1px_0_rgba(255,250,242,0.26)] transition-all duration-300 hover:-translate-y-1 hover:border-[#f4f5f7]/30 focus-within:-translate-y-1 focus-within:border-[#f4f5f7]/40"
            >
              {/* Clockwise Border Beam Halo (subtle soft bloom on hover/focus) */}
              <span
                aria-hidden="true"
                style={BEAM_MASK_STYLE}
                className="pointer-events-none absolute -inset-[1px] z-20 overflow-hidden rounded-[19px] p-[1.5px] opacity-0 blur-[2px] transition-opacity duration-300 group-hover:opacity-45 group-focus-within:opacity-45"
              >
                <span
                  className={`absolute top-1/2 left-1/2 aspect-square w-[300%] -translate-x-1/2 -translate-y-1/2 motion-safe:animate-border-beam ${BEAM_GRADIENT}`}
                />
              </span>

              {/* Clockwise Border Beam Crisp 1px Ring (on hover/focus) */}
              <span
                aria-hidden="true"
                style={BEAM_MASK_STYLE}
                className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[18px] p-[1px] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <span
                  className={`absolute top-1/2 left-1/2 aspect-square w-[300%] -translate-x-1/2 -translate-y-1/2 motion-safe:animate-border-beam ${BEAM_GRADIENT}`}
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
                      onClick={() => {
                        onSelectService(plan.serviceId)
                        goTo(3)
                      }}
                      className="text-left !font-sans !text-[clamp(22px,2vw,31px)] !font-thin !leading-[1.18] !tracking-[-0.012em] !text-[#f4f5f7] focus-visible:outline-none after:absolute after:inset-0"
                    >
                      {plan.lines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </button>
                  </h3>
                </header>

                {/* Hover / Focus Slide-Up Price Drawer */}
                <div className="pointer-events-none relative z-10 mt-auto translate-y-full bg-[linear-gradient(180deg,rgba(5,6,8,0)_0%,rgba(5,6,8,0.84)_28%,rgba(5,6,8,0.96)_100%)] px-6 pt-12 pb-6 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:px-8 sm:pb-7 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
                  <div className="border-t border-white/15 pt-4">
                    <span className="block !font-sans text-[9.5px] !font-normal tracking-[0.22em] text-[#d1d5db]/75 uppercase">
                      {plan.eyebrow}
                    </span>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <strong className="!font-sans text-[clamp(23px,2vw,31px)] !font-extralight tracking-[-0.02em] text-[#f4f5f7] tabular-nums">
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
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

type PricingSectionProps = {
  onSelectService: (serviceId: string) => void
  goTo: (index: number) => void
}

const PRICING_PLANS = [
  {
    id: 'airport',
    serviceId: 'airport',
    lines: ['Airport', 'Transfer'] as const,
    image: '/media/price/price_airport.png',
    alt: 'Private jet parked on an illuminated runway at night',
  },
  {
    id: 'hourly',
    serviceId: 'hourly',
    lines: ['By the', 'Hour'] as const,
    image: '/media/price/price_hour.png',
    alt: 'Close-up of a luxury minimalist black dial timepiece',
  },
  {
    id: 'day',
    serviceId: 'day',
    lines: ['Full', 'Day'] as const,
    image: '/media/price/price_full.png',
    alt: 'Scenic mountain highway at sunset',
  },
  {
    id: 'custom',
    serviceId: 'day',
    lines: ['Custom', 'Service'] as const,
    image: '/media/price/price_custom.png',
    alt: 'Illuminated luxury hotel entrance at night',
  },
] as const

export default function PricingSection({
  onSelectService,
  goTo,
}: PricingSectionProps) {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="relative flex h-dvh w-full snap-start snap-always flex-col justify-end overflow-clip bg-[#050608] px-[clamp(24px,3.8vw,58px)] pt-[clamp(88px,11.5vh,124px)] pb-[clamp(68px,15.5vh,148px)] select-none"
    >
      {/* Full-bleed architectural lighting background */}
      <img
        src="/media/price/bg_price.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center brightness-110"
      />

      {/* Content Wrapper */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1350px] flex-col">
        {/* Section Header */}
        <div className="mb-7 pl-2">
          <div className="mb-3 flex items-center gap-4">
            <span className="!font-sans text-[10.5px] font-medium tracking-[0.26em] text-[#e5e7eb]/90 uppercase">
              PRICING PLANS
            </span>
            <span
              aria-hidden="true"
              className="h-px w-9 bg-[#e5e7eb]/65"
            />
          </div>
          <h2
            id="services-title"
            className="!m-0 !font-sans !text-[clamp(30px,3.35vw,48px)] !font-extralight !tracking-[-0.02em] !leading-[1.12] !text-[#f4f5f7]"
          >
            Tailored Chauffeur Services
          </h2>
          <p className="!mt-2.5 !font-sans !text-[clamp(12px,1vw,14.5px)] !font-light !tracking-[0.01em] !text-[#d1d5db]/85">
            Choose the ideal plan for your travel needs, from airport transfers to fully customized service.
          </p>
        </div>

        {/* 4 Pricing Plan Cards */}
        <div className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[18px]">
          {PRICING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="group relative flex h-[clamp(310px,52.5vh,470px)] flex-col justify-start overflow-clip rounded-[18px] border border-[#e5dfd5]/35 bg-[#050608] shadow-[0_24px_56px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,250,242,0.28)] transition-all duration-300 hover:border-[#f4f5f7]/60 focus-within:border-[#f4f5f7]/70"
            >
              <img
                src={plan.image}
                alt={plan.alt}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%] w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />

              {/* Seamless gradient fade between the top #050608 header area and the square card artwork */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#050608_0%,#050608_24%,rgba(5,6,8,0.82)_36%,rgba(5,6,8,0)_50%)]"
              />

              <header className="relative z-10 px-6 pt-6 sm:px-7 sm:pt-7">
                <span
                  aria-hidden="true"
                  className="mb-3.5 block h-[1.5px] w-7 bg-[#f4f5f7]/85"
                />
                <h3 className="!m-0 !font-sans !font-extralight">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectService(plan.serviceId)
                      goTo(3)
                    }}
                    className="text-left !font-sans !text-[clamp(21px,1.85vw,27px)] !font-extralight !leading-[1.2] !tracking-[-0.015em] !text-[#f4f5f7] focus-visible:outline-none after:absolute after:inset-0"
                  >
                    {plan.lines[0]}
                    <br />
                    {plan.lines[1]}
                  </button>
                </h3>
              </header>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

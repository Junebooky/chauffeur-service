import { useState } from 'react'
import { ArrowUpRight, ArrowLeft } from 'lucide-react'

export interface FleetSectionProps {
  goTo: (index: number) => void
  onSelectVehicle: (vehicleId: string) => void
}

interface VehicleInfo {
  id: 'g90' | 'carnival' | 'staria' | 'sprinter319'
  catalogId: string
  name: string
  subName?: string
  brand: string
  classBadge: string
  description: string
  specs: string[]
  bgImage: string
}

const FLEET_DATA: VehicleInfo[] = [
  {
    id: 'g90',
    catalogId: 'g90',
    name: 'Genesis G90',
    brand: 'Genesis',
    classBadge: 'FLAGSHIP LUXURY SEDAN',
    description:
      'Supreme ride refinement and whisper-quiet poise. Designed for executive diplomacy, VIP airport arrivals, and private road travel.',
    specs: [
      'Up to 3 Guests',
      '3.5L Twin-Turbo AWD',
      'VIP Reclining Comfort',
      'Complimentary Wi-Fi',
      'Chilled Mineral Water',
    ],
    bgImage: '/media/car_info/g90_car_info.png',
  },
  {
    id: 'carnival',
    catalogId: 'carnival_limousine',
    name: 'Carnival',
    subName: 'Hi Limousine',
    brand: 'Kia',
    classBadge: 'VIP HI-LIMOUSINE · HYBRID',
    description:
      'Raised roof architecture with premium captain recliners. Delivers exceptional headroom, privacy curtains, and serene traveling comfort for delegations and families.',
    specs: [
      '6 Passengers · Hybrid',
      'Hi-Limousine Raised Roof',
      'VIP Captain Recliners',
      'Air Purifier & Mood Lighting',
      'Complimentary Wi-Fi',
    ],
    bgImage: '/media/car_info/carnival_car_info.png',
  },
  {
    id: 'staria',
    catalogId: 'staria',
    name: 'Staria',
    subName: 'Lounge Limousine',
    brand: 'Hyundai',
    classBadge: 'EXECUTIVE LOUNGE · HYBRID',
    description:
      'Futuristic lounge design with panoramic windows and expansive cabin space. Outstanding accessibility, comfort, and ample luggage volume for any itinerary.',
    specs: [
      '9 Passengers · Hybrid',
      'Executive Lounge Seating',
      'Panoramic Windows',
      '8+ Luggage Capacity',
      'Complimentary Wi-Fi',
    ],
    bgImage: '/media/car_info/staria_car_info.png',
  },
  {
    id: 'sprinter319',
    catalogId: 'sprinter_319',
    name: 'Sprinter 319',
    subName: 'VIP Protocol',
    brand: 'Mercedes-Benz',
    classBadge: 'VIP PROTOCOL HIGH-ROOF COACH',
    description:
      'Full stand-up cabin height with custom leather captain chairs and extended legroom. Built for prestigious corporate delegations, roadshows, and state protocols.',
    specs: [
      '6 Passengers',
      'Full Stand-Up Height',
      'Extended Wheelbase',
      'VIP Conference Layout',
      'High-Capacity Luggage',
    ],
    bgImage: '/media/car_info/319_car_info.png',
  },
]

function BrandLogo({ brand, className }: { brand: string; className?: string }) {
  if (brand === 'Genesis') {
    return (
      <svg
        viewBox="0 0 64 24"
        fill="currentColor"
        className={className}
        aria-label="Genesis logo"
      >
        <path d="M32 5.5c-2.4 0-4.3 1.8-4.8 4.2h-3.8c1.6-1.5 3.5-2.6 5.6-3.1-1.1-1.2-2.7-2-4.5-2-4.8 0-11.2 3.8-18.4 7.5C3.8 13.3 1.2 14.5 0 15c4.8.4 10.8-.6 17.2-2.3 5.4-1.4 10.6-3.3 14.2-4.6-.2.6-.4 1.3-.4 2 0 2.2 1.6 4.1 3.8 4.6v2.2l-2.4 1.2.8 1.4 3.2-1.8 3.2 1.8.8-1.4-2.4-1.2v-2.2c2.2-.5 3.8-2.4 3.8-4.6 0-.7-.2-1.4-.4-2 3.6 1.3 8.8 3.2 14.2 4.6 6.4 1.7 12.4 2.7 17.2 2.3-1.2-.5-3.8-1.7-6.1-2.9-7.2-3.7-13.6-7.5-18.4-7.5-1.8 0-3.4.8-4.5 2 2.1.5 4 1.6 5.6 3.1h-3.8c-.5-2.4-2.4-4.2-4.8-4.2zm0 3.5c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3z" />
      </svg>
    )
  }
  if (brand === 'Kia') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Kia logo"
      >
        <path d="M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z" />
      </svg>
    )
  }
  if (brand === 'Hyundai') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Hyundai logo"
      >
        <path d="M12 18.1622c-6.6275 0-12-2.7586-12-6.163 0-3.4028 5.3725-6.1614 12-6.1614 6.6278 0 12 2.7586 12 6.1614 0 3.4044-5.3722 6.163-12 6.163zM7.6023 7.17C3.701 7.9784.973 9.8302.973 11.9844c0 1.1929.8382 2.2932 2.248 3.1757.1174.0724.1941.0862.251.0826.1019-.006.1593-.0698.201-.146.028-.0485.0631-.1225.0972-.1968.4601-1.0834 2.0776-4.8333 4.2023-7.3758a1.1775 1.1775 0 0 0 .1048-.1461c.046-.084.0356-.1513.0006-.192-.0593-.0647-.2247-.065-.4756-.016zM9.742 8.8995c-1.1728 2.8492 1.0473 2.4961 1.6478 2.3637 1.0203-.2258 1.9944-.6128 2.7746-.925 2.2216-.8887 3.4012-1.7804 3.7925-2.123a1.9839 1.9839 0 0 0 .1076-.0988c.0557-.058.0976-.1192.0976-.2002 0-.0936-.081-.1687-.2374-.2231-.012-.0049-.0517-.021-.0641-.025-1.698-.5415-3.724-.8563-5.9016-.8563-.0168 0-.0586-.0022-.1169 0-.2608.0078-.5509.0664-.787.1888-.7777.4049-1.1163 1.4235-1.313 1.899zm10.5851.0037c-.0268.0487-.0612.1224-.0962.1974-.4599 1.0826-2.0774 4.831-4.2018 7.3733-.0515.063-.0796.1031-.1042.1467-.0492.0846-.0388.1535 0 .1935.0572.0641.2235.0654.474.0157 3.8998-.81 6.628-2.6606 6.628-4.8149 0-1.1925-.836-2.2928-2.2472-3.1745-.1161-.073-.1934-.0871-.25-.083-.1028.0067-.16.0699-.2026.1458zM14.258 15.099c1.173-2.849-1.0483-2.494-1.6467-2.3622-1.0218.225-1.996.613-2.7757.924-2.2226.8883-3.4017 1.782-3.7944 2.1234-.0468.0428-.0833.0742-.1066.0995-.0564.0573-.0967.1178-.0967.2007 0 .0923.08.1688.2362.2229.012.0048.0511.0213.0657.0255 1.696.54 3.722.8557 5.9.8557.0177 0 .0592.0016.1178 0 .2609-.0081.5522-.0677.7871-.1888.7781-.4052 1.1169-1.4234 1.3133-1.9007z" />
      </svg>
    )
  }
  // Mercedes-Benz
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-label="Mercedes-Benz logo"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M12 2.8 L12 12 M12 12 L3.6 16.8 M12 12 L20.4 16.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2.8 L11 11.5 L3.6 16.8 L11.5 12.5 L20.4 16.8 L13 11.5 Z"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  )
}

export default function FleetSection({ goTo, onSelectVehicle }: FleetSectionProps) {
  const [selectedId, setSelectedId] = useState<VehicleInfo['id'] | null>(null)

  const activeVehicle = FLEET_DATA.find((v) => v.id === selectedId) || null

  const handleCardClick = (id: VehicleInfo['id']) => {
    setSelectedId(id)
  }

  const handleBackToOverview = () => {
    setSelectedId(null)
  }

  const handleReserve = (catalogId: string) => {
    onSelectVehicle(catalogId)
    goTo(3)
  }

  return (
    <section
      id="collection"
      className={`screen collection-screen fleet-apple-section ${
        selectedId ? 'is-detail-view' : 'is-overview-view'
      }`}
      aria-labelledby="fleet-section-title"
    >
      {/* Background Studio Layers (All 2560x1440 with aligned ground line) */}
      <div className="fleet-bg-stage" aria-hidden="true">
        {/* Overview Studio Background */}
        <img
          src="/media/car_info/bg_car.png"
          alt=""
          className={`fleet-bg-layer ${selectedId === null ? 'active' : ''}`}
          loading="eager"
        />

        {/* Individual Vehicle Side-View Layers */}
        {FLEET_DATA.map((car) => (
          <img
            key={car.id}
            src={car.bgImage}
            alt=""
            className={`fleet-bg-layer ${selectedId === car.id ? 'active' : ''}`}
            loading="eager"
          />
        ))}
      </div>

      {/* Topline Bar */}
      <div className="section-topline fleet-topbar">
        {selectedId ? (
          <button
            type="button"
            className="fleet-back-btn"
            onClick={handleBackToOverview}
            aria-label="Back to fleet overview"
          >
            <ArrowLeft size={14} />
            <span>All Fleet</span>
          </button>
        ) : (
          <span className="eyebrow">
            <span className="gold-line" /> EXCELLENCE, IN EVERY DETAIL
          </span>
        )}
        <span className="section-numeral">02 / THE COLLECTION</span>
      </div>

      {/* Middle Content Area */}
      <div className="fleet-stage-content">
        {/* Overview Header (Reference Image 1) */}
        <div
          className={`fleet-overview-header ${
            selectedId ? 'fleet-fade-out' : 'fleet-fade-in'
          }`}
          aria-hidden={selectedId !== null}
        >
          <span className="fleet-eyebrow">PREMIUM CHAUFFEUR SERVICE</span>
          <h2 id="fleet-section-title" className="fleet-main-title">
            Our Fleet
          </h2>
          <p className="fleet-subtitle">
            A curated fleet for every occasion, with professional chauffeurs.
          </p>
        </div>

        {/* Vehicle Detail Info (When a car is selected) */}
        {activeVehicle && (
          <div
            key={activeVehicle.id}
            className="fleet-detail-info fleet-fade-in"
            aria-live="polite"
          >
            <div className="fleet-detail-badge">{activeVehicle.classBadge}</div>
            <h2 className="fleet-detail-title">
              {activeVehicle.name}
              {activeVehicle.subName && (
                <span className="fleet-detail-title-sub">
                  {' '}
                  {activeVehicle.subName}
                </span>
              )}
            </h2>
            <p className="fleet-detail-desc">{activeVehicle.description}</p>

            <div className="fleet-specs-pills">
              {activeVehicle.specs.map((spec) => (
                <span key={spec} className="fleet-spec-pill">
                  {spec}
                </span>
              ))}
            </div>

            <div className="fleet-detail-actions">
              <button
                type="button"
                className="fleet-reserve-btn"
                onClick={() => handleReserve(activeVehicle.catalogId)}
              >
                Reserve This Vehicle <ArrowUpRight size={15} />
              </button>
              <button
                type="button"
                className="fleet-explore-link"
                onClick={() => goTo(2)}
              >
                Explore Services
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Vehicle Selector (4 Cards with Clockwise Glowing Light Border) */}
      <div
        className={`fleet-bottom-dock ${
          selectedId ? 'is-dock-mode' : 'is-cards-mode'
        }`}
        role="region"
        aria-label="Fleet vehicle selection"
      >
        {FLEET_DATA.map((car) => {
          const isSelected = selectedId === car.id
          return (
            <button
              key={car.id}
              type="button"
              className={`fleet-card ${isSelected ? 'is-active' : ''}`}
              onClick={() => handleCardClick(car.id)}
              aria-pressed={isSelected}
              aria-label={`View ${car.name}`}
            >
              <div className="fleet-card-inner">
                <span
                  className={`fleet-card-brand-icon brand-${car.id}`}
                  aria-hidden="true"
                >
                  <BrandLogo brand={car.brand} />
                </span>
                <span className="fleet-card-text">
                  <span className="fleet-card-name">{car.name}</span>
                  {car.subName && (
                    <span className="fleet-card-sub">{car.subName}</span>
                  )}
                </span>
                <span className="fleet-card-action-icon" aria-hidden="true">
                  {isSelected ? (
                    <span className="fleet-active-glow-dot" />
                  ) : (
                    <span className="fleet-arrow-circle">→</span>
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Subtle down chevron / explore prompt for overview */}
      {!selectedId && (
        <button
          type="button"
          className="section-next fleet-next-btn"
          onClick={() => goTo(2)}
        >
          EXPLORE OUR SERVICES
        </button>
      )}
    </section>
  )
}

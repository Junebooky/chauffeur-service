import { useState, useEffect } from 'react'
import {
  ArrowUpRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { resetGlassPointer, trackGlassPointer } from './liquidGlass'
import FleetInteriorGallery from './FleetInteriorGallery'
import BorderBeam from './components/ui/BorderBeam'
import DisplayHeading from './components/ui/DisplayHeading'
import ReservationButton from './components/ui/ReservationButton'

export interface FleetSectionProps {
  goTo: (index: number) => void
  onSelectVehicle: (vehicleId: string) => void
}

type SlideCategory = 'exterior' | 'interior' | 'specs'

interface SlideInfo {
  category: SlideCategory
  label: string
  title?: string
  eyebrow?: string
  description?: string
  image: string
  fgImage?: string
  interiorImages?: readonly [string, string]
}

interface VehicleInfo {
  id: 'g90' | 'carnival' | 'staria' | 'sprinter319'
  catalogId: string
  name: string
  subName?: string
  brand: string
  classBadge: string
  tagline: string
  description: string
  /** Concise Specs-only copy, independent from the showroom description. */
  shortDescription: string
  /** Supply the verified year of the actual vehicle when known. */
  modelYear?: string
  specs: {
    passengers: string
    luggage: string
    powertrain: string
    amenities: string
  }
  overviewSpecs: string[]
  bgImage: string
  fgImage?: string
  slides: SlideInfo[]
}

const FLEET_DATA: VehicleInfo[] = [
  {
    id: 'g90',
    catalogId: 'g90',
    name: 'Genesis G90',
    brand: 'Genesis',
    classBadge: 'FLAGSHIP LUXURY SEDAN',
    tagline: 'Quiet confidence. Exceptional comfort.',
    shortDescription: 'Quiet comfort for every important arrival.',
    description:
      'A refined experience for distinguished guests. Supreme ride refinement and whisper-quiet poise designed for executive diplomacy and airport arrivals.',
    specs: {
      passengers: 'Up to 3 Guests',
      luggage: '3 Large Suitcases + 2 Carry-ons',
      powertrain: '3.5L V6 Twin-Turbo AWD',
      amenities: 'Chilled Mineral Water · High-Speed Wi-Fi · Soft-Close Doors',
    },
    overviewSpecs: [
      'Up to 3 Guests',
      '3.5L Twin-Turbo',
      'VIP Comfort',
      'Wi-Fi',
    ],
    bgImage: '/media/fleet/bg_fleet_vehicle.png',
    fgImage: '/media/fleet/vehicles/g90/exterior.png',
    slides: [
      {
        category: 'exterior',
        label: 'Exterior',
        eyebrow: 'EXTERIOR ARCHITECTURE',
        title: 'Two-Line Headlamps & Diamond Crest Grille',
        description:
          'The iconic two-line lamp signature and athletic elegance establish an authoritative, dignified arrival for diplomats and executives.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/g90/exterior.png',
      },
      {
        category: 'interior',
        label: 'Interior',
        image: '/media/car_info/g90_interior.png',
        interiorImages: [
          '/media/fleet/vehicles/g90/interior-01.webp',
          '/media/fleet/vehicles/g90/interior-02.webp',
        ],
      },
      {
        category: 'specs',
        label: 'Specs',
        eyebrow: 'EXECUTIVE SPECIFICATIONS',
        title: 'Engineering & Comfort Specifications',
        description:
          'Precision tuned multi-chamber air suspension delivering a magic carpet ride across the Seoul metropolitan area.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/g90/exterior.png',
      },
    ],
  },
  {
    id: 'carnival',
    catalogId: 'carnival_limousine',
    name: 'Carnival',
    subName: 'Hi Limousine',
    brand: 'Kia',
    classBadge: 'VIP HI-LIMOUSINE · HYBRID',
    tagline: 'More space. A more considered journey.',
    shortDescription: 'More space. More comfort. Every mile.',
    description:
      'Raised roof architecture delivers exceptional headroom, privacy curtains, and serene traveling comfort for delegations and families.',
    specs: {
      passengers: '6 Passengers',
      luggage: '4–5 Large Check-in Bags',
      powertrain: '1.6L Turbo Hybrid System',
      amenities: '21.5" Smart Display · Air Purifier · Privacy Blinds',
    },
    overviewSpecs: [
      '6 Guests',
      'Hybrid',
      'Raised Roof',
      'VIP Captain Seats',
    ],
    bgImage: '/media/fleet/bg_fleet_vehicle.png',
    fgImage: '/media/fleet/vehicles/carnival/exterior.png',
    slides: [
      {
        category: 'exterior',
        label: 'Exterior',
        eyebrow: 'AERODYNAMIC STATURE',
        title: 'Signature Raised Roof & Star-Map LED',
        description:
          'Bespoke high-roof contour with integrated third brake lamp and star-map headlights, creating a prestigious executive presence.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/carnival/exterior.png',
      },
      {
        category: 'interior',
        label: 'Interior',
        image: '/media/car_info/carnival_interior.png',
        interiorImages: [
          '/media/fleet/vehicles/carnival/interior-01.webp',
          '/media/fleet/vehicles/carnival/interior-02.webp',
        ],
      },
      {
        category: 'specs',
        label: 'Specs',
        eyebrow: 'HYBRID SPECIFICATIONS',
        title: 'Spacious Dimensions & Efficient Hybrid Power',
        description:
          'Ultra-smooth electric-assisted acceleration with expansive cabin walk-through floor for effortless boarding.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/carnival/exterior.png',
      },
    ],
  },
  {
    id: 'staria',
    catalogId: 'staria',
    name: 'Staria',
    subName: 'Lounge Limousine',
    brand: 'Hyundai',
    classBadge: 'EXECUTIVE LOUNGE · HYBRID',
    tagline: 'Room to travel comfortably.',
    shortDescription: 'Room to travel with ease.',
    description:
      'Expansive panoramic cabin space and supreme accessibility. Outstanding comfort, generous luggage volume, and smooth hybrid poise.',
    specs: {
      passengers: '9 Passengers',
      luggage: '8+ Large Suitcases',
      powertrain: '1.6L Turbo Hybrid System',
      amenities: 'Dual Panoramic Sunroof · Smart Power Doors · Wi-Fi',
    },
    overviewSpecs: [
      '9 Guests',
      'Hybrid',
      'Lounge Seating',
      'Panoramic Windows',
    ],
    bgImage: '/media/fleet/bg_fleet_vehicle.png',
    fgImage: '/media/fleet/vehicles/staria/exterior.png',
    slides: [
      {
        category: 'exterior',
        label: 'Exterior',
        eyebrow: 'HORIZON ARCHITECTURE',
        title: 'Full-Width Horizon Lamp & Low Beltline',
        description:
          'Spaceship-inspired silhouette featuring continuous horizontal daytime running lights and massive tinted panoramic windows.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/staria/exterior.png',
      },
      {
        category: 'interior',
        label: 'Interior',
        image: '/media/car_info/staria_interior.png',
        interiorImages: [
          '/media/fleet/vehicles/staria/interior-01.webp',
          '/media/fleet/vehicles/staria/interior-02.webp',
        ],
      },
      {
        category: 'specs',
        label: 'Specs',
        eyebrow: 'CABIN SPECIFICATIONS',
        title: 'Maximum Luggage Capacity & High Efficiency',
        description:
          'Class-leading luggage flexibility accommodating up to 9 passengers and 8 large suitcases without compromise.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/staria/exterior.png',
      },
    ],
  },
  {
    id: 'sprinter319',
    catalogId: 'sprinter_319',
    name: 'Sprinter 319',
    subName: 'VIP Protocol',
    brand: 'Mercedes-Benz',
    classBadge: 'VIP PROTOCOL HIGH-ROOF COACH',
    tagline: 'A private lounge on the move.',
    shortDescription: 'A private lounge for every journey.',
    description:
      'Full stand-up cabin height with custom leather captain chairs and extended legroom. Built for prestigious delegations and roadshows.',
    specs: {
      passengers: '6 Passengers (Coach Layout)',
      luggage: '12+ Large Suitcases',
      powertrain: '3.0L V6 Turbo Diesel',
      amenities: '1.9m Standing Room · Conference Table · 220V Outlets',
    },
    overviewSpecs: [
      '6 Guests',
      'Stand-Up Cabin',
      'VIP Conference',
      'Extra Luggage',
    ],
    bgImage: '/media/fleet/bg_fleet_vehicle.png',
    fgImage: '/media/fleet/vehicles/sprinter/exterior.png',
    slides: [
      {
        category: 'exterior',
        label: 'Exterior',
        eyebrow: 'STATELY PROPORTIONS',
        title: 'High-Roof Presence & Mercedes Chrome Line',
        description:
          'Stately high-roof architecture with extended wheelbase and privacy glass, making a powerful impression at embassies and summits.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/sprinter/exterior.png',
      },
      {
        category: 'interior',
        label: 'Interior',
        image: '/media/car_info/sprinter_interior.png',
        interiorImages: [
          '/media/fleet/vehicles/sprinter/interior-01.webp',
          '/media/fleet/vehicles/sprinter/interior-02.webp',
        ],
      },
      {
        category: 'specs',
        label: 'Specs',
        eyebrow: 'COMMERCIAL SPECIFICATIONS',
        title: 'V6 Turbo Power & Unmatched Cargo Volume',
        description:
          'Smooth V6 diesel torque with dedicated partition cargo space holding 12+ large check-in bags for international delegations.',
        image: '/media/fleet/bg_fleet_vehicle.png',
        fgImage: '/media/fleet/vehicles/sprinter/exterior.png',
      },
    ],
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
  // selectedId is null for Overview, or one of the 4 vehicle ids
  const [selectedId, setSelectedId] = useState<VehicleInfo['id'] | null>(null)
  // isSlideDetailOpen is true when viewing the full PPT-slide detail view (Ref Image 2)
  const [isSlideDetailOpen, setIsSlideDetailOpen] = useState(false)
  // activeSlideIndex: 0=Exterior, 1=Interior, 2=Specs
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  // Active stage index on the showroom carousel track:
  // 0: Overview (4 cars together)
  // 1: Genesis G90
  // 2: Kia Carnival Hi Limousine
  // 3: Hyundai Staria
  // 4: Mercedes Sprinter 319
  const getStageIndex = (id: VehicleInfo['id'] | null): number => {
    if (!id) return 0
    const idx = FLEET_DATA.findIndex((car) => car.id === id)
    return idx >= 0 ? idx + 1 : 0
  }
  const activeStageIndex = getStageIndex(selectedId)

  const activeVehicle =
    FLEET_DATA.find((v) => v.id === selectedId) || FLEET_DATA[0]

  const handleCardClick = (id: VehicleInfo['id']) => {
    setSelectedId(id)
    setIsSlideDetailOpen(false)
    setActiveSlideIndex(0)
  }

  const handleBackToOverview = () => {
    setSelectedId(null)
    setIsSlideDetailOpen(false)
  }

  const handleOpenSlide = (index: number) => {
    setActiveSlideIndex(index)
    setIsSlideDetailOpen(true)
  }

  const handlePrevSlide = () => {
    if (activeSlideIndex === 0) {
      // Exterior's previous arrow returns to the selected Vehicle showroom.
      setIsSlideDetailOpen(false)
      return
    }
    setActiveSlideIndex((prev) => prev - 1)
  }

  const handleNextSlide = () => {
    setActiveSlideIndex((prev) => (prev + 1) % activeVehicle.slides.length)
  }

  const handleReserve = (catalogId: string) => {
    onSelectVehicle(catalogId)
    goTo(3)
  }

  // Keyboard navigation for PPT slides and Showroom horizontal sliding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (isSlideDetailOpen) {
        // Interior photo controls have their own arrow-key navigation.
        if (
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
          e.target instanceof Element &&
          e.target.closest('[data-fleet-interior-controls]')
        ) return
        // PPT Slide Deck mode
        if (e.key === 'Escape') {
          setIsSlideDetailOpen(false)
        } else if (e.key === 'ArrowLeft') {
          if (activeSlideIndex === 0) {
            setIsSlideDetailOpen(false)
          } else {
            setActiveSlideIndex((prev) => prev - 1)
          }
        } else if (e.key === 'ArrowRight') {
          setActiveSlideIndex((prev) => (prev + 1) % activeVehicle.slides.length)
        }
      } else {
        // Showroom mode: smooth push navigation
        if (e.key === 'Escape' && selectedId !== null) {
          handleBackToOverview()
        } else if (e.key === 'ArrowLeft') {
          if (activeStageIndex === 1) {
            handleBackToOverview()
          } else if (activeStageIndex > 1) {
            setSelectedId(FLEET_DATA[activeStageIndex - 2].id)
          }
        } else if (e.key === 'ArrowRight') {
          if (activeStageIndex === 0) {
            setSelectedId(FLEET_DATA[0].id)
          } else if (activeStageIndex < FLEET_DATA.length) {
            setSelectedId(FLEET_DATA[activeStageIndex].id)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSlideDetailOpen, selectedId, activeStageIndex, activeSlideIndex, activeVehicle.slides.length])

  return (
    <section
      id="collection"
      className={`screen collection-screen fleet-apple-section ${selectedId
        ? isSlideDetailOpen
          ? 'is-full-slide-mode'
          : 'is-vehicle-mode'
        : 'is-overview-mode'
        }`}
      aria-labelledby="fleet-section-title"
    >
      {/* =========================================================================
          FULL PPT SLIDE DETAIL OVERLAY (Matching Reference Image 2)
          ========================================================================= */}
      <div
        className={`fleet-full-slide-deck ${isSlideDetailOpen ? 'is-open' : ''
          }`}
        aria-hidden={!isSlideDetailOpen}
      >
        {/* Top Segmented Tabs Capsule (Ref Image 2) */}
        <div className="fleet-slide-top-nav">
          <button
            type="button"
            className="fleet-slide-back-btn"
            onClick={() => setIsSlideDetailOpen(false)}
            aria-label="Close vehicle views and return to vehicle"
          >
            <ArrowLeft size={14} />
            <span>Vehicle</span>
          </button>

          <div
            className="fleet-slide-segments"
            role="tablist"
            aria-label="Vehicle perspective tabs"
          >
            {activeVehicle.slides.map((s, idx) => (
              <button
                key={s.category}
                type="button"
                role="tab"
                aria-selected={activeSlideIndex === idx}
                className={`fleet-segment-pill ${activeSlideIndex === idx ? 'active' : ''
                  }`}
                onClick={() => setActiveSlideIndex(idx)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="fleet-slide-close-circle"
            onClick={() => setIsSlideDetailOpen(false)}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* The outer arrows always navigate Exterior / Interior / Specs.
            Only the photo gallery itself uses card clicks instead of arrows. */}
        <button
          type="button"
          className="fleet-slide-arrow fleet-slide-prev"
          onClick={handlePrevSlide}
          aria-label={activeSlideIndex === 0 ? 'Back to vehicle' : 'Previous vehicle category'}
        >
          <ChevronLeft size={28} />
        </button>

        <button
          type="button"
          className="fleet-slide-arrow fleet-slide-next"
          onClick={handleNextSlide}
          aria-label="Next vehicle category"
        >
          <ChevronRight size={28} />
        </button>

        {/* PPT Horizontal Slide Track */}
        <div
          className="fleet-slides-track"
          style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
        >
          {activeVehicle.slides.map((slide, idx) => (
            <div
              key={slide.category}
              className={`fleet-slide-item slide-${slide.category}`}
              aria-hidden={activeSlideIndex !== idx}
            >
              {/* Slide Background Image */}
              <div className="fleet-slide-image-wrap">
                {slide.category === 'interior' && slide.interiorImages ? (
                  <FleetInteriorGallery
                    key={activeVehicle.id}
                    vehicleName={activeVehicle.name}
                    images={slide.interiorImages}
                    fallbackImage={slide.image}
                    active={isSlideDetailOpen && activeSlideIndex === idx}
                  />
                ) : (
                  <img
                    src={slide.image}
                    alt={slide.fgImage ? '' : `${activeVehicle.name} ${slide.label}`}
                    className="fleet-slide-img"
                    loading="eager"
                  />
                )}
                {slide.fgImage && (
                  <div className="fleet-vehicle-stage-layer is-ppt-slide">
                    <div className="fleet-vehicle-floor-shadow" aria-hidden="true" />
                    <img
                      src={slide.fgImage}
                      alt={`${activeVehicle.name} ${slide.label}`}
                      className="fleet-vehicle-foreground"
                      loading="eager"
                      draggable={false}
                    />
                  </div>
                )}
                <div className="fleet-slide-vignette" />
              </div>

              {/* Specs Slide Custom Interactive Presentation */}
              {slide.category === 'specs' ? (
                <div className="fleet-specs-slide-card">
                  <BorderBeam />
                  <div className="fleet-specs-content">
                    <div className="fleet-specs-badge">{activeVehicle.classBadge}</div>
                    <DisplayHeading as="h3" className="fleet-specs-vehicle-title">{activeVehicle.name}</DisplayHeading>
                    <p className="fleet-specs-summary">{activeVehicle.shortDescription}</p>

                    <dl className="fleet-specs-facts">
                      {[
                        { label: 'MODEL YEAR', value: activeVehicle.modelYear ?? 'To be confirmed' },
                        { label: 'SEATING', value: activeVehicle.specs.passengers },
                        { label: 'LUGGAGE', value: activeVehicle.specs.luggage },
                      ].map((fact) => (
                        <div className="fleet-specs-row" key={fact.label}>
                          <dt className="fleet-spec-k">{fact.label}</dt>
                          <dd className="fleet-spec-v">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="fleet-specs-cta-row">
                      <ReservationButton
                        type="button"
                        onClick={() => handleReserve(activeVehicle.catalogId)}
                      >
                        Reserve {activeVehicle.name} <ArrowUpRight size={15} />
                      </ReservationButton>
                    </div>
                  </div>
                </div>
              ) : slide.category === 'exterior' ? (
                /* Editorial caption is retained for Exterior only; Interior is image-only. */
                <div className="fleet-slide-caption-bar">
                  <div className="fleet-slide-caption-content">
                    <span className="fleet-slide-caption-eyebrow">
                      {slide.eyebrow}
                    </span>
                    <h3 className="fleet-slide-caption-title">{slide.title}</h3>
                    <p className="fleet-slide-caption-desc">
                      {slide.description}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SHOWROOM HORIZONTAL CAROUSEL VIEWPORT & SLIDE PUSH TRACK
          Slide 0: Overview (4 cars parked together + header + next button)
          Slide 1: Genesis G90 (side profile + details + right view tabs)
          Slide 2: Kia Carnival Hi Limousine
          Slide 3: Hyundai Staria Lounge Limousine
          Slide 4: Mercedes Sprinter 319
          ========================================================================= */}
      <div
        className={`fleet-carousel-viewport ${isSlideDetailOpen ? 'is-hidden' : ''
          }`}
        aria-hidden={isSlideDetailOpen}
      >
        <div
          className="fleet-carousel-track"
          style={{ transform: `translateX(-${activeStageIndex * 100}%)` }}
        >
          {/* SLIDE 0: Overview */}
          <div
            className={`fleet-carousel-slide slide-overview ${activeStageIndex === 0 ? 'is-active-slide' : ''
              }`}
            aria-hidden={activeStageIndex !== 0}
          >
            <img
              src="/media/fleet/bg_fleet.png"
              alt="Chauffeur Fleet Overview"
              className="fleet-slide-bg"
              loading="eager"
            />
            <div className="fleet-slide-overlay" aria-hidden="true" />
            <div className="fleet-slide-content fleet-overview-content">
              <div className="fleet-overview-header">
                <div className="fleet-eyebrow-wrap">
                  <span className="fleet-eyebrow-rule" aria-hidden="true" />
                  <span className="fleet-eyebrow">PREMIUM CHAUFFEUR SERVICE</span>
                  <span
                    className="fleet-eyebrow-rule is-right"
                    aria-hidden="true"
                  />
                </div>
                <h2 id="fleet-section-title" className="fleet-main-title">
                  Our Fleet
                </h2>
                <p className="fleet-subtitle">
                  A curated fleet for every occasion, with professional chauffeurs.
                </p>
              </div>


            </div>
          </div>

          {/* SLIDES 1 to 4: Each Vehicle Stage */}
          {FLEET_DATA.map((car, idx) => {
            const slideIndex = idx + 1
            const isActive = activeStageIndex === slideIndex
            return (
              <div
                key={car.id}
                className={`fleet-carousel-slide slide-vehicle slide-${car.id} ${isActive ? 'is-active-slide' : ''
                  }`}
                aria-hidden={!isActive}
              >
                <img
                  src={car.bgImage}
                  alt={car.fgImage ? '' : `${car.name} side profile`}
                  className="fleet-slide-bg"
                  loading="eager"
                />
                <div className="fleet-slide-overlay" aria-hidden="true" />
                {car.fgImage && (
                  <div className="fleet-vehicle-stage-layer">
                    <div className="fleet-vehicle-floor-shadow" aria-hidden="true" />
                    <img
                      src={car.fgImage}
                      alt={`${car.name} showroom view`}
                      className="fleet-vehicle-foreground"
                      loading="eager"
                      draggable={false}
                    />
                  </div>
                )}

                <div className="fleet-slide-content fleet-vehicle-content">
                  {/* Left Info Column */}
                  <div className="fleet-detail-info" aria-live="polite">
                    <div className="fleet-detail-badge">{car.classBadge}</div>
                    <h2 className="fleet-detail-title">
                      {car.name}
                      {car.subName && (
                        <span className="fleet-detail-title-sub">
                          {' '}
                          {car.subName}
                        </span>
                      )}
                    </h2>
                    <p className="fleet-vehicle-tagline">{car.tagline}</p>

                    <div className="fleet-specs-pills">
                      {car.overviewSpecs.map((spec) => (
                        <span key={spec} className="fleet-spec-pill">
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="fleet-detail-actions">
                      <button
                        type="button"
                        className="fleet-reserve-btn"
                        data-liquid-glass="control"
                        onPointerMove={trackGlassPointer}
                        onPointerLeave={resetGlassPointer}
                        onClick={() => handleReserve(car.catalogId)}
                      >
                        Reserve This Vehicle <ArrowUpRight size={15} />
                      </button>
                      <button
                        type="button"
                        className="fleet-explore-link"
                        data-liquid-glass="control"
                        onPointerMove={trackGlassPointer}
                        onPointerLeave={resetGlassPointer}
                        onClick={() => goTo(2)}
                      >
                        Explore Services
                      </button>
                    </div>
                  </div>

                  {/* Right-Side View Switch Buttons (Exterior, Interior, Specs) */}
                  <div
                    className="fleet-right-view-tabs"
                    aria-label={`${car.name} viewpoints`}
                  >
                    {car.slides.map((s, sIdx) => (
                      <button
                        key={s.category}
                        type="button"
                        className="fleet-right-tab-btn"
                        data-liquid-glass="control"
                        onPointerMove={trackGlassPointer}
                        onPointerLeave={resetGlassPointer}
                        onClick={() => {
                          setSelectedId(car.id)
                          handleOpenSlide(sIdx)
                        }}
                        aria-label={`Open detailed ${s.label} view of ${car.name}`}
                      >
                        <span className="fleet-right-tab-label">{s.label}</span>
                        <span
                          className="fleet-right-tab-arrow"
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* =========================================================================
          STANDARD SECTION TOPLINE BAR (Overview & Vehicle View)
          ========================================================================= */}
      <div
        className={`section-topline fleet-topbar ${isSlideDetailOpen ? 'is-hidden' : ''
          }`}
      >
        <div className="fleet-topbar-left">
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
        </div>
      </div>

      {/* =========================================================================
          BOTTOM VEHICLE DOCK (Overview & Vehicle View)
          ========================================================================= */}
      <div
        className={`fleet-bottom-dock ${isSlideDetailOpen ? 'is-hidden' : ''
          } ${selectedId ? 'is-dock-mode' : 'is-cards-mode'}`}
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
              <BorderBeam />
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
                {isSelected && (
                  <span className="fleet-card-action-icon" aria-hidden="true">
                    <span className="fleet-active-glow-dot" />
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

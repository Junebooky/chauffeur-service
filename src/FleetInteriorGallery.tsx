import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface FleetInteriorGalleryProps {
  vehicleName: string
  images: readonly [string, string]
  fallbackImage: string
  active: boolean
}

/**
 * Preflight the two optional per-vehicle images so incomplete asset uploads
 * never leave a broken image in the showroom. Once both assets exist, they
 * appear automatically without another code change.
 */
export default function FleetInteriorGallery({
  vehicleName,
  images,
  fallbackImage,
  active,
}: FleetInteriorGalleryProps) {
  const [availableImages, setAvailableImages] = useState<string[]>([])
  const [photoIndex, setPhotoIndex] = useState(0)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const checks = images.map(
      (src) =>
        new Promise<string | null>((resolve) => {
          const image = new Image()
          image.onload = () => resolve(src)
          image.onerror = () => resolve(null)
          image.src = src
        }),
    )

    void Promise.all(checks).then((verified) => {
      if (cancelled) return
      setAvailableImages(
        verified.filter((src): src is string => src !== null),
      )
      setPhotoIndex(0)
    })

    return () => {
      cancelled = true
    }
  }, [active, images])

  const photos = availableImages.length > 0 ? availableImages : [fallbackImage]
  const currentIndex = Math.min(photoIndex, photos.length - 1)
  const changePhoto = (direction: -1 | 1) => {
    setPhotoIndex((index) => (index + direction + photos.length) % photos.length)
  }

  return (
    <>
      <img
        key={photos[currentIndex]}
        src={photos[currentIndex]}
        alt={`${vehicleName} interior view ${currentIndex + 1} of ${photos.length}`}
        className="fleet-slide-img"
        loading="eager"
        draggable={false}
      />

      {active && photos.length > 1 && (
        <div
          role="group"
          aria-label={`${vehicleName} interior photos`}
          data-fleet-interior-controls
          className="absolute bottom-[clamp(115px,16vh,180px)] right-[max(24px,5vw)] z-30 flex max-w-[calc(100%-48px)] items-center gap-2 rounded-2xl border border-white/20 bg-black/60 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:gap-3 sm:p-3"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              event.stopPropagation()
              changePhoto(event.key === 'ArrowLeft' ? -1 : 1)
            }
          }}
        >
          <button
            type="button"
            aria-label="Previous interior photo"
            onClick={() => changePhoto(-1)}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2">
            {photos.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setPhotoIndex(index)}
                aria-label={`Show ${vehicleName} interior photo ${index + 1}`}
                aria-pressed={currentIndex === index}
                className={`overflow-hidden rounded-md border p-[2px] transition-[border-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  currentIndex === index
                    ? 'border-white/90 opacity-100'
                    : 'border-white/20 opacity-65 hover:border-white/60 hover:opacity-100'
                }`}
              >
                <img
                  src={src}
                  alt=""
                  aria-hidden="true"
                  className="h-9 w-14 object-cover sm:h-11 sm:w-[70px]"
                  draggable={false}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Next interior photo"
            onClick={() => changePhoto(1)}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          <span
            aria-live="polite"
            className="hidden min-w-10 text-center font-sans text-[11px] tabular-nums tracking-[0.12em] text-white/70 md:block"
          >
            {String(currentIndex + 1).padStart(2, '0')} /{' '}
            {String(photos.length).padStart(2, '0')}
          </span>
        </div>
      )}
    </>
  )
}

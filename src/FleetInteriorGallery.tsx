import { useEffect, useState } from 'react'
import BorderBeam from './components/ui/BorderBeam'

interface FleetInteriorGalleryProps {
  vehicleName: string
  images: readonly [string, string]
  fallbackImage: string
  active: boolean
}

/**
 * Two large, centered photo cards select the interior image directly.
 * Assets are checked before display so partial uploads fall back gracefully.
 */
export default function FleetInteriorGallery({
  vehicleName,
  images,
  fallbackImage,
  active,
}: FleetInteriorGalleryProps) {
  const imagesKey = images.join('|')
  const [availableImages, setAvailableImages] = useState<string[]>([])
  const [resolvedKey, setResolvedKey] = useState<string | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)

  // Verify interior uploads as soon as this vehicle mounts so entering Interior
  // never flashes the legacy fallback image while assets are still loading.
  useEffect(() => {
    let cancelled = false
    const checks = images.map(
      (src) =>
        new Promise<string | null>((resolve) => {
          const image = new Image()
          image.onload = () => {
            if (typeof image.decode === 'function') {
              void image.decode().catch(() => undefined).then(() => resolve(src))
            } else {
              resolve(src)
            }
          }
          image.onerror = () => resolve(null)
          image.src = src
        }),
    )

    void Promise.all(checks).then((verified) => {
      if (cancelled) return
      setAvailableImages(verified.filter((src): src is string => src !== null))
      setResolvedKey(imagesKey)
      setPhotoIndex(0)
    })

    return () => {
      cancelled = true
    }
  }, [images, imagesKey])

  useEffect(() => {
    if (active) setPhotoIndex(0)
  }, [active])

  const isResolved = resolvedKey === imagesKey
  const photos = isResolved
    ? (availableImages.length > 0 ? availableImages : [fallbackImage])
    : []
  const currentIndex = Math.min(photoIndex, Math.max(0, photos.length - 1))

  return (
    <>
      {photos.map((src, index) => (
        <img
          key={src}
          src={src}
          alt={index === currentIndex ? `${vehicleName} interior` : ''}
          aria-hidden={index !== currentIndex}
          className={`fleet-slide-img absolute inset-0 transition-opacity duration-500 ease-in-out motion-reduce:transition-none ${
            index === currentIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          loading="eager"
          draggable={false}
        />
      ))}

      {active && photos.length > 1 && (
        <div
          role="group"
          aria-label={`${vehicleName} interior photo selection`}
          data-fleet-interior-controls
          className="absolute inset-x-0 bottom-[clamp(28px,6vh,78px)] z-30 flex items-center justify-center gap-3 px-5 sm:gap-5"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              event.stopPropagation()
              const direction = event.key === 'ArrowLeft' ? -1 : 1
              setPhotoIndex(
                (index) => (index + direction + photos.length) % photos.length,
              )
            }
          }}
        >
          {photos.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setPhotoIndex(index)}
              aria-label={`Show ${vehicleName} interior photo ${index + 1}`}
              aria-pressed={currentIndex === index}
              className={`group fleet-interior-photo-card relative isolate aspect-[16/10] w-[min(40vw,260px)] overflow-hidden rounded-xl border bg-black/45 p-[5px] shadow-[0_16px_44px_rgba(0,0,0,0.55)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                currentIndex === index
                  ? 'border-white/85 shadow-[0_20px_52px_rgba(0,0,0,0.64)]'
                  : 'border-white/25 hover:border-white/60'
              }`}
            >
              <BorderBeam duration="14s" />
              <img
                src={src}
                alt=""
                aria-hidden="true"
                className="h-full w-full rounded-[8px] object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

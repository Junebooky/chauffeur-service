import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const load = (path) => readFileSync(join(root, path), 'utf8')

test('Booking and Fleet Specs share the exact same reservation button', () => {
  const booking = load('src/Booking.tsx')
  const fleet = load('src/FleetSection.tsx')
  const button = load('src/components/ui/ReservationButton.tsx')

  assert.match(booking, /<ReservationButton/)
  assert.match(fleet, /<ReservationButton/)
  assert.match(button, /booking-cta-pill/)
  assert.match(button, /booking-cta-pill-inner/)
  const beam = load('src/components/ui/BookingCtaBeam.tsx')
  const css = load('src/styles.css')
  assert.match(button, /<BookingCtaBeam \/>/)
  assert.match(beam, /booking-cta-beam-ring/)
  assert.doesNotMatch(beam, /booking-cta-beam-halo/)
  assert.match(css, /--booking-cta-beam-stroke: 1px;/)
  assert.match(css, /padding: var\(--booking-cta-beam-stroke\);/)
  assert.match(css, /rgba\(255, 250, 242, 0\.94\) 90deg/)
  assert.match(css, /rgba\(255, 250, 242, 0\.94\) 270deg/)
  assert.match(button, /trackGlassPointer\(event\)/)
  assert.match(button, /resetGlassPointer\(event\)/)
  assert.match(booking, /form="booking-request-form"/)
  assert.match(booking, /step === 2 && !allAvailable/)
  assert.match(fleet, /handleReserve\(activeVehicle\.catalogId\)/)
})

test('the Specs name shares the Booking display heading and thin font weight', () => {
  const booking = load('src/Booking.tsx')
  const fleet = load('src/FleetSection.tsx')
  const css = load('src/styles.css')
  assert.match(booking, /<DisplayHeading as="h2" id="booking-title"/)
  assert.match(fleet, /<DisplayHeading as="h3" className="fleet-specs-vehicle-title"/)
  assert.match(css, /\.chauffeur-display-heading\s*\{[^}]*font-weight:\s*100;/)
})

test('the three-section Fleet preserves category tabs, but Interior shows only centered cards', () => {
  const fleet = load('src/FleetSection.tsx')
  const gallery = load('src/FleetInteriorGallery.tsx')
  const categories = [...fleet.matchAll(/category: '(exterior|interior|details|specs)'/g)]
    .map((m) => m[1])
  assert.deepEqual(categories, Array(4).fill(['exterior', 'interior', 'specs']).flat())
  assert.doesNotMatch(fleet, /fleet-slide-caption-bar|EXTERIOR ARCHITECTURE/)
  assert.match(fleet, /className="fleet-slide-arrow fleet-slide-prev"/)
  assert.match(fleet, /className="fleet-slide-arrow fleet-slide-next"/)
  assert.doesNotMatch(fleet, /\?\.category !== 'interior'/)
  assert.doesNotMatch(fleet, /EXECUTIVE SANCTUARY/)
  assert.match(gallery, /justify-center/)
  assert.match(gallery, /w-\[min\(40vw,260px\)\]/)
  assert.match(gallery, /onClick=\{\(\) => setPhotoIndex\(index\)\}/)
  assert.doesNotMatch(gallery, /aria-label="Previous interior photo"/)
  assert.doesNotMatch(gallery, /aria-label="Next interior photo"/)
  assert.doesNotMatch(gallery, /tabular-nums/)
})

test('Fleet dock and Specs keep a common Border Beam, now over three times slower', () => {
  const fleet = load('src/FleetSection.tsx')
  const css = load('src/styles.css')
  assert.match(fleet, /<BorderBeam duration="4\.4s" \/>/)
  assert.match(fleet, /<BorderBeam duration="14s" \/>/)
  assert.match(css, /rotateBeam var\(--fleet-border-beam-duration\) linear infinite/)
})

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')

test('hero fallback and video poster refer to real public assets', () => {
  const hero = readFileSync(join(root, 'src/Hero.tsx'), 'utf8')
  const references = [
    ...hero.matchAll(/(?:src|poster)="(\/media\/[^"]+)"/g),
  ].map((match) => match[1])
  assert.ok(references.length > 0, 'No hero media paths found')
  for (const assetPath of new Set(references)) {
    const absolute = join(root, 'public', assetPath.slice(1))
    assert.ok(existsSync(absolute), `Missing hero media: ${assetPath}`)
  }
})

test('reservation submit requires confirmed availability state', () => {
  const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
  assert.match(booking, /step === 2 && !allAvailable/)
  assert.match(booking, /Availability check required/)
  assert.match(booking, /Time slot open for a request/)
  assert.doesNotMatch(booking, /Available for instant request/)
})

test('vehicle showroom has only lightweight typography and useful viewpoint controls', () => {
  const fleet = readFileSync(join(root, 'src/FleetSection.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  assert.match(fleet, /<DisplayHeading as="h2" className="fleet-detail-title"/)
  assert.match(fleet, /className="fleet-right-view-tabs"/)
  assert.match(styles, /\.fleet-detail-title\s*\{[^}]*font-family:\s*var\(--sans\);[^}]*font-weight:\s*100;/)
  assert.match(styles, /\.fleet-detail-badge\s*\{[^}]*color:\s*rgba\(255, 255, 255, 0\.76\);/)
  assert.doesNotMatch(fleet, /overviewSpecs|fleet-specs-pills|fleet-detail-actions/)
  assert.doesNotMatch(fleet, /Reserve This Vehicle|Explore Services/)
  assert.doesNotMatch(fleet, /fleet-slide-caption-bar|EXTERIOR ARCHITECTURE/)
})

test('reservation starts as a single Liquid Glass invitation and expands into the existing request flow', () => {
  const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  assert.match(booking, /useState\(false\).*glassOpen|\[glassOpen, setGlassOpen\] = useState\(false\)/)
  assert.match(booking, /className="booking-glass-trigger"/)
  assert.match(booking, /onClick=\{\(\) => setGlassOpen\(true\)\}/)
  assert.match(booking, /className="booking-glass-content"/)
  assert.match(booking, /\) : glassOpen \? \(/)
  assert.match(booking, /<VehicleCarousel[\s\S]*?value=\{activeVehicle\}/)
  assert.match(booking, /<Calendar/)
  assert.match(booking, /<AddressSearch/)
  assert.match(booking, /status: string/)
  assert.match(booking, /Request saved · Not yet confirmed/)
  assert.match(styles, /\.booking-glass-stage\.is-expanded \.booking-glass-surface/)
  assert.match(styles, /prefers-reduced-motion/)
  assert.doesNotMatch(styles.slice(styles.indexOf('A OPTION \/ Liquid Glass')), /droplet\s*\{|particle\s*\{/)
})

test('glass controls track light, preserve booking and honor accessibility fallbacks', () => {
  const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
  const fleet = readFileSync(join(root, 'src/FleetSection.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  const pointer = readFileSync(join(root, 'src/liquidGlass.ts'), 'utf8')
  assert.match(booking, /onPointerMove=\{trackGlassPointer\}/)
  assert.match(booking, /onPointerLeave=\{resetGlassPointer\}/)
  assert.match(booking, /onClick=\{\(\) => setGlassOpen\(true\)\}/)
  assert.match(booking, /Request saved · Not yet confirmed/)
  const reservationButton = readFileSync(join(root, 'src/components/ui/ReservationButton.tsx'), 'utf8')
  assert.match(booking, /<ReservationButton/)
  assert.match(reservationButton, /data-liquid-glass="control"/)
  assert.match(fleet, /data-liquid-glass="control"/)
  assert.match(pointer, /getBoundingClientRect\(\)/)
  assert.match(pointer, /pointerType === 'touch'/)
  assert.match(styles, /@property --glass-x/)
  assert.match(styles, /\.booking-glass-surface::before\s*\{/)
  assert.match(styles, /\.booking-glass-surface::after\s*\{/)
  assert.match(styles, /mask-composite:\s*exclude/)
  assert.match(styles, /prefers-reduced-transparency:\s*reduce/)
  assert.doesNotMatch(styles.slice(styles.indexOf('LIQUID GLASS / CHAUFFEUR')), /backdrop-filter:\s*url\(/)
})

test('open-source glass engine is attached only to the invitation, with a standalone A/B preview', () => {
  const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
  const entry = readFileSync(join(root, 'src/main.tsx'), 'utf8')
  const lab = readFileSync(join(root, 'src/GlassLab.tsx'), 'utf8')
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  assert.equal(pkg.dependencies['simple-liquid-glass'], '5.6.0')
  assert.equal(pkg.dependencies['liquid-glass-react'], '1.1.1')
  assert.equal(lock.packages['node_modules/simple-liquid-glass'].version, '5.6.0')
  assert.equal(lock.packages['node_modules/liquid-glass-react'].version, '1.1.1')
  assert.match(booking, /backdropRef=\{refractionBackdrop\}/)
  assert.match(booking, /className="booking-optical-lens"/)
  assert.match(booking, /refraction="lens"/)
  assert.match(booking, /onClick=\{\(\) => setGlassOpen\(true\)\}/)
  assert.match(lab, /import RdevLiquidGlass from 'liquid-glass-react'/)
  assert.match(lab, /import \{ LiquidGlass \} from 'simple-liquid-glass'/)
  assert.match(entry, /glass-lab/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /booking-glass-refraction-backdrop/)
})

test('fleet dock shows only a selected glow dot, never an arrow on vehicle cards', () => {
  const fleet = readFileSync(join(root, 'src/FleetSection.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  assert.match(fleet, /FLEET_DATA\.map\(\(car\)/)
  assert.match(fleet, /aria-pressed=\{isSelected\}/)
  assert.match(fleet, /\{isSelected && \(\s*<span className="fleet-card-action-icon"/)
  assert.match(fleet, /className="fleet-active-glow-dot"/)
  assert.doesNotMatch(fleet, /fleet-arrow-circle/)
  assert.doesNotMatch(styles, /\.fleet-arrow-circle/)
})

test('reservation step 1 orders Flight number last, supports editable time, and removes filler text', () => {
  const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
  const routeCol = booking.slice(
    booking.indexOf('className="route-fields schedule-route-col"'),
    booking.indexOf('{step === 1 && ('),
  )
  const idxService = routeCol.indexOf('name="service"')
  const idxPickup = routeCol.indexOf('name="pickup"')
  const idxDest = routeCol.indexOf('name="destination"')
  const idxTime = routeCol.indexOf('<GlassTimeInput')
  const idxFlight = routeCol.indexOf('name="flight"')
  assert.ok(
    idxService > 0 &&
      idxService < idxPickup &&
      idxPickup < idxDest &&
      idxDest < idxTime &&
      idxTime < idxFlight,
    'Step 1 fields must be ordered: Service -> Pickup -> Destination -> Pick-up Time -> Flight',
  )
  assert.doesNotMatch(booking, /YOUR JOURNEY, AT A GLANCE/)
})


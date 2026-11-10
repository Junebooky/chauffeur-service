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

test('fleet details stay concise with silver accents and single-row desktop specs', () => {
  const fleet = readFileSync(join(root, 'src/FleetSection.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  assert.doesNotMatch(fleet, /<p className="fleet-detail-desc">/)
  assert.match(fleet, /className="fleet-specs-pills"/)
  assert.match(styles, /\.fleet-specs-pills\s*\{[^}]*flex-wrap:\s*nowrap;/)
  assert.match(styles, /@media \(max-width: 960px\) \{[\s\S]*?\.fleet-specs-pills\s*\{[^}]*flex-wrap:\s*wrap;/)
  assert.match(styles, /\.fleet-detail-badge\s*\{[^}]*color:\s*#B8C0CB;/)
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
  assert.match(booking, /pending reservation request, not a confirmed booking/)
  assert.match(styles, /\.booking-glass-stage\.is-expanded \.booking-glass-surface/)
  assert.match(styles, /prefers-reduced-motion/)
  assert.doesNotMatch(styles.slice(styles.indexOf('A OPTION \/ Liquid Glass')), /droplet\s*\{|particle\s*\{/)
})

test('glass controls track light, preserve booking and honor accessibility fallbacks', () => {
  const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
  const fleet = readFileSync(join(root, 'src/FleetSection.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  const pointer = readFileSync(join(root, 'src/liquidGlass.ts'), 'utf8')
  assert.match(booking, /onPointerMove=\{trackGlassPointer\}/)
  assert.match(booking, /onPointerLeave=\{resetGlassPointer\}/)
  assert.match(booking, /onClick=\{\(\) => setGlassOpen\(true\)\}/)
  assert.match(booking, /pending reservation request, not a confirmed booking/)
  assert.match(app, /data-liquid-glass="control"/)
  assert.match(fleet, /data-liquid-glass="control"/)
  assert.match(pointer, /getBoundingClientRect\(\)/)
  assert.match(pointer, /pointerType === 'touch'/)
  assert.match(styles, /@property --glass-x/)
  assert.match(styles, /\.booking-glass-surface::before\s*\{/)
  assert.match(styles, /\.booking-glass-surface::after\s*\{/)
  assert.match(styles, /mask-composite:\s*exclude/)
  assert.match(styles, /prefers-reduced-transparency: reduce/)
  assert.doesNotMatch(styles.slice(styles.indexOf('LIQUID GLASS / CHAUFFEUR')), /backdrop-filter:\s*url\(/)
})

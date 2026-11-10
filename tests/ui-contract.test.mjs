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

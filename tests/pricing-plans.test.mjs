import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const pricing = read('src/PricingSection.tsx')
const app = read('src/App.tsx')
const catalog = JSON.parse(read('src/catalog.json'))
const vehicle = (id) => catalog.vehicles.find((v) => v.id === id)
const service = (id) => catalog.services.find((s) => s.id === id)

test('Pricing Plans presents only the three requested services with their existing artwork', () => {
  const block = pricing.slice(
    pricing.indexOf('const PRICING_PLANS = ['),
    pricing.indexOf('const BEAM_GRADIENT', pricing.indexOf('const PRICING_PLANS = [')),
  )
  const ids = [...block.matchAll(/    id: '([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(ids, ['pickup', 'schedule', 'custom'])
  assert.match(block, /lines: \['Pick-up', 'Service'\]/)
  assert.match(block, /lines: \['Schedule', 'Service'\]/)
  assert.match(block, /lines: \['Custom'\]/)
  assert.doesNotMatch(block, /hourly|By the|Hour|Full', 'Day/)
  for (const filename of ['price_airport.png', 'price_full.png', 'price_custom.png', 'bg_price.png']) {
    assert.ok(existsSync(join(root, 'public/media/price', filename)), `Missing image: ${filename}`)
  }
  assert.doesNotMatch(block, /price_hour\.png/)
  assert.match(pricing, /lg:grid-cols-3/)
  assert.match(pricing, /max-w-\[1380px\]/)
})

test('two visible vehicle-tier prices come directly from the reservation catalog', () => {
  assert.equal(vehicle('carnival_limousine').surcharge, vehicle('staria').surcharge)
  assert.equal(vehicle('g90').surcharge, vehicle('sprinter_319').surcharge)
  assert.match(pricing, /Carnival · Staria/)
  assert.match(pricing, /Genesis G90 · Mercedes-Benz Sprinter/)
  assert.match(pricing, /PRICE_TIERS\.map/)
  assert.match(pricing, /service\.price \+ vehicle\.surcharge/)
  assert.match(pricing, /KRW · TAX excluded/)
  for (const id of ['airport', 'day']) {
    const basic = service(id).price + vehicle('staria').surcharge
    const premium = service(id).price + vehicle('sprinter_319').surcharge
    assert.equal(
      basic,
      service(id).price + vehicle('carnival_limousine').surcharge,
    )
    assert.equal(premium, service(id).price + vehicle('g90').surcharge)
    assert.ok(premium > basic)
  }
})

test('all three pricing-card links actually navigate to Booking, including Custom', () => {
  assert.match(pricing, /id: 'custom',\s*serviceId: null,/)
  assert.match(pricing, /const navigateToReservation = \(serviceId: 'airport' \| 'day' \| null\)/)
  assert.match(pricing, /if \(serviceId !== null\) onSelectService\(serviceId\)/)
  assert.match(pricing, /goTo\(3\)/)
  assert.equal((pricing.match(/onClick=\{\(\) => navigateToReservation\(plan\.serviceId\)\}/g) || []).length, 2)
  assert.match(pricing, /pointer-events-auto relative z-10 mt-auto/)
  assert.doesNotMatch(pricing, /pointer-events-none relative z-10 mt-auto/)
  assert.doesNotMatch(pricing, /after:absolute after:inset-0/)
  assert.match(pricing, /Plan your journey/)
  assert.match(pricing, /Plan a custom journey/)
  assert.match(pricing, /Tailored Quote/)
  assert.doesNotMatch(pricing, /onRequestCustom/)
  // Booking still directs the Custom choice to the Concierge inquiry.
  assert.match(app, /onRequestCustom=\{\(\) => setModal\('contact'\)\}/)
})

test('the existing photographic hover and Border Beam design is retained', () => {
  assert.match(pricing, /motion-safe:animate-border-beam/)
  assert.match(pricing, /BEAM_GRADIENT/)
  assert.match(pricing, /group-hover:translate-y-0/)
  assert.match(pricing, /group-focus-within:translate-y-0/)
  assert.match(pricing, /\[@media\(hover:none\)\]:opacity-100/)
  assert.match(pricing, /group-hover:scale-\[1\.04\]/)
})

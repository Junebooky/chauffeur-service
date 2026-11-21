import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const load = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('shared components use Tailwind classes and neutral colors', () => {
  const button = load('src/components/ui/GlassButton.tsx')
  const beam = load('src/components/ui/BorderBeam.tsx')
  const theme = load('src/tailwind.css')
  assert.match(button, /border-white\/25/)
  assert.match(button, /focus-visible:outline/)
  assert.match(beam, /pricing-card/)
  assert.match(beam, /fleet-card/)
  assert.match(beam, /booking-cta/)
  assert.match(theme, /--color-chauffeur-black: #050505/)
  assert.doesNotMatch(theme, /--color-chauffeur-silver/)
})

test('each section keeps its own Beam recipe and booking retains its glass morph', () => {
  const fleet = load('src/FleetSection.tsx')
  const pricing = load('src/PricingSection.tsx')
  const booking = load('src/Booking.tsx')
  assert.match(fleet, /<BorderBeam variant="fleet-card"/)
  assert.match(pricing, /<BorderBeam variant="pricing-card"/)
  assert.match(booking, /<BorderBeam variant="booking-cta"/)
  assert.match(booking, /<BorderBeam variant="booking-card"/)
  assert.match(booking, /<LiquidGlass/)
  assert.match(booking, /<GlassSurface/)
  assert.match(booking, /<GlassSelect/)
})

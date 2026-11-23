import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const shared = read('src/components/ui/SectionEyebrow.tsx')
const fleet = read('src/FleetSection.tsx')
const pricing = read('src/PricingSection.tsx')
const booking = read('src/Booking.tsx')
const styles = read('src/styles.css')

test('Fleet, Pricing, and Reservation use the exact same SectionEyebrow component', () => {
  for (const source of [fleet, pricing, booking]) {
    assert.match(source, /import SectionEyebrow from '\.\/components\/ui\/SectionEyebrow'/)
    assert.equal((source.match(/<SectionEyebrow/g) || []).length, 1)
  }
  assert.match(fleet, /<SectionEyebrow>EXCELLENCE, IN EVERY DETAIL<\/SectionEyebrow>/)
  assert.match(pricing, /<SectionEyebrow linePosition="after">PRICING PLANS<\/SectionEyebrow>/)
  assert.match(booking, /<SectionEyebrow>YOUR NEXT CHAPTER<\/SectionEyebrow>/)
})

test('all three eyebrows share understated translucent-white text and decorative rule', () => {
  assert.match(shared, /linePosition\?: 'before' \| 'after'/)
  assert.match(shared, /chauffeur-section-eyebrow-label/)
  assert.match(shared, /chauffeur-section-eyebrow-rule/)
  assert.match(shared, /aria-hidden="true"/)
  assert.match(styles, /\.chauffeur-section-eyebrow \{[^}]*color: rgba\(255, 255, 255, 0\.60\);/s)
  assert.match(styles, /\.chauffeur-section-eyebrow-rule \{[^}]*background: rgba\(255, 255, 255, 0\.34\);/s)
  assert.doesNotMatch(styles, /\.fleet-topbar \.eyebrow \{/)
  assert.doesNotMatch(fleet, /fleet-eyebrow-bar/)
  assert.doesNotMatch(pricing, /text-\[#e5e7eb\]\/90/)
  assert.doesNotMatch(booking, /<span className="gold-line" \/> YOUR NEXT CHAPTER/)
})

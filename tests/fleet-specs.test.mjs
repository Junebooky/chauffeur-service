import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const fleet = read('src/FleetSection.tsx')
const css = read('src/styles.css')
const beam = read('src/components/ui/BorderBeam.tsx')

test('Specs is a three-row guest-focused card with no engine or amenity rows', () => {
  for (const label of ['MODEL YEAR', 'SEATING', 'LUGGAGE']) {
    assert.ok(fleet.includes(`label: '${label}'`), `Missing Specs field: ${label}`)
  }
  assert.equal((fleet.match(/className="fleet-specs-row"/g) || []).length, 1)
  assert.match(fleet, /className="fleet-specs-facts"/)
  assert.match(fleet, /To be confirmed/)
  assert.match(fleet, /modelYear\?: string/)
  assert.doesNotMatch(fleet, /\{activeVehicle\.specs\.powertrain\}/)
  assert.doesNotMatch(fleet, /\{activeVehicle\.specs\.amenities\}/)
  assert.doesNotMatch(fleet, /className="fleet-spec-box"/)
})

test('each vehicle has a Specs-only summary at least 50% shorter than its full copy', () => {
  const copies = [...fleet.matchAll(
    /shortDescription: '([^']+)',\s*description:\s*'([^']+)'/g,
  )]
  assert.equal(copies.length, 4)
  for (const [, short, full] of copies) {
    assert.ok(short.length <= full.length * 0.5, `Description is too long: ${short}`)
  }
  assert.match(fleet, /\{activeVehicle\.shortDescription\}/)
})

test('Specs title is light sans-serif and avoids silver text', () => {
  assert.match(
    css,
    /\.fleet-specs-vehicle-title\s*\{[^}]*font-family:\s*var\(--sans\);[^}]*font-weight:\s*100;/,
  )
  assert.match(
    css,
    /\.fleet-specs-badge\s*\{[^}]*color:\s*rgba\(255, 255, 255, 0\.72\);/,
  )
  assert.match(css, /\.fleet-slide-item\.slide-specs\s*\{/)
  assert.match(css, /\.fleet-specs-row\s*\{/)
})

test('the exact Fleet Border Beam is reused on both the dock and Specs card', () => {
  assert.equal(fleet.split('<BorderBeam />').length - 1, 2)
  assert.match(beam, /className="fleet-card-beam-halo"/)
  assert.match(beam, /className="fleet-card-beam-ring"/)
  assert.match(beam, /className="fleet-card-beam-spinner"/)
  assert.match(css, /rotateBeam 14s linear infinite/)
  assert.match(css, /\.fleet-specs-slide-card:hover > \.fleet-card-beam-halo/)
  assert.match(css, /\.fleet-specs-slide-card:hover > \.fleet-card-beam-ring/)
  assert.match(fleet, /onClick=\{\(\) => handleReserve\(activeVehicle\.catalogId\)\}/)
  assert.match(fleet, /<ReservationButton/)
  assert.match(fleet, /<DisplayHeading as="h3"/)
  assert.match(css, /\.fleet-specs-cta-row \.booking-cta-pill/)
})

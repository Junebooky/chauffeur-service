import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const source = (path) => readFileSync(join(root, path), 'utf8')
const fleet = source('src/FleetSection.tsx')
const gallery = source('src/FleetInteriorGallery.tsx')
const css = source('src/styles.css')
const beam = source('src/components/ui/BorderBeam.tsx')

test('Exterior uses the vehicle image alone, with no editorial overlay cards', () => {
  assert.doesNotMatch(fleet, /fleet-slide-caption-bar|EXTERIOR ARCHITECTURE/)
  assert.doesNotMatch(css, /\.fleet-slide-caption-bar/)
  assert.match(fleet, /slide\.category === 'specs' \?/)
  assert.match(fleet, /\) : null\}/)
})

test('vehicle landing screen is minimal and uses Booking display typography', () => {
  assert.match(fleet, /<DisplayHeading as="h2" className="fleet-detail-title"/)
  assert.match(css, /\.fleet-detail-title\s*\{[^}]*font-family:\s*var\(--sans\);[^}]*font-weight:\s*100;/)
  assert.match(css, /\.fleet-vehicle-tagline\s*\{[^}]*font-weight:\s*200;/)
  assert.doesNotMatch(fleet, /Reserve This Vehicle|Explore Services|overviewSpecs|fleet-specs-pills|fleet-detail-actions/)
  assert.match(fleet, /car\.slides\.map\(\(s, sIdx\) => \(/)
})

test('each Border Beam sets its own speed: Dock 4.4s, Specs and Interior 14s', () => {
  assert.match(beam, /duration: string/)
  assert.match(beam, /--fleet-border-beam-duration/)
  assert.match(css, /rotateBeam var\(--fleet-border-beam-duration\) linear infinite/)
  assert.match(fleet, /<BorderBeam duration="4\.4s" \/>/)
  assert.match(fleet, /<BorderBeam duration="14s" \/>/)
  assert.match(gallery, /<BorderBeam duration="14s" \/>/)
  assert.match(css, /prefers-reduced-motion: no-preference/)
})

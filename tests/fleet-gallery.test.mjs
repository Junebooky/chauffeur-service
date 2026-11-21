import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const source = (path) => readFileSync(join(root, path), 'utf8')
const fleet = source('src/FleetSection.tsx')
const gallery = source('src/FleetInteriorGallery.tsx')

test('each vehicle has Exterior, Interior, Specs in that order, with no Details tab', () => {
  const categories = [...fleet.matchAll(/category: '(exterior|interior|specs|details)'/g)].map(
    (match) => match[1],
  )
  assert.deepEqual(categories, Array(4).fill(['exterior', 'interior', 'specs']).flat())
  assert.doesNotMatch(fleet, /category: 'details'/)
  assert.doesNotMatch(fleet, /0=Exterior, 1=Interior, 2=Details/)
  assert.match(fleet, /activeVehicle\.slides\.length/)
})

test('all four committed exteriors use the shared background and transparent cutouts', () => {
  for (const vehicle of ['g90', 'carnival', 'staria', 'sprinter']) {
    const image = `/media/fleet/vehicles/${vehicle}/exterior.png`
    assert.ok(
      existsSync(join(root, 'public', image.slice(1))),
      `Missing ${vehicle} exterior cutout`,
    )
    assert.match(fleet, new RegExp(image.replaceAll('/', '\\/').replace('.', '\\.')))
  }
  assert.match(fleet, /\/media\/fleet\/bg_fleet_vehicle\.png/)
  assert.match(fleet, /fleet-vehicle-foreground/)
})

test('interior gallery supports two images per car and safely handles missing uploads', () => {
  for (const vehicle of ['g90', 'carnival', 'staria', 'sprinter']) {
    for (const number of ['01', '02']) {
      assert.ok(
        fleet.includes(`/media/fleet/vehicles/${vehicle}/interior-${number}.webp`),
        `Missing ${vehicle} interior-${number} reference`,
      )
    }
    assert.ok(
      fleet.includes(`/media/car_info/${vehicle}_interior.png`),
      `Missing legacy ${vehicle} fallback reference`,
    )
  }
  assert.match(fleet, /<FleetInteriorGallery/)
  assert.match(gallery, /new Image\(\)/)
  assert.match(gallery, /image\.onerror = \(\) => resolve\(null\)/)
  assert.match(gallery, /availableImages\.length > 0 \? availableImages : \[fallbackImage\]/)
  assert.match(gallery, /aria-label="Previous interior photo"/)
  assert.match(gallery, /aria-label="Next interior photo"/)
})

test('existing Fleet actions and Border Beam remain present', () => {
  assert.match(fleet, /onSelectVehicle\(catalogId\)/)
  const beam = source('src/components/ui/BorderBeam.tsx')
  assert.match(beam, /fleet-card-beam-halo/)
  assert.match(beam, /fleet-card-beam-ring/)
  assert.equal(fleet.split('<BorderBeam />').length - 1, 2)
  assert.match(fleet, /className="fleet-specs-facts"/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))
const vehicle = (id) => catalog.vehicles.find((item) => item.id === id)

test('Mercedes Sprinter 319 and Genesis G90 use the same premium surcharge', () => {
  assert.ok(vehicle('g90'))
  assert.ok(vehicle('sprinter_319'))
  assert.equal(vehicle('g90').surcharge, 100000)
  assert.equal(vehicle('sprinter_319').surcharge, vehicle('g90').surcharge)
})

test('the customer sees one official Mercedes-Benz Sprinter, with legacy variant retained only internally', () => {
  assert.equal(vehicle('carnival_limousine').surcharge, 0)
  assert.equal(vehicle('staria').surcharge, 0)
  assert.equal(vehicle('sprinter_319').name, 'Mercedes-Benz Sprinter')
  assert.equal(vehicle('sprinter_519').name, 'Mercedes-Benz Sprinter')
  assert.equal(vehicle('sprinter_319').surcharge, vehicle('g90').surcharge)
  assert.equal(vehicle('sprinter_519').surcharge, 180000)
  assert.equal(vehicle('sprinter_519').bookable, false)

  const publicVehicles = catalog.vehicles.filter((v) => v.bookable !== false)
  assert.equal(publicVehicles.length, 4)
  assert.equal(publicVehicles.filter((v) => v.name === 'Mercedes-Benz Sprinter').length, 1)

  const carousel = readFileSync(join(root, 'src/VehicleCarousel.tsx'), 'utf8')
  const fleet = readFileSync(join(root, 'src/FleetSection.tsx'), 'utf8')
  assert.match(carousel, /const visibleVehicles = catalog\.vehicles\.filter/)
  assert.match(carousel, /bookable === false/)
  assert.match(carousel, /const n = visibleVehicles\.length/)
  assert.match(fleet, /name: 'Mercedes-Benz Sprinter'/)
})

test('both price groups remain consistent across the currently configured services', () => {
  for (const service of catalog.services) {
    assert.equal(
      service.price + vehicle('carnival_limousine').surcharge,
      service.price + vehicle('staria').surcharge,
      `Base tier differs for ${service.id}`,
    )
    assert.equal(
      service.price + vehicle('g90').surcharge,
      service.price + vehicle('sprinter_319').surcharge,
      `Premium tier differs for ${service.id}`,
    )
  }
})

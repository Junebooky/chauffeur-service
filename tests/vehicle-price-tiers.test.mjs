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

test('Carnival and Staria stay in the same base-price tier; Sprinter 519 is separate', () => {
  assert.equal(vehicle('carnival_limousine').surcharge, 0)
  assert.equal(vehicle('staria').surcharge, 0)
  assert.equal(vehicle('sprinter_519').surcharge, 180000)
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

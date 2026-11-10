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

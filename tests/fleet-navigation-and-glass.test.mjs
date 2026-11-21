import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const fleet = read('src/FleetSection.tsx')
const gallery = read('src/FleetInteriorGallery.tsx')
const css = read('src/styles.css')

test('Exterior left arrow and ArrowLeft key return to Vehicle instead of wrapping to Specs', () => {
  const prev = fleet.match(/const handlePrevSlide = \(\) => \{([\s\S]*?)\n  \}\n\n  const handleNextSlide/)
  assert.ok(prev, 'Missing previous slide handler')
  assert.match(prev[1], /if \(activeSlideIndex === 0\) \{[\s\S]*?setIsSlideDetailOpen\(false\)/)
  assert.match(prev[1], /setActiveSlideIndex\(\(prev\) => prev - 1\)/)
  assert.doesNotMatch(prev[1], /% activeVehicle\.slides\.length/)
  assert.match(fleet, /aria-label=\{activeSlideIndex === 0 \? 'Back to vehicle' : 'Previous vehicle category'\}/)
  assert.match(fleet, /e\.key === 'ArrowLeft'\) \{\s*if \(activeSlideIndex === 0\) \{\s*setIsSlideDetailOpen\(false\)/)
  assert.match(fleet, /activeStageIndex, activeSlideIndex, activeVehicle\.slides\.length/)
})

test('both category arrows stay visible in Interior; the photo cards have no own arrows', () => {
  const nav = fleet.match(/\/\* The outer arrows always navigate[\s\S]*?\{\/\* PPT Horizontal Slide Track \*\/\}/)
  assert.ok(nav, 'Missing category arrows before slide track')
  assert.match(nav[0], /className="fleet-slide-arrow fleet-slide-prev"/)
  assert.match(nav[0], /className="fleet-slide-arrow fleet-slide-next"/)
  assert.doesNotMatch(nav[0], /category !== 'interior'/)
  assert.doesNotMatch(gallery, /ChevronLeft|ChevronRight|tabular-nums/)
  assert.match(gallery, /onClick=\{\(\) => setPhotoIndex\(index\)\}/)
})

test('each Interior thumbnail reuses the shared animated Fleet Border Beam', () => {
  assert.match(gallery, /import BorderBeam from '\.\/components\/ui\/BorderBeam'/)
  assert.match(gallery, /photos\.map\(\(src, index\) => \([\s\S]*?<BorderBeam duration="14s" \/>/)
  assert.match(gallery, /fleet-interior-photo-card relative isolate/)
  assert.match(css, /\.fleet-interior-photo-card > \.fleet-card-beam-ring\s*\{[^}]*opacity:\s*0\.64;/)
  assert.match(css, /\.fleet-interior-photo-card:is\(:hover, :focus-visible, \[aria-pressed="true"\]\) > \.fleet-card-beam-ring/)
  assert.match(css, /rotateBeam var\(--fleet-border-beam-duration\) linear infinite/)
})

test('Specs Glass card reveals the showroom backdrop instead of an opaque black panel', () => {
  const card = css.match(/\.fleet-specs-slide-card\s*\{([\s\S]*?)\n\}/)
  assert.ok(card, 'Specs card CSS missing')
  assert.match(card[1], /rgba\(31, 37, 47, 0\.26\)/)
  assert.match(card[1], /rgba\(10, 13, 19, 0\.39\)/)
  assert.match(card[1], /blur\(12px\) saturate\(125%\)/)
  assert.doesNotMatch(card[1], /rgba\(8, 8, 10, 0\.94\)/)
})

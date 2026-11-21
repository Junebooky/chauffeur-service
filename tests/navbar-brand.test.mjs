import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')

test('Navbar uses the committed J mark as an actual image, not the old SVG', () => {
  const asset = join(root, 'public/media/brand/chauffeur-mark.png')
  assert.ok(existsSync(asset), 'Logo PNG must exist in public/media/brand')
  assert.ok(statSync(asset).size > 1000, 'Logo asset must not be empty')
  const signature = readFileSync(asset).subarray(0, 8)
  assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.match(app, /src="\/media\/brand\/chauffeur-mark\.png"/)
  assert.match(app, /className="brand-mark"/)
  assert.match(app, /alt=""/)
  const brand = app.slice(app.indexOf('function Brand('), app.indexOf('function Modal('))
  assert.doesNotMatch(brand, /<svg|PRIVATE TRAVEL, PERFECTED/)
  assert.match(brand, /aria-label="Chauffeur home"/)
  assert.match(app, /<Brand onClick=\{\(\) => nav\(0\)\} \/>/)
})

test('Brand wordmark and byline stay live text with intentional tracking', () => {
  assert.match(app, /className="brand-wordmark">CHAUFFEUR<\/span>/)
  assert.match(app, /className="brand-byline">BY J PRODUCTION<\/small>/)
  assert.match(css, /font-family: 'Chauffeur Manrope'/)
  assert.match(css, /url\('\/fonts\/manrope\.ttf'\)/)
  assert.match(css, /\.brand-wordmark\s*\{[^}]*font-weight:\s*300;[^}]*letter-spacing:\s*0\.3em;/)
  assert.match(css, /\.brand-mark\s*\{[^}]*object-fit:\s*contain;/)
  assert.doesNotMatch(css, /\.brand>span|\.brand small/)
})

test('Brand lockup remains legible on tablet, mobile, and narrow phones', () => {
  assert.match(css, /@media \(max-width: 1150px\) \{[\s\S]*?\.brand-wordmark\s*\{/)
  assert.match(css, /@media \(max-width: 650px\) \{[\s\S]*?\.brand-byline\s*\{/)
  assert.match(css, /@media \(max-width: 380px\) \{[\s\S]*?\.brand-wordmark\s*\{/)
  assert.match(css, /\.brand:focus-visible\s*\{/)
})

import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')

test('Navbar uses the committed J mark as an actual image, not the old SVG', () => {
  const asset = join(root, 'public/media/brand/logo_brand.webp')
  assert.ok(existsSync(asset), 'Logo asset must exist in public/media/brand')
  assert.ok(statSync(asset).size > 1000, 'Logo asset must not be empty')
  const header = readFileSync(asset).subarray(0, 12)
  assert.equal(header.subarray(0, 4).toString('ascii'), 'RIFF')
  assert.equal(header.subarray(8, 12).toString('ascii'), 'WEBP')
  assert.match(app, /src="\/media\/brand\/logo_brand\.webp"/)
  assert.match(app, /className="brand-mark"/)
  assert.match(app, /alt=""/)
  const brand = app.slice(app.indexOf('function Brand('), app.indexOf('function Modal('))
  assert.doesNotMatch(brand, /<svg|PRIVATE TRAVEL, PERFECTED/)
  assert.match(brand, /aria-label="Chauffeur home"/)
  assert.match(app, /<Brand onClick=\{\(\) => nav\(0\)\} \/>/)
})

test('Brand wordmark and byline stay live text with refined editorial styling', () => {
  assert.match(app, /className="brand-wordmark">CHAUFFEUR<\/span>/)
  assert.match(app, /className="brand-byline">Team of Premium Chauffeur Service<\/small>/)
  assert.match(css, /\.brand-wordmark\s*\{[^}]*font-family:\s*var\(--serif\);[^}]*font-weight:\s*400;[^}]*letter-spacing:\s*0\.22em;/)
  assert.match(css, /\.brand-mark\s*\{[^}]*width:\s*38px;[^}]*object-fit:\s*contain;/)
  assert.doesNotMatch(css, /\.brand>span|\.brand small/)
})

test('Brand lockup remains legible on tablet, mobile, and narrow phones', () => {
  assert.match(css, /@media \(max-width: 1150px\) \{[\s\S]*?\.brand-wordmark\s*\{/)
  assert.match(css, /@media \(max-width: 650px\) \{[\s\S]*?\.brand-byline\s*\{/)
  assert.match(css, /@media \(max-width: 380px\) \{[\s\S]*?\.brand-wordmark\s*\{/)
  assert.match(css, /\.brand:focus-visible\s*\{/)
})

test('All operations screens use the real shared brand mark, not a placeholder J', () => {
  const admin = readFileSync(join(root, 'src/Admin.tsx'), 'utf8')
  const overview = readFileSync(join(root, 'src/AdminOverview.tsx'), 'utf8')
  const brand = readFileSync(join(root, 'src/components/ui/AdminBrand.tsx'), 'utf8')
  const adminCss = readFileSync(join(root, 'src/admin-korean.css'), 'utf8')
  assert.equal((admin.match(/<AdminBrand \/>/g) || []).length, 2)
  assert.equal((overview.match(/<AdminBrand \/>/g) || []).length, 1)
  assert.match(brand, /src="\/media\/brand\/logo_brand\.webp"/)
  assert.match(brand, /className="admin-brand-mark"/)
  assert.match(brand, /CHAUFFEUR <small>OPERATIONS<\/small>/)
  assert.doesNotMatch(admin + overview + adminCss, /admin-ko-mark/)
  assert.match(adminCss, /\.admin-brand-mark\{[^}]*object-fit:contain/)
})

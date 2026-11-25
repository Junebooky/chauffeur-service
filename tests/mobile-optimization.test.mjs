import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('viewport meta enables safe-area insets for mobile notches and home bars', () => {
  const html = read('index.html')
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/)
})

test('mobile drawer supports outside dismiss and current section state', () => {
  const app = read('src/App.tsx')
  assert.match(app, /className="mobile-nav-backdrop"/)
  assert.match(app, /aria-current=\{active === 0 \? 'location' : undefined\}/)
  assert.match(app, /aria-current=\{active === 3 \? 'location' : undefined\}/)
})

test('Fleet section supports mobile horizontal touch swipes', () => {
  const fleet = read('src/FleetSection.tsx')
  assert.match(fleet, /className=\{`fleet-full-slide-deck[\s\S]*?onTouchStart=/)
  assert.match(fleet, /className=\{`fleet-full-slide-deck[\s\S]*?onTouchEnd=/)
  assert.match(fleet, /className=\{`fleet-carousel-viewport[\s\S]*?onTouchStart=/)
  assert.match(fleet, /className=\{`fleet-carousel-viewport[\s\S]*?onTouchEnd=/)
})

test('Pricing cards use horizontal touch carousel on mobile while retaining touch targets and desktop height', () => {
  const pricing = read('src/PricingSection.tsx')
  const css = read('src/styles.css')
  assert.match(pricing, /pricing-carousel-track/)
  assert.match(pricing, /snap-x snap-mandatory/)
  assert.match(pricing, /pricing-carousel-markers/)
  assert.match(pricing, /aria-current=\{activePlanIndex === index \? 'true' : undefined\}/)
  assert.match(pricing, /min-h-\[clamp\(380px,49dvh,525px\)\]/)
  assert.match(pricing, /lg:h-\[clamp\(400px,49dvh,525px\)\]/)
  assert.match(pricing, /env\(safe-area-inset-bottom/)
  assert.match(pricing, /min-h-\[44px\]/)
  assert.match(css, /\.pricing-carousel-track\s*\{[\s\S]*?overscroll-behavior-x:\s*contain;/)
})

test('mobile optimizations cover left-aligned vertical footer, overview gradient framing, and upper hero heading', () => {
  const css = read('src/styles.css')
  const pricing = read('src/PricingSection.tsx')
  const mobileLayer = css.slice(css.indexOf('/* === MOBILE OPTIMIZATION LAYER === */'))
  assert.match(mobileLayer, /\.site-footer\s*\{\s*flex-direction:\s*column;\s*align-items:\s*flex-start;/)
  assert.match(mobileLayer, /\.site-footer > span:first-child\s*\{\s*order:\s*3;/)
  assert.match(mobileLayer, /\.fleet-eyebrow-wrap\s*\{\s*display:\s*none;\s*\}/)
  assert.match(mobileLayer, /\.fleet-card > \.fleet-card-beam-ring\s*\{\s*opacity:\s*0\.94;/)
  assert.match(pricing, /max-lg:opacity-90 \[@media\(hover:none\)\]:opacity-90/)
  assert.match(mobileLayer, /\.hero-backdrop-img\s*\{[\s\S]*?object-fit:\s*contain;[\s\S]*?mask-image:/)
  assert.match(mobileLayer, /\.slide-overview \.fleet-slide-bg\s*\{[\s\S]*?object-fit:\s*contain;[\s\S]*?mask-image:/)
  assert.match(mobileLayer, /\.hero-book-link\s*\{\s*margin-top:\s*auto;\s*align-self:\s*flex-end;/)
})

test('dropdown and address popups respond to visualViewport scroll and clamp to viewport width', () => {
  for (const file of ['src/AddressSearch.tsx', 'src/GlassSelect.tsx', 'src/GlassTimeInput.tsx']) {
    const source = read(file)
    assert.match(source, /visualViewport\?\.addEventListener\('scroll'/)
    assert.match(source, /viewportWidth - 24/)
  }
})

test('mobile optimization stylesheet covers touch targets, snap disabling, inputs, Fleet, and footer', () => {
  const css = read('src/styles.css')
  const mobileLayer = css.slice(css.indexOf('/* === MOBILE OPTIMIZATION LAYER === */'))
  assert.ok(mobileLayer.length > 0, 'Missing mobile optimization CSS section')
  assert.match(mobileLayer, /scroll-padding-top:\s*calc\(var\(--header\) \+ env\(safe-area-inset-top, 0px\)\)/)
  assert.match(mobileLayer, /@media \(pointer: coarse\) \{[\s\S]*?--target-size:\s*44px;/)
  assert.match(mobileLayer, /@media \(max-width: 1023px\) \{[\s\S]*?\.journey-scroll \{\s*scroll-snap-type:\s*none;/)
  assert.match(mobileLayer, /\.booking-cta-pill\.fleet-right-tab-btn \{\s*min-width:\s*0;/)
  assert.match(mobileLayer, /\.fleet-bottom-dock \{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0, 1fr\);/)
  assert.match(mobileLayer, /\.booking-glass-stage\.is-expanded \.field input,[\s\S]*?font-size:\s*16px !important;/)
  assert.match(mobileLayer, /\.booking-glass-stage\.is-expanded \.booking-fields \{\s*padding-top:\s*56px !important;/)
})

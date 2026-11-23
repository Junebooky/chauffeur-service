import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (name) => readFileSync(join(root, name), 'utf8')
const app = read('src/App.tsx')
const booking = read('src/Booking.tsx')
const css = read('src/styles.css')

test('native reservation dialog adopts shared minimal typography and restrained silver glass', () => {
  assert.match(app, /<dialog[\s\S]*className="info-dialog"/)
  assert.match(app, /<SectionEyebrow className="dialog-eyebrow">/)
  assert.match(app, /<DisplayHeading as="h2" id="dialog-title">/)
  assert.match(app, /className="icon-button dialog-close"/)
  assert.match(app, /onClose=\{onClose\}/)
  assert.match(app, /Reservation & privacy\./)
  assert.match(css, /\.info-dialog \.dialog-content \.chauffeur-display-heading \{/)
  assert.match(css, /\.info-dialog \.dialog-policy-section \{/)
  assert.match(css, /\.info-dialog \.dialog-close:focus-visible \{/)
  assert.match(css, /border: 1px solid rgba\(231, 238, 246, 0\.22\)/)
})

test('privacy notice is short and accurately describes saved requests and optional email delivery', () => {
  assert.match(app, /Reservation status/)
  assert.match(app, /Your information/)
  assert.match(app, /Availability & changes/)
  assert.match(app, /Addresses & maps/)
  assert.match(app, /Your request is pending until we confirm/)
  assert.match(app, /An email[\s\S]*notification is sent to our operator when email delivery is configured/)
  assert.match(app, /email enquiry opens your mail app/)
  assert.match(app, /Vehicle availability is indicative/)
  assert.match(app, /Google Maps Terms/)
  assert.match(app, /Google's Privacy Policy/)
  assert.doesNotMatch(app, /They are not sent to an[\s\S]*operator or an email service/)
  assert.doesNotMatch(app, /Overlapping requests for the same vehicle class are prevented/)
})

test('contact buttons retain native keyboard-accessible radio semantics behind silver icons', () => {
  assert.match(booking, /const CONTACT_METHOD_ICONS: Record<string, typeof Mail>/)
  for (const id of ['email', 'phone', 'whatsapp', 'line', 'kakao', 'wechat']) {
    assert.match(booking, new RegExp(id + ': (Mail|Phone|MessageCircle|MessageSquare|MessagesSquare|MessageCircleMore)'))
  }
  assert.match(booking, /className="contact-method-native-radio"/)
  assert.match(booking, /type="radio"[\s\S]*name="contact-method"/)
  assert.match(booking, /checked=\{contactMethod === method\.id\}/)
  assert.match(booking, /<ContactIcon[\s\S]*strokeWidth=\{1\.5\}[\s\S]*aria-hidden="true"/)
  assert.match(css, /\.contact-method-grid > label:focus-within \{/)
  assert.match(css, /\.contact-method-grid input\.contact-method-native-radio \{/)
  assert.match(css, /\.contact-method-grid \.contact-method-icon \{/)
  assert.match(css, /\.contact-method-grid > label\.selected \.contact-method-icon \{/)
})

test('estimated tax and currency information is lighter than the primary total', () => {
  assert.match(booking, /className="tax-notice"/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.summary-total small\.tax-notice \{[^}]*color: rgba\(216, 224, 235, 0\.52\) !important;[^}]*font-weight: 300 !important;/s)
})

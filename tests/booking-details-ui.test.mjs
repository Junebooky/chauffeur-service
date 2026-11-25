import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
const button = readFileSync(join(root, 'src/components/ui/ReservationButton.tsx'), 'utf8')

test('Your Details uses an internationally friendly full name field and quiet success marks', () => {
  assert.match(booking, /<span>Full name<\/span>/)
  assert.match(booking, /name="name"\s*autoComplete="name"/)
  assert.doesNotMatch(booking, /name="firstName"|name="lastName"/)
  assert.match(booking, /nameReady && <Check/)
  assert.match(booking, /emailReady && <Check/)
  assert.match(booking, /phoneReady && <Check/)
  assert.match(booking, /contact-input-wrap/)
  assert.match(css, /\.contact-fields \.contact-input-valid/)
  assert.match(css, /\.contact-fields \.contact-input-wrap > input:-webkit-autofill/)
  assert.match(css, /-webkit-text-fill-color: #f4f5f7/)
})

test('messenger contact can be an ID or an explicitly selected reachable phone number', () => {
  assert.match(booking, /usePhoneForMessenger/)
  assert.match(booking, /\['whatsapp', 'line', 'kakao', 'wechat'\]\.includes\(contactMethod\)/)
  assert.match(booking, /name="use-phone-for-messenger"/)
  assert.match(booking, /Use the phone number above for \{contactApp\}/)
  assert.match(booking, /ID or phone number/)
  assert.match(booking, /contactMethod !== 'whatsapp'/)
  assert.match(booking, /Make sure people can contact you on that app using this number/)
  assert.match(booking, /messengerContact: submittedMessengerContact/)
  assert.match(booking, /setUsePhoneForMessenger\(false\)/)
})

test('details recap keeps the full route in its own row and shortens only the displayed vehicle label', () => {
  assert.match(booking, /className="summary-journey-header"/)
  assert.match(booking, /className="summary-journey-route"/)
  assert.match(booking, /shortVehicleName\(day\.vehicle\)/)
  assert.match(booking, /case 'staria': return 'Staria'/)
  assert.match(booking, /case 'carnival_limousine': return 'Carnival'/)
  assert.match(booking, /const vehicleName = catalog\.vehicles\.find/)
  assert.match(booking, /title=\{vehicleName\}/)
  assert.match(booking, /step !== 2 && <Car size=\{14\} \/>/)
  assert.match(booking, /step === 1 && dates\.length > 1/)
  assert.match(css, /summary-route-recap[\s\S]*margin: 4px 0 22px/)
})

test('Back and request CTA are one row and share the translucent ReservationButton', () => {
  assert.match(booking, /is-details-actions/)
  assert.match(booking, /<ReservationButton[\s\S]*?className="booking-back-btn"/)
  assert.match(booking, /<ReservationButton[\s\S]*?className=\{step === 2 \? 'booking-submit' : ''\}/)
  assert.match(css, /booking-outer-buttons\.is-details-actions/)
  assert.match(css, /grid-template-columns: minmax\(110px, 0\.42fr\) minmax\(0, 1\.6fr\)/)
  assert.match(css, /booking-cta-pill:not\(\.fleet-right-tab-btn\)/)
  assert.match(css, /backdrop-filter: blur\(14px\) saturate\(132%\)/)
  assert.match(button, /booking-cta-pill/)
  assert.match(button, /data-liquid-glass="control"/)
})

test('Details copy is compact and all vehicle names align at the right edge', () => {
  assert.match(booking, /Preferred Contact Method/)
  assert.match(booking, /I consent to storing my details to arrange this reservation\./)
  assert.match(booking, /Reservation & Privacy Notice/)
  assert.match(booking, /All dates open for requests/)
  assert.match(booking, /KRW · Tax excl\. · ~/)
  assert.match(booking, /Vehicle Upgrade \(\$\{upgradedVehicleSummary\}\)/)
  assert.match(booking, /Request Booking/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.privacy-inline \{\s*color: rgba\(206, 214, 226, 0\.56\) !important;/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.journey-summary\.is-details-summary \{\s*padding-top: 62px !important;/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.journey-summary\.is-details-summary \.summary-journey-item \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);\s*justify-items: stretch;\s*width: 100%;/)
  assert.match(css, /summary-journey-header \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) max-content;/)
  assert.match(css, /summary-journey-vehicle \{\s*justify-self: end;/)
  assert.match(booking, /service-tone service-tone-/)
  assert.match(css, /\.booking-screen \.service-tone\.service-tone-airport \{\s*color: rgba\(213, 221, 230, 0\.90\) !important;\s*font-weight: 400;/)
  assert.match(css, /\.booking-screen \.service-tone\.service-tone-day \{\s*color: rgba\(182, 177, 165, 0\.90\) !important;\s*font-weight: 500;/)
  assert.doesNotMatch(css, /#9ec5e8|#dfbe8a/)
})

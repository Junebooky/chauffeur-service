import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  GA4_MEASUREMENT_ID,
  resetAnalyticsSessionForTests,
  shouldTrackAnalytics,
  trackBookingLead,
  trackPageView,
} from '../src/analytics.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

function withMockBrowser(loc, fn) {
  const previousWindow = globalThis.window
  const calls = []
  globalThis.window = {
    location: {
      origin: `https://${loc.hostname}`,
      ...loc,
    },
    gtag: (...args) => calls.push(args),
  }
  resetAnalyticsSessionForTests()
  try {
    fn(calls)
  } finally {
    resetAnalyticsSessionForTests()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('analytics tracks production hosts and excludes admin, lab, and plain localhost', () => {
  assert.equal(GA4_MEASUREMENT_ID, 'G-8VWZ2SPG0Q')
  for (const hostname of ['www.jpchauffeurkorea.com', 'jpchauffeurkorea.com']) {
    for (const pathname of ['/', '/en/', '/ko/']) {
      assert.equal(
        shouldTrackAnalytics({ hostname, pathname, search: '' }),
        true,
        `${hostname}${pathname} should be tracked`,
      )
    }
    assert.equal(shouldTrackAnalytics({ hostname, pathname: '/admin', search: '' }), false)
    assert.equal(shouldTrackAnalytics({ hostname, pathname: '/admin/live', search: '' }), false)
    assert.equal(shouldTrackAnalytics({ hostname, pathname: '/ko/', search: '?glass-lab=1' }), false)
  }
  assert.equal(shouldTrackAnalytics({ hostname: 'localhost', pathname: '/ko/', search: '' }), false)
  assert.equal(
    shouldTrackAnalytics({ hostname: 'localhost', pathname: '/ko/', search: '?ga_debug=1' }),
    true,
  )
  assert.equal(
    shouldTrackAnalytics({ hostname: 'localhost', pathname: '/admin/live', search: '?ga_debug=1' }),
    false,
  )
})

test('trackPageView deduplicates identical paths and passes canonical parameters', () => {
  withMockBrowser({ hostname: 'www.jpchauffeurkorea.com', pathname: '/ko/', search: '' }, (calls) => {
    trackPageView('/ko/', 'CHAUFFEUR — 한국어', 'ko')
    trackPageView('/ko/', 'CHAUFFEUR — 한국어', 'ko')
    trackPageView('/en/', 'CHAUFFEUR — English', 'en')

    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0], [
      'event',
      'page_view',
      {
        page_path: '/ko/',
        page_location: 'https://www.jpchauffeurkorea.com/ko/',
        page_title: 'CHAUFFEUR — 한국어',
        locale: 'ko',
      },
    ])
    assert.equal(calls[1][2].page_path, '/en/')
    assert.equal(calls[1][2].locale, 'en')
  })
})

test('trackBookingLead sends generate_lead without any PII fields', () => {
  withMockBrowser(
    { hostname: 'localhost', pathname: '/en/', search: '?ga_debug=1' },
    (calls) => {
      trackBookingLead({
        total: 420000,
        serviceId: 'airport',
        vehicleId: 'g90',
        tripMode: 'single_day',
        dayCount: 1,
        optionCount: 2,
        contactMethod: 'whatsapp',
        locale: 'en',
      })
      assert.equal(calls.length, 1)
      const [command, eventName, payload] = calls[0]
      assert.equal(command, 'event')
      assert.equal(eventName, 'generate_lead')
      assert.equal(payload.currency, 'KRW')
      assert.equal(payload.value, 420000)
      assert.equal(payload.quote_required, false)
      assert.equal(payload.debug_mode, true)
      for (const forbidden of ['name', 'email', 'phone', 'address', 'reference', 'flight']) {
        assert.equal(Object.hasOwn(payload, forbidden), false)
      }
    },
  )
})

test('SPA provider and customer funnel components wire Direct GA4 helpers', () => {
  const html = read('index.html')
  assert.match(html, /src="\/analytics\.js"/)
  assert.match(read('public/analytics.js'), /G-8VWZ2SPG0Q/)
  assert.doesNotMatch(html, /GTM-PTN9FZCL/)

  assert.match(read('src/i18n/provider.tsx'), /trackPageView\('\/' \+ locale \+ '\/',/)
  assert.match(read('src/i18n/provider.tsx'), /trackLanguageSwitch\(locale, next\)/)
  assert.match(read('src/App.tsx'), /trackSectionView\(id, locale\)/)
  assert.match(read('src/App.tsx'), /trackCtaClick\('concierge_email', 'concierge_modal'\)/)
  assert.match(read('src/Hero.tsx'), /trackCtaClick\('book_now', 'hero'\)/)
  assert.match(read('src/FleetSection.tsx'), /trackFleetVehicleSelect\(car\.catalogId, car\.name\)/)
  assert.match(read('src/FleetSection.tsx'), /trackFleetViewOpen\(/)
  assert.match(read('src/PricingSection.tsx'), /trackPricingSelect\(planId, serviceId\)/)
  assert.match(read('src/Booking.tsx'), /trackBookingOpen\(service, vehicle, locale\)/)
  assert.match(read('src/Booking.tsx'), /trackBookingStep\(/)
  assert.match(read('src/Booking.tsx'), /response\.status === 201 && data\.status === 'pending'.*trackBookingLead\(/)
  assert.match(read('src/Booking.tsx'), /trackItineraryExport\('pdf'/)
  assert.match(read('src/Booking.tsx'), /trackItineraryExport\('png'/)
})

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
import { ga4InlineSnippet } from '../server/analytics-snippet.mjs'
import { renderJournal } from '../server/journal.mjs'

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
        page_referrer: '',
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
  assert.match(html, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-8VWZ2SPG0Q/)
  assert.doesNotMatch(html, /GTM-PTN9FZCL/)

  assert.match(read('src/i18n/provider.tsx'), /trackPageView\('\/' \+ locale \+ '\/', meta\.title, locale\)/)
  assert.match(read('src/i18n/provider.tsx'), /trackLanguageSwitch\(locale, next\)/)
  assert.match(read('src/App.tsx'), /trackSectionView\(id, locale\)/)
  assert.match(read('src/App.tsx'), /trackCtaClick\('concierge_email', 'concierge_modal'\)/)
  assert.match(read('src/Hero.tsx'), /trackCtaClick\('book_now', 'hero'\)/)
  assert.match(read('src/FleetSection.tsx'), /trackFleetVehicleSelect\(car\.catalogId, car\.name\)/)
  assert.match(read('src/FleetSection.tsx'), /trackFleetViewOpen\(/)
  assert.match(read('src/PricingSection.tsx'), /trackPricingSelect\(planId, serviceId\)/)
  assert.match(read('src/Booking.tsx'), /trackBookingOpen\(service, vehicle, locale\)/)
  assert.match(read('src/Booking.tsx'), /trackBookingStep\(/)
  assert.match(read('src/Booking.tsx'), /trackBookingLead\(/)
  assert.match(read('src/Booking.tsx'), /trackItineraryExport\('pdf'/)
  assert.match(read('src/Booking.tsx'), /trackItineraryExport\('png'/)
  assert.match(read('src/App.tsx'), /trackCtaClick\('journal_nav'/)
})

test('SEO service and journal pages embed Direct GA4 without blocking or GTM', () => {
  const snippet = ga4InlineSnippet({ pageType: 'service_page', locale: 'ko', slug: 'seoul-chauffeur-service' })
  assert.match(snippet, /G-8VWZ2SPG0Q/)
  assert.match(snippet, /cta_click/)
  assert.match(snippet, /contact_click/)
  assert.match(snippet, /seo_content_click/)
  assert.doesNotMatch(snippet, /<script src=|GTM-PTN9FZCL|GTM-K64295SC/)

  const journalHtml = renderJournal('ko', [], '', false)
  assert.match(journalHtml, /G-8VWZ2SPG0Q/)
  assert.match(journalHtml, /journal_index/)
  assert.doesNotMatch(journalHtml, /\/analytics\.js|GTM-PTN9FZCL|GTM-K64295SC/)

  const searchScript = read('scripts/build-search-pages.mjs')
  assert.match(searchScript, /ga4InlineSnippet/)
  assert.doesNotMatch(searchScript, /\/analytics\.js/)
})

test('SPA page views ignore query strings and fragments, and reject non-public routes', () => {
  withMockBrowser({ hostname: 'www.jpchauffeurkorea.com', pathname: '/en/', search: '?email=private@example.com' }, calls => {
    trackPageView('/en/?email=private@example.com#secret', 'English', 'en')
    trackPageView('/en/?phone=private', 'English', 'en')
    trackPageView('/admin/live', 'Admin', 'en')
    assert.equal(calls.length, 1)
    assert.equal(calls[0][2].page_location, 'https://www.jpchauffeurkorea.com/en/')
    assert.doesNotMatch(JSON.stringify(calls), /private|secret|admin/)
  })
})

test('mixed multi-day leads are counted once with no private request key or journey details', () => {
  withMockBrowser({hostname:'www.jpchauffeurkorea.com',pathname:'/en/',search:''}, calls => {
    const params={total:900000, serviceId:'airport',vehicleId:'g90',tripMode:'multi_day',dayCount:2,optionCount:0,contactMethod:'email',locale:'en',requestKey:'private-request-key',journeys:[{service:'airport',vehicle:'g90',pickup:'private-address'},{service:'day',vehicle:'staria'}]}
    trackBookingLead(params)
    trackBookingLead(params)
    assert.equal(calls.length,1)
    assert.equal(calls[0][2].service_id,'mixed')
    assert.equal(calls[0][2].vehicle_id,'mixed')
    assert.equal(calls[0][2].value,900000)
    assert.doesNotMatch(JSON.stringify(calls),/private|requestKey|journeys/)
    trackBookingLead({...params,requestKey:'different-key',journeys:[{service:'day',vehicle:'g90'},{service:'day',vehicle:'g90'}]})
    assert.equal(calls.length,2)
    assert.equal(calls[1][2].service_id,'day')
    assert.equal(calls[1][2].vehicle_id,'g90')
  })
})
test('lead telemetry fails safely and retries if delivery to gtag failed', () => {
  withMockBrowser({hostname:'www.jpchauffeurkorea.com',pathname:'/ko/',search:''}, calls => {
    const params={total:NaN,serviceId:'private-email@example.com',vehicleId:'private-address',tripMode:'single_day',dayCount:1,optionCount:0,contactMethod:'private-phone',locale:'ko',requestKey:'private-key'}
    const gtag=globalThis.window.gtag
    globalThis.window.gtag=()=>{throw new Error('tag failure')}
    assert.doesNotThrow(()=>trackBookingLead(params))
    globalThis.window.gtag=gtag
    trackBookingLead(params)
    trackBookingLead(params)
    assert.equal(calls.length,1)
    assert.equal(calls[0][2].service_id,'unknown')
    assert.equal(calls[0][2].vehicle_id,'unknown')
    assert.equal(calls[0][2].contact_method,'unknown')
    assert.equal(calls[0][2].value,0)
    assert.equal(calls[0][2].quote_required,true)
    assert.doesNotMatch(JSON.stringify(calls),/private/)
  })
})

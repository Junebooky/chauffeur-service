export const GA4_MEASUREMENT_ID = 'G-8VWZ2SPG0Q'

export const PRODUCTION_HOSTS = new Set([
  'www.jpchauffeurkorea.com',
  'jpchauffeurkorea.com',
])

export function isAdminOrLabPath(pathname, search = '') {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  try {
    return new URLSearchParams(search).get('glass-lab') === '1'
  } catch {
    return false
  }
}

export function isDebugAnalytics(search = '') {
  try {
    return new URLSearchParams(search).get('ga_debug') === '1'
  } catch {
    return false
  }
}

/**
 * Only track public customer journeys on production domains (or when
 * `?ga_debug=1` is explicitly requested). Never track `/admin` or `?glass-lab=1`.
 */
export function shouldTrackAnalytics(loc) {
  const target =
    loc ?? (typeof globalThis.window !== 'undefined' ? globalThis.window.location : null)
  if (!target) return false
  if (isAdminOrLabPath(target.pathname, target.search)) return false
  return PRODUCTION_HOSTS.has(target.hostname) || isDebugAnalytics(target.search)
}

function sanitizeParams(params) {
  const clean = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') clean[key] = value
  }
  return clean
}

function sendGtag(command, target, params = {}) {
  const win = globalThis.window
  if (typeof win === 'undefined' || !shouldTrackAnalytics(win.location)) return
  if (typeof win.gtag !== 'function') return
  const payload = sanitizeParams(params)
  if (isDebugAnalytics(win.location.search)) payload.debug_mode = true
  win.gtag(command, target, payload)
}

let lastTrackedPath = ''
const viewedSections = new Set()

export function resetAnalyticsSessionForTests() {
  lastTrackedPath = ''
  viewedSections.clear()
}

export function trackPageView(path, title, locale) {
  if (!path || path === lastTrackedPath) return
  lastTrackedPath = path
  const win = globalThis.window
  sendGtag('event', 'page_view', {
    page_path: path,
    page_location:
      typeof win !== 'undefined' && win.location?.origin
        ? `${win.location.origin}${path}`
        : undefined,
    page_title: title,
    locale,
  })
}

export function trackEvent(name, params = {}) {
  sendGtag('event', name, params)
}

export function trackLanguageSwitch(fromLocale, toLocale) {
  if (fromLocale === toLocale) return
  trackEvent('language_switch', {
    from_locale: fromLocale,
    to_locale: toLocale,
  })
}

export function trackSectionView(sectionId, locale) {
  const key = `${locale}:${sectionId}`
  if (viewedSections.has(key)) return
  viewedSections.add(key)
  trackEvent('section_view', {
    section_id: sectionId,
    locale,
  })
}

export function trackCtaClick(ctaName, location, extra = {}) {
  trackEvent('cta_click', {
    cta_name: ctaName,
    cta_location: location,
    ...extra,
  })
}

export function trackFleetVehicleSelect(vehicleId, vehicleName) {
  trackEvent('fleet_vehicle_select', {
    vehicle_id: vehicleId,
    vehicle_name: vehicleName,
  })
}

export function trackFleetViewOpen(vehicleId, viewCategory) {
  trackEvent('fleet_view_open', {
    vehicle_id: vehicleId,
    view_category: viewCategory,
  })
}

export function trackPricingSelect(planId, serviceId) {
  trackEvent('pricing_plan_select', {
    plan_id: planId,
    service_id: serviceId ?? 'custom',
  })
}

export function trackBookingOpen(serviceId, vehicleId, locale) {
  trackEvent('begin_checkout', {
    service_id: serviceId,
    vehicle_id: vehicleId,
    locale,
  })
}

export function trackBookingStep({
  stepName,
  tripMode,
  dayCount,
  serviceId,
  vehicleId,
  locale,
}) {
  trackEvent('booking_step_progress', {
    step_name: stepName,
    trip_mode: tripMode,
    day_count: dayCount,
    service_id: serviceId,
    vehicle_id: vehicleId,
    locale,
  })
}

/**
 * Primary GA4 conversion event (`generate_lead`). Strictly excludes all PII
 * (no customer name, email, phone, messenger handle, flight, or street address).
 */
export function trackBookingLead({
  total,
  serviceId,
  vehicleId,
  tripMode,
  dayCount,
  optionCount,
  contactMethod,
  locale,
}) {
  trackEvent('generate_lead', {
    currency: 'KRW',
    value: typeof total === 'number' ? total : 0,
    quote_required: total === null,
    service_id: serviceId,
    vehicle_id: vehicleId,
    trip_mode: tripMode,
    day_count: dayCount,
    option_count: optionCount,
    contact_method: contactMethod,
    locale,
  })
}

export function trackBookingEmailFallback(dayCount, locale) {
  trackEvent('booking_email_fallback', {
    day_count: dayCount,
    locale,
  })
}

export function trackItineraryExport(format, dayCount, locale) {
  trackEvent('itinerary_export', {
    export_format: format,
    day_count: dayCount,
    locale,
  })
}

export function trackContactClick(location, method = 'email') {
  trackEvent('contact_click', {
    contact_location: location,
    contact_method: method,
  })
}

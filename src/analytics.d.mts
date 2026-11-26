export const GA4_MEASUREMENT_ID: string
export const PRODUCTION_HOSTS: ReadonlySet<string>

export type GtagParamValue = string | number | boolean | undefined
export type AnalyticsParams = Record<string, GtagParamValue>

export interface AnalyticsLocationLike {
  hostname: string
  pathname: string
  search: string
}

export function isAdminOrLabPath(pathname: string, search?: string): boolean
export function isDebugAnalytics(search?: string): boolean
export function shouldTrackAnalytics(loc?: AnalyticsLocationLike | null): boolean
export function resetAnalyticsSessionForTests(): void
export function trackPageView(path: string, title: string, locale: string): void
export function trackEvent(name: string, params?: AnalyticsParams): void
export function trackLanguageSwitch(fromLocale: string, toLocale: string): void
export function trackSectionView(sectionId: string, locale: string): void
export function trackCtaClick(ctaName: string, location: string, extra?: AnalyticsParams): void
export function trackFleetVehicleSelect(vehicleId: string, vehicleName: string): void
export function trackFleetViewOpen(vehicleId: string, viewCategory: string): void
export function trackPricingSelect(planId: string, serviceId: string | null): void
export function trackBookingOpen(serviceId: string, vehicleId: string, locale: string): void
export function trackBookingStep(params: {
  stepName: 'daily_schedule' | 'vehicle' | 'details'
  tripMode: 'single_day' | 'multi_day'
  dayCount: number
  serviceId: string
  vehicleId: string
  locale: string
}): void
export function trackBookingLead(params: {
  total: number | null
  serviceId: string
  vehicleId: string
  tripMode: 'single_day' | 'multi_day'
  dayCount: number
  optionCount: number
  contactMethod: string
  locale: string
  journeys?: ReadonlyArray<{ service: string; vehicle: string }>
  requestKey?: string
}): void
export function trackBookingEmailFallback(dayCount: number, locale: string): void
export function trackItineraryExport(format: 'pdf' | 'png', dayCount: number, locale: string): void
export function trackContactClick(location: string, method?: string): void

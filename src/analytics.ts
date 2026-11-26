type EventName = 'chauffeur_page_view'|'view_vehicle'|'select_service'|'begin_booking'|'booking_step'|'generate_lead'
type EventParams = { vehicle?: string; service?: string; step?: number; journey_type?: 'single'|'multiple' }
type AnalyticsWindow = Window & { chauffeurAnalytics?: {track: (name:EventName, params?:EventParams)=>void;refreshLocale:()=>void} }
export function trackAnalytics(name:EventName,params:EventParams={}) {
  try { (window as AnalyticsWindow).chauffeurAnalytics?.track(name,params) } catch { /* analytics must never block a reservation */ }
}
export function refreshAnalyticsLocale(){
  try { (window as AnalyticsWindow).chauffeurAnalytics?.refreshLocale() } catch { /* optional analytics */ }
}

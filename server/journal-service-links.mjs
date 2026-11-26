// Reviewed public service paths only. Never construct a link from a CMS field.
const services = [
 {slug:'seoul-chauffeur-service', en:'Seoul Chauffeur Service', ko:'서울 VIP 의전'},
 {slug:'incheon-airport-transfer', en:'Incheon Airport Transfer', ko:'인천공항 픽업·샌딩'},
 {slug:'private-driver-seoul', en:'Private Driver in Seoul', ko:'서울 기사 포함 차량'},
]
const preferred = new Map([
 ['incheon-airport-pickup-checklist','incheon-airport-transfer'],
 ['seoul-executive-chauffeur-itinerary','seoul-chauffeur-service'],
 ['seoul-conference-delegation-transport','seoul-chauffeur-service'],
 ['chauffeur-vehicle-luggage-selection','private-driver-seoul'],
])
export function journalServiceLinks(lang, articleSlug='') {
 const locale=lang==='ko'?'ko':'en'
 const first=preferred.get(articleSlug)
 return [...services].sort((a,b)=>Number(b.slug===first)-Number(a.slug===first)).map(s=>({
  href:'/'+(locale==='ko'?'ko/':'')+'services/'+s.slug+'/',
  label:s[locale],
 }))
}

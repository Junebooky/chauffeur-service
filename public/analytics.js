/* One direct GA4 tag, public pages only, opt-in. */
(function(){
 'use strict'
 const w=window,d=document,loc=w.location,GA='G-8VWZ2SPG0Q',KEY='chauffeur.analytics-consent.v1'
 const publicPath=p=>/^\/(?:(?:en|ko)\/?)?$/.test(p)||/^\/(?:ko\/)?(?:services|journal)(?:\/[a-z0-9-]+)?\/?$/.test(p)
 const debug=new URLSearchParams(loc.search).get('ga_debug')==='1'
 const allowedHost=loc.protocol==='https:'&&['www.jpchauffeurkorea.com','jpchauffeurkorea.com'].includes(loc.hostname)
 const debugLocal=debug&&['localhost','127.0.0.1'].includes(loc.hostname)
 if((!allowedHost&&!debugLocal)||!publicPath(loc.pathname)||new URLSearchParams(loc.search).get('glass-lab')==='1')return
 const layer=w.dataLayer=w.dataLayer||[]
 function push(){layer.push(arguments)}
 const consentValue=v=>({analytics_storage:v,ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})
 let consent=false,loaded=false,lastPage='',controls,choice=null
 try{choice=w.localStorage.getItem(KEY)}catch{}
 const language=()=>d.documentElement.lang==='ko'?'ko':'en'
 const t=(en,ko)=>language()==='ko'?ko:en
 const page=()=>loc.origin+loc.pathname
 const referrer=()=>{try{const u=new URL(d.referrer);if(!['http:','https:'].includes(u.protocol))return '';return u.origin===loc.origin&&publicPath(u.pathname)?u.origin+u.pathname:u.origin+'/'}catch{return ''}}
 const eventNames=new Set(['page_view','language_switch','section_view','cta_click','fleet_vehicle_select','fleet_view_open','pricing_plan_select','begin_checkout','booking_step_progress','generate_lead','booking_email_fallback','itinerary_export','contact_click'])
 const ids=new Set(['from_locale','to_locale','section_id','cta_name','cta_location','vehicle_id','view_category','plan_id','service_id','locale','step_name','trip_mode','contact_method','export_format','contact_location'])
 // Programmatic IDs only. No arbitrary free text or customer identifiers.
 const safeParams=p=>{
  const out={}
  for(const [key,val] of Object.entries(p||{})){
   if(ids.has(key)&&typeof val==='string'&&/^[a-z0-9_-]{1,64}$/i.test(val))out[key]=val
   if(['day_count','option_count'].includes(key)&&Number.isInteger(val)&&val>=0&&val<=366)out[key]=val
   if(key==='value'&&typeof val==='number'&&Number.isFinite(val)&&val>=0)out.value=val
   if(key==='currency'&&val==='KRW')out.currency=val
   if(key==='quote_required'&&typeof val==='boolean')out.quote_required=val
  }
  out.page_location=page();out.page_referrer=referrer()
  if(debugLocal)out.debug_mode=true
  return out
 }
 function event(name,params){
  if(!consent||!publicPath(loc.pathname)||!eventNames.has(name))return false
  const payload=safeParams(params)
  if(name==='page_view'){
   if(lastPage===page())return false
   lastPage=page();payload.page_path=loc.pathname;payload.page_title=d.title;payload.locale=language()
  }
  push('event',name,payload)
  return true
 }
 w.gtag=(command,name,params)=>command==='event'?event(name,params):false
 w['ga-disable-'+GA]=true
 push('consent','default',consentValue('denied'))
 function activate(){
  if(consent)return
  consent=true;w['ga-disable-'+GA]=false
  push('consent','update',consentValue('granted'))
  if(!loaded){
   loaded=true
   push('js',new Date())
   push('config',GA,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:page(),page_referrer:referrer(),...(debugLocal?{debug_mode:true}:{})})
   const s=d.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+GA
   d.head.appendChild(s)
  }
  // Wait for locale/provider effects on SPA; static pages are already ready.
  w.requestAnimationFrame(()=>event('page_view'))
 }
 function setChoice(next){
  choice=next
  try{w.localStorage.setItem(KEY,next)}catch{}
  if(next==='allow')activate()
  else{consent=false;lastPage='';w['ga-disable-'+GA]=true;push('consent','update',consentValue('denied'))}
  render(false)
 }
 function render(open){
  if(!controls){
   controls=d.createElement('aside');controls.setAttribute('aria-label','Analytics preferences')
   controls.style.cssText='position:fixed;left:12px;bottom:12px;z-index:75;max-width:min(350px,calc(100vw - 24px));font:13px/1.45 system-ui,sans-serif;color:#e7e8e5'
   d.body.appendChild(controls)
  }
  controls.replaceChildren()
  const button=(label,fn)=>{const b=d.createElement('button');b.type='button';b.textContent=label;b.style.cssText='font:inherit;color:#e7e8e5;background:#1c201e;border:1px solid #505650;border-radius:6px;padding:7px 10px;cursor:pointer';b.addEventListener('click',fn);return b}
  if(!open){controls.append(button(t('Analytics settings','분석 설정'),()=>render(true)));return}
  const panel=d.createElement('div');panel.style.cssText='background:#141715;border:1px solid #424842;border-radius:9px;padding:12px;box-shadow:0 8px 24px #0005'
  const p=d.createElement('p');p.style.margin='0 0 10px';p.textContent=t('Optional Google Analytics helps us improve our service. Booking works without it.','선택적 Google Analytics 분석은 서비스 개선에 사용됩니다. 동의하지 않아도 예약할 수 있습니다.')
  const actions=d.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap'
  actions.append(button(t('Essential only','필수만 허용'),()=>setChoice('deny')),button(t('Allow analytics','분석 허용'),()=>setChoice('allow')))
  panel.append(p,actions);controls.append(panel)
 }
 w.chauffeurAnalyticsRefresh=()=>render(choice!=='allow'&&choice!=='deny')
 if(choice==='allow')activate()
 w.chauffeurAnalyticsRefresh()
 w.addEventListener('popstate',()=>{w.chauffeurAnalyticsRefresh();w.requestAnimationFrame(()=>event('page_view'))})
})()

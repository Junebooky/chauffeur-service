/* Optional public-page analytics. No customer data or booking identifiers. */
(function(){
 'use strict'
 const w=window,d=document,loc=w.location
 const publicPath=p=>/^\/(?:(?:en|ko)\/?)?$/.test(p)||/^\/(?:ko\/)?(?:services|journal)(?:\/[a-z0-9-]+)?\/?$/.test(p)
 if(loc.protocol!=='https:'||loc.hostname!=='www.jpchauffeurkorea.com'||!publicPath(loc.pathname)||loc.search.includes('glass-lab='))return
 const KEY='chauffeur.analytics-consent.v1',GTM='GTM-PTN9FZCL',GA='G-8VWZ2SPG0Q'
 let consent=false,loaded=false,lastPage='',choice=null,controls
 const lang=()=>d.documentElement.lang==='ko'?'ko':'en'
 const t=(en,ko)=>lang()==='ko'?ko:en
 const layer=w.dataLayer=w.dataLayer||[]
 function gtag(){layer.push(arguments)}
 const consentValue=v=>({analytics_storage:v,ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})
 gtag('consent','default',consentValue('denied'))
 w['ga-disable-'+GA]=true
 try{choice=w.localStorage.getItem(KEY)}catch{}
 const events=new Set(['chauffeur_page_view','view_vehicle','select_service','begin_booking','booking_step','generate_lead'])
 const vehicles=new Set(['staria','carnival_limousine','g90','sprinter_319'])
 const services=new Set(['airport','day'])
 function track(event,params={}){
  if(!consent||!publicPath(loc.pathname)||!events.has(event))return
  const page=loc.origin+loc.pathname
  if(event==='chauffeur_page_view'){if(lastPage===page)return;lastPage=page}
  const safe={event,page_location:page,language:lang()}
  if(vehicles.has(params.vehicle))safe.vehicle=params.vehicle
  if(services.has(params.service))safe.service=params.service
  if([1,2,3].includes(params.step))safe.booking_step=params.step
  if(['single','multiple'].includes(params.journey_type))safe.journey_type=params.journey_type
  layer.push(safe)
 }
 function activate(){
  consent=true;w['ga-disable-'+GA]=false
  gtag('consent','update',consentValue('granted'))
  if(!loaded){
   loaded=true
   layer.push({'gtm.start':Date.now(),event:'gtm.js'})
   const s=d.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id='+GTM
   d.head.appendChild(s)
  }
  track('chauffeur_page_view')
 }
 function setChoice(next){
  choice=next
  try{w.localStorage.setItem(KEY,next)}catch{}
  if(next==='allow'){if(!consent)activate()}
  else{consent=false;lastPage='';w['ga-disable-'+GA]=true;gtag('consent','update',consentValue('denied'))}
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
  const p=d.createElement('p');p.style.margin='0 0 10px';p.textContent=t('Optional analytics helps us improve our service. Booking works without it.','선택적 방문 분석은 서비스 개선에 사용됩니다. 동의하지 않아도 예약할 수 있습니다.')
  const actions=d.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap'
  actions.append(button(t('Essential only','필수만 허용'),()=>setChoice('deny')),button(t('Allow analytics','분석 허용'),()=>setChoice('allow')))
  panel.append(p,actions);controls.append(panel)
 }
 w.chauffeurAnalytics={track,refreshLocale:()=>{render(choice!=='allow'&&choice!=='deny');track('chauffeur_page_view')}}
 if(choice==='allow')activate()
 render(choice!=='allow'&&choice!=='deny')
 w.addEventListener('popstate',()=>w.chauffeurAnalytics.refreshLocale())
})()

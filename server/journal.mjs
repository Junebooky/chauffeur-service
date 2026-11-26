import { db, ApiError, validUuid } from './chauffeur-supabase.mjs'
import { ga4InlineSnippet } from './analytics-snippet.mjs'
const table='journal_articles'
const select='id,slug,lang,title,description,intro,sections,publish_at,updated_at'
const domain='https://www.jpchauffeurkorea.com'
const enc=encodeURIComponent
const slugOk=s=>typeof s==='string'&&s.length>=3&&s.length<=100&&s!=='sitemap'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)
const langOk=l=>l==='en'||l==='ko'
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const text=(s,min,max)=>{if(typeof s!=='string'||s.trim().length<min||s.trim().length>max)throw new ApiError(400,'Check article content.');return s.trim()}
const date=s=>{if(typeof s!=='string'||!Number.isFinite(Date.parse(s)))throw new ApiError(400,'Invalid date.');return new Date(s).toISOString()}
const pathFor=(lang,slug='')=>'/'+(lang==='ko'?'ko/':'')+'journal/'+(slug?slug+'/':'')
const urlFor=(lang,slug='')=>domain+pathFor(lang,slug)
const filter=(now)=>'status=eq.approved&publish_at=lte.'+enc(now)
export const isPublic=(r,now)=>r?.status==='approved'&&Number.isFinite(Date.parse(r.publish_at))&&Date.parse(r.publish_at)<=Date.parse(now)
const publicFields=rows=>(rows||[]).map(r=>Object.fromEntries(select.split(',').map(k=>[k,r[k]])))
export async function publicArticles(lang,slug='',now=new Date().toISOString(),database=db){
 if(!langOk(lang)||slug&&!slugOk(slug))throw new ApiError(404,'Page not found.')
 const rows=await database(table+'?select='+select+',status&'+filter(now)+'&lang=eq.'+lang+(slug?'&slug=eq.'+enc(slug):'')+'&order=publish_at.desc&limit='+(slug?'1':'200'))
 return publicFields((rows||[]).filter(r=>isPublic(r,now)&&r.lang===lang&&(!slug||r.slug===slug)))
}
export async function journalSitemap(now=new Date().toISOString(),database=db){
 const urls=[urlFor('en'),urlFor('ko')]
 // bounded pagination; no drafts, future records, or admin URLs
 for(let offset=0;offset<10000;offset+=500){
  const rows=await database(table+'?select=lang,slug,status,publish_at&'+filter(now)+'&order=id.asc&limit=500&offset='+offset)
  for(const r of rows||[])if(isPublic(r,now)&&langOk(r.lang)&&slugOk(r.slug))urls.push(urlFor(r.lang,r.slug))
  if(!rows||rows.length<500)break
 }
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...new Set(urls)].map(u=>'<url><loc>'+esc(u)+'</loc></url>').join('')+'</urlset>'
}
export async function journalRss(lang,now=new Date().toISOString(),database=db){
 const rows=(await publicArticles(lang,'',now,database)).slice(0,50)
 const title=lang==='ko'?'Chauffeur Journal — 의전 서비스 가이드':'Chauffeur Journal — Private Travel Guides'
 return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>'+esc(title)+'</title><link>'+urlFor(lang)+'</link><description>'+esc(title)+'</description><language>'+lang+'</language>'+rows.map(r=>'<item><title>'+esc(r.title)+'</title><link>'+urlFor(lang,r.slug)+'</link><guid isPermaLink="true">'+urlFor(lang,r.slug)+'</guid><description>'+esc(r.description)+'</description><pubDate>'+new Date(r.publish_at).toUTCString()+'</pubDate></item>').join('')+'</channel></rss>'
}
export function validateDraft(b){
 if(!slugOk(b.slug)||!langOk(b.lang))throw new ApiError(400,'Check article slug and language.')
 if(!Array.isArray(b.sections)||b.sections.length<2||b.sections.length>12)throw new ApiError(400,'Add 2–12 sections.')
 return {slug:b.slug,lang:b.lang,title:text(b.title,5,160),description:text(b.description,10,320),intro:text(b.intro,20,1200),sections:b.sections.map(s=>({heading:text(s?.heading,2,140),body:text(s?.body,20,4000)}))}
}
export async function journalAdmin(staff,b,now=new Date().toISOString(),database=db){
 if(staff?.role!=='owner'||!validUuid(staff.id))throw new ApiError(403,'Owner access required.')
 if(b.action==='list')return database(table+'?select='+select+',status,approved_at&order=updated_at.desc&limit=200')
 if(b.action==='save_draft'&&!b.id){
  return database(table,{method:'POST',prefer:'return=representation',body:{...validateDraft(b),status:'draft',updated_at:now}})
 }
 if(!validUuid(b.id))throw new ApiError(400,'Invalid article.')
 const expected=date(b.expected_updated_at)
 const q=table+'?id=eq.'+b.id+'&updated_at=eq.'+enc(expected)
 let patch,path=q
 if(b.action==='save_draft'){
  path+='&status=eq.draft'
  patch={...validateDraft(b),updated_at:now}
 }else if(b.action==='approve'){
  if(b.confirm!==true)throw new ApiError(400,'Explicit review confirmation required.')
  path+='&status=eq.draft'
  patch={status:'approved',publish_at:date(b.publish_at),approved_at:now,approved_by:staff.id,updated_at:now}
 }else if(b.action==='archive'){
  path+='&status=in.(draft,approved)'
  patch={status:'archived',updated_at:now}
 }else throw new ApiError(400,'Unknown action.')
 const rows=await database(path,{method:'PATCH',prefer:'return=representation',body:patch})
 if(!rows?.length)throw new ApiError(409,'Article changed. Refresh before trying again.')
 return rows
}
const journalIndex = {
  "en": {
    "title": "Korea Chauffeur Travel Guides",
    "description": "Plan private transport in Korea with practical guides to Incheon Airport pickups, executive visits, vehicle selection and multi-day chauffeur itineraries.",
    "intro": "Planning a journey in South Korea starts with the right transport details. Our Journal covers airport arrivals, executive visits and private chauffeur itineraries, with practical advice for travellers and corporate travel planners.",
    "sections": [
      [
        "Airport arrivals",
        "Before requesting an airport pickup, confirm your arrival airport and terminal, flight number, expected pickup time and final destination. Include passenger and luggage counts so the team can review suitable vehicle options. For a departure transfer, work backwards from your check-in time and allow for travel conditions."
      ],
      [
        "Executive and private itineraries",
        "Prepare meeting locations, hotel addresses, planned stops and time windows for each day. If the route changes during a visit, share the updated details with the operations team. For multi-day journeys, organise the schedule by date so that vehicle and timing requirements can be reviewed separately."
      ],
      [
        "Choosing a vehicle",
        "Consider passenger numbers, luggage, accessibility needs and the purpose of your trip rather than vehicle size alone. Compare the published fleet and request the appropriate service. A reservation request is subject to review and confirmation; submitting a request does not itself guarantee a vehicle."
      ]
    ],
    "articles": "Latest guides",
    "empty": "New guides will appear here once published.",
    "language": "한국어"
  },
  "ko": {
    "title": "한국 의전 차량 이용 가이드",
    "description": "인천공항 픽업과 샌딩, 기업 VIP 의전, 차량 선택 및 여러 날의 맞춤 이동 일정에 필요한 준비 사항과 예약 요청 방법을 안내합니다.",
    "intro": "한국에서 공항 이동이나 기업 방문, 개인 일정을 준비할 때 필요한 의전 차량 이용 정보를 안내합니다. 여행객과 출장 담당자가 운행 계획을 정리하고 예약 요청에 필요한 사항을 확인할 수 있도록 실용적인 가이드를 제공합니다.",
    "sections": [
      [
        "공항 픽업과 샌딩 준비",
        "공항 도착 시 이용할 공항과 터미널, 항공편명, 희망 승차 시간, 최종 목적지를 확인하세요. 탑승 인원과 수하물 수량도 함께 전달하면 적합한 차량을 검토하는 데 도움이 됩니다. 출국 일정은 항공사 체크인 시간과 교통 상황을 고려해 승차 시간을 정하는 것이 좋습니다."
      ],
      [
        "기업 의전 및 맞춤 이동 일정",
        "회의 장소, 숙소, 경유지, 각 일정의 희망 시간을 정리하세요. 일정이 바뀌면 운영팀에 변경 사항을 전달해 주세요. 여러 날 차량을 이용할 때는 날짜별로 출발지와 목적지, 경유지, 탑승 시간을 구분하면 차량과 운행 조건을 검토하기 쉽습니다."
      ],
      [
        "이용 목적에 맞는 차량 선택",
        "탑승 인원과 수하물뿐 아니라 이동 목적, 승하차 편의성, 필요한 지원 사항도 고려해 차량을 선택하세요. 공개된 차량 목록과 서비스 정보를 참고하여 예약을 요청할 수 있으며, 실제 예약은 운영팀 검토와 확정 안내를 거쳐 진행됩니다."
      ]
    ],
    "articles": "최근 가이드",
    "empty": "새 가이드는 공개 승인 후 이곳에 표시됩니다.",
    "language": "English"
  }
}
const style=':root{color-scheme:dark;background:#101211;color:#e6e8e5;font:16px/1.75 system-ui,sans-serif}body{margin:0}header,main,footer{max-width:850px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #393d39}a{color:inherit;text-underline-offset:4px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:clamp(32px,6vw,52px)}h2{font-size:26px}p{color:#c2c7c2;white-space:pre-wrap}article{border-bottom:1px solid #393d39;padding:18px 0}footer{border-top:1px solid #393d39}';
export function renderJournal(lang,rows,slug='',alternate=false){
 const item=slug?rows[0]:null
 const index=journalIndex[lang]
 const title=item?.title||index.title
 const description=item?.description||index.description
 const canonical=urlFor(lang,slug),other=lang==='en'?'ko':'en'
 const alternateTags=(!slug||alternate)?'<link rel="alternate" hreflang="'+lang+'" href="'+canonical+'"><link rel="alternate" hreflang="'+other+'" href="'+urlFor(other,slug)+'"><link rel="alternate" hreflang="x-default" href="'+urlFor('en',slug)+'">':''
 const body=item?'<h1>'+esc(item.title)+'</h1><p>'+esc(item.intro)+'</p>'+item.sections.map(s=>'<section><h2>'+esc(s.heading)+'</h2><p>'+esc(s.body)+'</p></section>').join(''):'<h1>'+esc(title)+'</h1><p>'+esc(index.intro)+'</p>'+index.sections.map(([heading,body])=>'<section><h2>'+esc(heading)+'</h2><p>'+esc(body)+'</p></section>').join('')+'<section><h2>'+esc(index.articles)+'</h2>'+(rows.length?rows.map(r=>'<article><h3><a href="'+pathFor(lang,r.slug)+'">'+esc(r.title)+'</a></h3><p>'+esc(r.description)+'</p></article>').join(''):'<p>'+esc(index.empty)+'</p>')+'</section>'
 const services=['seoul-chauffeur-service','incheon-airport-transfer','private-driver-seoul']
 const serviceLabels=lang==='ko'?['서울 VIP 의전','인천공항 픽업·샌딩','서울 기사 포함 차량']:['Seoul Chauffeur Service','Incheon Airport Transfer','Private Driver in Seoul']
 const serviceLinks='<nav aria-label="Services">'+services.map((s,i)=>'<p><a href="/'+(lang==='ko'?'ko/':'')+'services/'+s+'/">'+serviceLabels[i]+'</a></p>').join('')+'</nav>'
 const languageLink='<a lang="'+other+'"'+(!slug||alternate?' hreflang="'+other+'"':'')+' href="'+pathFor(other,alternate?slug:'')+'">'+esc(index.language)+'</a>'
 const schema=item?'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:item.title,description:item.description,url:canonical,datePublished:item.publish_at,inLanguage:lang,author:{'@type':'Organization',name:'JP Chauffeur Korea'},publisher:{'@type':'Organization',name:'JP Chauffeur Korea'}}).replace(/</g,'\\u003c')+'</script>':''
 return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | JP Chauffeur Korea</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'">'+alternateTags+'<meta property="og:type" content="'+(item?'article':'website')+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+canonical+'"><link rel="alternate" type="application/rss+xml" title="Journal RSS" href="'+urlFor(lang)+'rss.xml">'+schema+'<style>'+style+'</style>'+ga4InlineSnippet({pageType:slug?'journal_article':'journal_index',locale:lang,slug})+'</head><body><header><a href="/'+lang+'/">JP CHAUFFEUR KOREA</a><a href="'+pathFor(lang)+'">Journal</a>'+languageLink+'</header><main>'+body+'<p><a href="/'+lang+'/#reservation">'+(lang==='ko'?'예약 요청하기':'Request a reservation')+'</a></p>'+serviceLinks+'</main><footer>JP Chauffeur Korea</footer></body></html>'
}

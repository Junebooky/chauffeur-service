import { db, ApiError, validUuid } from './chauffeur-supabase.mjs'
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
const style=':root{color-scheme:dark;background:#101211;color:#e6e8e5;font:16px/1.75 system-ui,sans-serif}body{margin:0}header,main,footer{max-width:850px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #393d39}a{color:inherit;text-underline-offset:4px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:clamp(32px,6vw,52px)}h2{font-size:26px}p{color:#c2c7c2;white-space:pre-wrap}article{border-bottom:1px solid #393d39;padding:18px 0}footer{border-top:1px solid #393d39}';
export function renderJournal(lang,rows,slug='',alternate=false){
 const item=slug?rows[0]:null
 const title=item?.title||(lang==='ko'?'Chauffeur Journal — 의전 서비스 가이드':'Chauffeur Journal — Private Travel Guides')
 const description=item?.description||(lang==='ko'?'한국 의전 차량 및 이동 일정 안내':'Guides to private chauffeur journeys in Korea.')
 const canonical=urlFor(lang,slug),other=lang==='en'?'ko':'en'
 const alternateTags=(!slug||alternate)?'<link rel="alternate" hreflang="'+lang+'" href="'+canonical+'"><link rel="alternate" hreflang="'+other+'" href="'+urlFor(other,slug)+'">':''
 const body=item?'<h1>'+esc(item.title)+'</h1><p>'+esc(item.intro)+'</p>'+item.sections.map(s=>'<section><h2>'+esc(s.heading)+'</h2><p>'+esc(s.body)+'</p></section>').join(''):'<h1>'+esc(title)+'</h1>'+rows.map(r=>'<article><h2><a href="'+pathFor(lang,r.slug)+'">'+esc(r.title)+'</a></h2><p>'+esc(r.description)+'</p></article>').join('')
 const services=['seoul-chauffeur-service','incheon-airport-transfer','private-driver-seoul']
 const serviceLabels=lang==='ko'?['서울 VIP 의전','인천공항 픽업·샌딩','서울 기사 포함 차량']:['Seoul Chauffeur Service','Incheon Airport Transfer','Private Driver in Seoul']
 const serviceLinks='<nav aria-label="Services">'+services.map((s,i)=>'<p><a href="/'+(lang==='ko'?'ko/':'')+'services/'+s+'/">'+serviceLabels[i]+'</a></p>').join('')+'</nav>'
 const schema=item?'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:item.title,description:item.description,url:canonical,datePublished:item.publish_at,inLanguage:lang,author:{'@type':'Organization',name:'JP Chauffeur Korea'},publisher:{'@type':'Organization',name:'JP Chauffeur Korea'}}).replace(/</g,'\\u003c')+'</script>':''
 return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | JP Chauffeur Korea</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'">'+alternateTags+'<link rel="alternate" type="application/rss+xml" title="Journal RSS" href="'+urlFor(lang)+'rss.xml">'+schema+'<style>'+style+'</style><script defer src="/analytics.js"></script></head><body><header><a href="/'+lang+'/">JP CHAUFFEUR KOREA</a><a href="'+pathFor(lang)+'">Journal</a></header><main>'+body+'<p><a href="/'+lang+'/#reservation">'+(lang==='ko'?'예약 요청하기':'Request a reservation')+'</a></p>'+serviceLinks+'</main><footer>JP Chauffeur Korea</footer></body></html>'
}

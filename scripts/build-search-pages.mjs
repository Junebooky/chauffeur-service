// Generate crawlable bilingual service pages and sitemap from reviewed content.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const domain='https://www.jpchauffeurkorea.com'
const pages=JSON.parse(readFileSync(join(root,'seo/service-pages.json'),'utf8'))
const catalog=JSON.parse(readFileSync(join(root,'src/catalog.json'),'utf8'))
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const jsonLd=v=>JSON.stringify(v).replace(/</g,'\\u003c')
const pathFor=(slug,lang)=>'/' + (lang==='ko'?'ko/':'')+'services/'+slug+'/'
const urlFor=(slug,lang)=>domain+pathFor(slug,lang)
const vehicles=catalog.vehicles.filter(v=>v.bookable!==false)
const locale={
 en:{home:'Home',services:'Services',reserve:'Request a reservation',fleet:'Vehicle options',passengers:'passengers',other:'Explore other services',contact:'Contact our team',notice:'Vehicle and itinerary requests are subject to review and confirmation.',language:'한국어'},
 ko:{home:'홈',services:'서비스',reserve:'예약 요청하기',fleet:'차량 선택',passengers:'인승 (카탈로그 기준)',other:'다른 서비스 살펴보기',contact:'문의하기',notice:'차량 및 일정은 운영팀 검토 후 확정됩니다.',language:'English'}
}
function validate(){
 const slugs=new Set()
 for(const p of pages){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||slugs.has(p.slug))throw Error('Invalid or duplicate SEO slug')
  slugs.add(p.slug)
  if(!catalog.services.some(s=>s.id===p.service&&s.id!=='hourly'))throw Error('Invalid service: '+p.slug)
  for(const lang of ['en','ko']){
   const c=p[lang]
   if(!c||![c.title,c.description,c.intro].every(x=>typeof x==='string'&&x.trim())||!Array.isArray(c.sections)||c.sections.length<2||c.sections.some(s=>!Array.isArray(s)||s.length!==2||s.some(x=>typeof x!=='string'||!x.trim())))throw Error('Incomplete translation: '+p.slug)
  }
 }
}
const style=':root{color-scheme:dark;background:#101211;color:#e9eae7;font:16px/1.75 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0}a{color:inherit;text-underline-offset:.25em}header,main,footer{max-width:1050px;margin:auto;padding:28px 24px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #383b38}header a{text-decoration:none}main{max-width:900px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:clamp(32px,6vw,57px);margin:35px 0 22px}h2{font-size:27px;margin:35px 0 12px}p{color:#c3c7c2}nav{display:flex;gap:18px;flex-wrap:wrap}.vehicles{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px}.vehicle{border:1px solid #353a36;padding:16px;border-radius:8px}.vehicle img{width:100%;height:100px;object-fit:contain}.vehicle strong{display:block}.cta{display:inline-block;margin:16px 0;padding:12px 24px;background:#e3e6e2;color:#121412;border-radius:6px;text-decoration:none}.small{font-size:13px;color:#a9b0aa}footer{border-top:1px solid #383b38}';
function render(p,lang){
 const c=p[lang],l=locale[lang],canonical=urlFor(p.slug,lang),alt=lang==='en'?'ko':'en';
 const schema={'@context':'https://schema.org','@type':'Service',name:c.title,description:c.description,url:canonical,provider:{'@type':'Organization',name:'JP Chauffeur Korea',url:domain+'/'},areaServed:{'@type':'Country',name:'South Korea'}};
 return '<!doctype html><html lang="'+lang+'"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(c.title)+' | JP Chauffeur Korea</title><meta name="description" content="'+esc(c.description)+'"><link rel="canonical" href="'+canonical+'"><link rel="alternate" hreflang="en" href="'+urlFor(p.slug,'en')+'"><link rel="alternate" hreflang="ko" href="'+urlFor(p.slug,'ko')+'"><link rel="alternate" hreflang="x-default" href="'+urlFor(p.slug,'en')+'"><meta property="og:type" content="website"><meta property="og:title" content="'+esc(c.title)+'"><meta property="og:description" content="'+esc(c.description)+'"><meta property="og:url" content="'+canonical+'"><link rel="icon" href="/media/brand/favicon-jp.png"><script type="application/ld+json">'+jsonLd(schema)+'</script><style>'+style+'</style><script defer src="/analytics.js"></script></head><body><header><a href="/'+lang+'/">JP CHAUFFEUR KOREA</a><nav><a href="/'+lang+'/">'+l.home+'</a><a href="'+pathFor(p.slug,alt)+'" lang="'+alt+'">'+l.language+'</a></nav></header><main><p class="small">'+l.services+'</p><h1>'+esc(c.title)+'</h1><p>'+esc(c.intro)+'</p><a class="cta" href="/'+lang+'/#reservation">'+l.reserve+'</a>'+c.sections.map(s=>'<section><h2>'+esc(s[0])+'</h2><p>'+esc(s[1])+'</p></section>').join('')+'<section><h2>'+l.fleet+'</h2><div class="vehicles">'+vehicles.map(v=>'<div class="vehicle"><img loading="lazy" src="'+esc(v.image)+'" alt="'+esc(v.name)+'"><strong>'+esc(v.name)+'</strong><span>'+esc(v.passengers)+' '+l.passengers+'</span></div>').join('')+'</div><p class="small">'+l.notice+'</p></section><section><h2>'+l.other+'</h2><ul>'+pages.filter(q=>q.slug!==p.slug).map(q=>'<li><a href="'+pathFor(q.slug,lang)+'">'+esc(q[lang].title)+'</a></li>').join('')+'</ul></section><a class="cta" href="/'+lang+'/#reservation">'+l.reserve+'</a></main><footer><a href="mailto:topcs2026@gmail.com">'+l.contact+'</a> · JP Chauffeur Korea</footer></body></html>'
}
export function buildSearchPages(outDir=join(root,'dist')){
 validate()
 mkdirSync(outDir,{recursive:true})
 const locations=[domain+'/']
 // Preserve existing or multilingual build-generated URLs, without blindly
 // advertising routes that have not been implemented. Existing XML is trusted
 // repository output; only retain same-origin locations.
 try{const prior=readFileSync(join(outDir,'sitemap.xml'),'utf8');for(const match of prior.matchAll(/<loc>([^<]+)<\/loc>/g)){const u=new URL(match[1]);if(u.origin===domain&&!/^\/(?:admin|api)(?:\/|$)/.test(u.pathname))locations.push(u.href)}}catch{}
 for(const p of pages)for(const lang of ['en','ko']){
  const path=pathFor(p.slug,lang),dir=join(outDir,path.slice(1));mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'index.html'),render(p,lang));locations.push(domain+path)
 }
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...new Set(locations)].map(loc=>'  <url><loc>'+esc(loc)+'</loc></url>').join('\n')+'\n</urlset>\n'
 writeFileSync(join(outDir,'sitemap.xml'),xml)
 let robots='User-agent: *\nDisallow: /api/\n\nSitemap: '+domain+'/sitemap.xml\n'
 try{robots=readFileSync(join(outDir,'robots.txt'),'utf8')}catch{}
 const journalSitemap='Sitemap: '+domain+'/journal/sitemap.xml'
 if(!robots.includes(journalSitemap))writeFileSync(join(outDir,'robots.txt'),robots.trimEnd()+'\n'+journalSitemap+'\n')
 return [...new Set(locations)]
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Search pages:',buildSearchPages().length,'sitemap URLs')

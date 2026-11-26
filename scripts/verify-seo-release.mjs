// Read-only release smoke checks: no booking, analytics events, index requests, or deployment.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { siteOrigin, organizationId, websiteId } from '../server/public-schema.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const pages=JSON.parse(await readFile(join(root,'seo/service-pages.json'),'utf8'))
const pair=(en,ko,type='WebPage')=>[
 {path:en,canonical:en,lang:'en',en,ko,type},
 {path:ko,canonical:ko,lang:'ko',en,ko,type},
]
export const staticPages=[
 ...pair('/','/ko/'),
 {path:'/en/',canonical:'/',lang:'en',en:'/',ko:'/ko/',type:'WebPage'},
 ...pages.flatMap(p=>pair('/services/'+p.slug+'/','/ko/services/'+p.slug+'/','Service')),
]
export const journalPages=pair('/journal/','/ko/journal/','CollectionPage')
const url=path=>siteOrigin+path
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),m[2]??m[3]]))
const tags=(html,name)=>[...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(m=>attributes(m[0]))
const values=(nodes,key,value,field)=>nodes.filter(x=>x[key]===value).map(x=>x[field])
const eq=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i])
const indexBlocked=s=>/\b(?:noindex|none)\b/i.test(s)
export function checkPublicPage(html,p,{robotsHeader=''}={}){
 const errors=[]
 const require=(condition,message)=>{if(!condition)errors.push(message)}
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]??''
 const links=tags(head,'link'),meta=tags(head,'meta')
 require(tags(html,'html')[0]?.lang===p.lang,'incorrect HTML language')
 require(eq(values(links,'rel','canonical','href'),[url(p.canonical)]),'canonical missing, duplicate or incorrect')
 require(eq(values(meta,'property','og:url','content'),[url(p.canonical)]),'og:url incorrect')
 require(Boolean(head.match(/<title>[^<]+\S[^<]*<\/title>/i)),'missing title')
 require(values(meta,'name','description','content').some(v=>v?.trim()),'missing meta description')
 require(/<h1\b[^>]*>\s*[^<]+<\/h1>/i.test(html),'missing crawlable H1')
 require(!indexBlocked(robotsHeader)&&!meta.some(m=>/^(robots|googlebot|bingbot|oai-searchbot|perplexitybot)$/i.test(m.name??'')&&indexBlocked(m.content??'')),'public page has noindex')
 for(const [lang,path] of [['en',p.en],['ko',p.ko],['x-default',p.en]]){
  require(eq(links.filter(x=>x.rel==='alternate'&&x.hreflang===lang).map(x=>x.href),[url(path)]),'incorrect hreflang '+lang)
 }
 const scripts=[...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>attributes(m[1]).type==='application/ld+json'&&/\bdata-public-schema\b/.test(m[1]))
 require(scripts.length===1,'expected one public entity graph')
 try{
  const graph=JSON.parse(scripts[0]?.[2]??'null')
  const nodes=graph?.['@graph']??[]
  require(graph?.['@context']==='https://schema.org','invalid schema context')
  require(nodes.some(n=>n['@type']==='Organization'&&n['@id']===organizationId),'missing common Organization')
  require(nodes.some(n=>n['@type']==='WebSite'&&n['@id']===websiteId),'missing common WebSite')
  require(nodes.some(n=>n['@type']===p.type&&n.url===url(p.canonical)),'missing canonical page entity '+p.type)
 }catch{errors.push('invalid public JSON-LD')}
 return errors
}
const locations=xml=>[...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m=>m[1])
export function checkSitemap(xml,journal=false){
 const errors=[],locs=locations(xml)
 if(!/<urlset\b/.test(xml))errors.push('not a URL sitemap')
 if(new Set(locs).size!==locs.length)errors.push('duplicate sitemap locations')
 const expected=journal?journalPages:staticPages.filter(p=>p.path===p.canonical)
 for(const p of expected)if(!locs.includes(url(p.path)))errors.push('missing sitemap URL '+p.path)
 for(const loc of locs){
  if(journal){
   if(!loc.startsWith(siteOrigin+'/')||!/^\/(?:ko\/)?journal\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?$/.test(loc.slice(siteOrigin.length)))errors.push('unexpected journal sitemap URL')
  }else if(!expected.some(p=>loc===url(p.path)))errors.push('unexpected main sitemap URL')
 }
 return errors
}
export function checkRobots(body){
 const errors=[]
 if(!/^User-agent:\s*\*\s*$/im.test(body)||!/^Disallow:\s*\/api\/\s*$/im.test(body))errors.push('expected wildcard/API rule missing')
 for(const path of ['/sitemap.xml','/journal/sitemap.xml'])if(!body.split(/\r?\n/).some(l=>l.trim()==='Sitemap: '+url(path)))errors.push('missing robots sitemap '+path)
 // Conservative release contract for the current simple policy; manual review if rules change.
 const directives=body.split(/\r?\n/).map(l=>l.split('#')[0].trim()).filter(Boolean)
 if(directives.some(l=>/^Disallow\s*:/i.test(l)&&!/^Disallow:\s*(?:\/api\/)?$/i.test(l)))errors.push('unexpected crawl restriction: review robots policy')
 return errors
}
export async function verifyRelease({live=false,dist=join(root,'dist'),fetcher=fetch}={}){
 const results=[]
 async function check(path,validator,kind='html'){
  let errors=[]
  try{
   let body,robotsHeader=''
   if(live){
    const res=await fetcher(url(path),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'JPChauffeur-ReleaseCheck/1.0'}})
    if(res.status!==200)throw Error('HTTP '+res.status)
    const ct=res.headers.get('content-type')??''
    if(kind==='html'&&!ct.includes('text/html')||kind==='xml'&&!/xml/.test(ct)||kind==='text'&&!ct.includes('text/plain'))throw Error('unexpected content type')
    robotsHeader=res.headers.get('x-robots-tag')??''
    body=await res.text()
   }else body=await readFile(join(dist,path.slice(1),kind==='html'?'index.html':''),'utf8')
   errors=validator(body,{robotsHeader})
  }catch(e){errors=[e.message]}
  results.push({path,ok:errors.length===0,errors})
 }
 for(const p of [...staticPages,...(live?journalPages:[])])await check(p.path,(html,headers)=>checkPublicPage(html,p,headers))
 await check('/sitemap.xml',body=>checkSitemap(body),'xml')
 await check('/robots.txt',checkRobots,'text')
 if(live){
  await check('/journal/sitemap.xml',body=>checkSitemap(body,true),'xml')
  for(const p of journalPages)await check(p.path+'rss.xml',body=>/<rss\b/.test(body)&&body.includes('<link>'+url(p.path)+'</link>')?[]:['invalid journal RSS'],'xml')
 }
 return results
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2)
 if(args.some(a=>a!=='--live'))throw Error('Use no arguments for dist validation, or --live for public read-only GET checks.')
 const results=await verifyRelease({live:args.includes('--live')})
 for(const r of results)console.log((r.ok?'PASS ':'FAIL ')+r.path+(r.ok?'':' — '+r.errors.join('; ')))
 console.log(results.filter(r=>r.ok).length+'/'+results.length+' release checks passed')
 if(results.some(r=>!r.ok))process.exitCode=1
}

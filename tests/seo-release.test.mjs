import {test} from 'node:test'
import assert from 'node:assert/strict'
import {checkPublicPage,checkSitemap,checkRobots,staticPages,journalPages,verifyRelease} from '../scripts/verify-seo-release.mjs'
import {siteOrigin,homeSchema,serviceSchema,journalSchema,jsonLdScript} from '../server/public-schema.mjs'
const fixture=p=>{
 const url=siteOrigin+p.canonical,params={url,lang:p.lang,title:'Title',description:'Description'}
 const graph=p.type==='Service'?serviceSchema(params):p.type==='CollectionPage'?journalSchema(params):homeSchema(params)
 return '<html lang="'+p.lang+'"><head><title>Title</title><meta name="description" content="Description"><meta property="og:url" content="'+url+'"><link rel="canonical" href="'+url+'">'+[['en',p.en],['ko',p.ko],['x-default',p.en]].map(([lang,path])=>'<link rel="alternate" hreflang="'+lang+'" href="'+siteOrigin+path+'">').join('')+jsonLdScript(graph)+'</head><body><h1>Title</h1></body></html>'
}
const sitemap=ps=>'<urlset>'+ps.map(p=>'<url><loc>'+siteOrigin+p.path+'</loc></url>').join('')+'</urlset>'
const robots='User-agent: *\nDisallow: /api/\nSitemap: '+siteOrigin+'/sitemap.xml\nSitemap: '+siteOrigin+'/journal/sitemap.xml\n'
test('release checker catches wrong canonicals, noindex and missing graph',()=>{
 for(const p of [...staticPages,...journalPages])assert.deepEqual(checkPublicPage(fixture(p),p),[])
 const p=staticPages[0],html=fixture(p)
 assert.ok(checkPublicPage(html,p,{robotsHeader:'noindex'}).includes('public page has noindex'))
 assert.ok(checkPublicPage(html.replace('rel="canonical"','rel="broken"'),p).some(e=>e.includes('canonical')))
 assert.ok(checkPublicPage(html.replace('data-public-schema','data-other'),p).some(e=>e.includes('entity graph')))
 assert.ok(checkPublicPage(html.replace('<h1>Title</h1>',''),p).some(e=>e.includes('H1')))
})
test('sitemaps exclude alias and private routes, robots retains API exclusion',()=>{
 const canon=staticPages.filter(p=>p.path===p.canonical)
 assert.deepEqual(checkSitemap(sitemap(canon)),[])
 assert.ok(checkSitemap(sitemap(staticPages)).includes('unexpected main sitemap URL'))
 assert.ok(checkSitemap(sitemap([...canon,{path:'/admin/'}])).length)
 assert.deepEqual(checkSitemap(sitemap([...journalPages,{path:'/journal/test-guide/'}]),true),[])
 assert.ok(checkSitemap(sitemap([...journalPages,{path:'/admin/'}]),true).length)
 assert.deepEqual(checkRobots(robots),[])
 assert.ok(checkRobots(robots+'Disallow: /\n').length)
})
test('live release check uses only fixed public GET routes and fails on HTTP error',async()=>{
 const requested=[]
 const results=await verifyRelease({live:true,fetcher:async(url,opts)=>{
  requested.push(url)
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual')
  const path=url.slice(siteOrigin.length),p=[...staticPages,...journalPages].find(p=>p.path===path)
  if(p)return new Response(fixture(p),{status:path==='/ko/'?404:200,headers:{'content-type':'text/html'}})
  if(path==='/robots.txt')return new Response(robots,{headers:{'content-type':'text/plain'}})
  const xml=path==='/sitemap.xml'?sitemap(staticPages.filter(p=>p.path===p.canonical)):path==='/journal/sitemap.xml'?sitemap(journalPages):'<rss><channel><link>'+siteOrigin+path.replace('rss.xml','')+'</link></channel></rss>'
  return new Response(xml,{headers:{'content-type':'application/xml'}})
 }})
 assert.equal(requested.length,16)
 assert.equal(results.filter(x=>!x.ok).length,1)
 assert.deepEqual(results.find(x=>x.path==='/ko/').errors,['HTTP 404'])
 assert.ok(requested.every(x=>!x.includes('/api/')&&!x.includes('/admin/')))
})

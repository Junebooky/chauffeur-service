import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {buildSearchPages} from '../scripts/build-search-pages.mjs'
import {renderJournal} from '../server/journal.mjs'
import {siteOrigin,organizationId,websiteId} from '../server/public-schema.mjs'
const parse=html=>{
 const matches=[...html.matchAll(/<script type="application\/ld\+json" data-public-schema>([\s\S]*?)<\/script>/g)]
 assert.equal(matches.length,1)
 const data=JSON.parse(matches[0][1])
 assert.equal(data['@context'],'https://schema.org')
 const nodes=data['@graph']
 assert.equal(new Set(nodes.map(n=>n['@id'])).size,nodes.length)
 const org=nodes.find(n=>n['@id']===organizationId)
 assert.equal(org.name,'JP Chauffeur Korea')
 assert.equal(org.url,siteOrigin+'/')
 assert.equal(nodes.find(n=>n['@id']===websiteId).publisher['@id'],organizationId)
 for(const n of nodes)for(const key of ['publisher','provider','author','isPartOf','mainEntity','mainEntityOfPage','about']){
  if(n[key])assert.ok(nodes.some(x=>x['@id']===n[key]['@id']),key+' has a resolved entity')
 }
 return nodes
}
test('generated public home and service pages share canonical organization identity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'chauffeur-schema-'))
 try{
  for(const folder of ['', 'en','ko']){
   const p=join(dir,folder);mkdirSync(p,{recursive:true});writeFileSync(join(p,'index.html'),'<html><head></head><body><div id="root"></div></body></html>')
  }
  buildSearchPages(dir);buildSearchPages(dir)
  for(const folder of ['', 'en','ko']){
   const nodes=parse(readFileSync(join(dir,folder,'index.html'),'utf8'))
   const page=nodes.find(n=>n['@type']==='WebPage')
   assert.equal(page.url,siteOrigin+(folder==='ko'?'/ko/':'/'))
   assert.equal(page.inLanguage,folder==='ko'?'ko':'en')
  }
  const pages=JSON.parse(readFileSync(new URL('../seo/service-pages.json',import.meta.url),'utf8'))
  for(const p of pages)for(const lang of ['en','ko']){
   const path=(lang==='ko'?'ko/':'')+'services/'+p.slug+'/'
   const html=readFileSync(join(dir,path,'index.html'),'utf8')
   const nodes=parse(html)
   const service=nodes.find(n=>n['@type']==='Service')
   assert.equal(service.url,siteOrigin+'/'+path)
   assert.equal(service.name,p[lang].title)
   assert.equal(service.provider['@id'],organizationId)
   assert.equal(service.offers,undefined)
   assert.equal(service.aggregateRating,undefined)
   assert.ok(html.includes('href="/'+(lang==='ko'?'ko/':'')+'journal/"'))
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('Journal graphs distinguish index and article and escape article title',()=>{
 for(const lang of ['en','ko']){
  const index=parse(renderJournal(lang,[],'',false))
  assert.ok(index.some(n=>n['@type']==='CollectionPage'))
  const row={slug:'airport-guide',title:'<script>alert(1)</script>',description:'Guide',intro:'Plan your route',sections:[],publish_at:'2026-11-26T00:00:00Z'}
  const html=renderJournal(lang,[row],row.slug,false)
  const article=parse(html).find(n=>n['@type']==='Article')
  assert.equal(article.headline,row.title)
  assert.equal(article.author['@id'],organizationId)
  assert.equal(article.datePublished,row.publish_at)
  assert.doesNotMatch(html,/<script>alert\(1\)/)
 }
})

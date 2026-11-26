import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {renderJournal,journalSitemap,journalRss} from '../server/journal.mjs'
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'))
test('canonical journal routes with trailing slash and legacy slashless URLs are both rewritten',()=>{
 for(const [prefix,lang] of [['/journal','en'],['/ko/journal','ko']]){
  for(const suffix of ['', '/']){
   assert.equal(config.rewrites.find(r=>r.source===prefix+suffix)?.destination,'/api/journal?lang='+lang)
   assert.equal(config.rewrites.find(r=>r.source===prefix+'/:slug'+suffix)?.destination,'/api/journal?lang='+lang+'&slug=:slug')
  }
  const rss=config.rewrites.findIndex(r=>r.source===prefix+'/rss.xml')
  assert.ok(rss>=0&&rss<config.rewrites.findIndex(r=>r.source===prefix+'/:slug'))
 }
 assert.ok(config.rewrites.findIndex(r=>r.source==='/journal/sitemap.xml')<config.rewrites.findIndex(r=>r.source==='/journal/:slug'))
})
test('journal public canonical, sitemap, and RSS agree on slash URLs',async()=>{
 const now='2026-11-26T09:00:00Z',row={slug:'airport-guide',lang:'en',status:'approved',publish_at:now,title:'Airport guide',description:'A practical guide',intro:'Prepare your travel details.',sections:[{heading:'Arrival',body:'Check the terminal.'}]}
 const html=renderJournal('en',[row],row.slug,false)
 assert.match(html,/rel="canonical" href="https:\/\/www.jpchauffeurkorea.com\/journal\/airport-guide\/"/)
 assert.match(await journalSitemap(now,async()=>[row]),/\/journal\/airport-guide\//)
 assert.match(await journalRss('en',now,async()=>[row]),/\/journal\/airport-guide\//)
})

test('journal indexes provide distinct useful content and reciprocal language links without scripts',()=>{
 for(const lang of ['en','ko']){
  const other=lang==='en'?'ko':'en',prefix=lang==='ko'?'/ko':'',otherPrefix=other==='ko'?'/ko':''
  const html=renderJournal(lang,[],'',false)
  const title=html.match(/<title>([^<]+)<\/title>/)[1]
  const description=html.match(/<meta name="description" content="([^"]+)"/)[1]
  assert.ok(title.length<=60)
  assert.ok(description.length>=60&&description.length<=160)
  assert.equal((html.match(/<section><h2>/g)||[]).length,4)
  assert.ok(html.includes('hreflang="'+other+'" href="'+otherPrefix+'/journal/"'))
  assert.ok(html.includes('hreflang="x-default" href="https://www.jpchauffeurkorea.com/journal/"'))
  assert.ok(html.includes('property="og:url" content="https://www.jpchauffeurkorea.com'+prefix+'/journal/"'))
  assert.match(html,lang==='en'?/Airport arrivals/:/공항 픽업과 샌딩 준비/)
 }
})
test('article language link only points to the translated article when one is public',()=>{
 const row={slug:'airport-guide',title:'Guide',description:'A guide',intro:'Travel details',sections:[]}
 const translated=renderJournal('en',[row],row.slug,true)
 assert.ok(translated.includes('hreflang="ko" href="/ko/journal/airport-guide/"'))
 const untranslated=renderJournal('en',[row],row.slug,false)
 assert.ok(untranslated.includes('href="/ko/journal/"'))
 assert.doesNotMatch(untranslated,/hreflang="x-default"/)
})

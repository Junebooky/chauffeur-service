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

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {publicArticles,journalAdmin,journalSitemap,renderJournal,validateDraft} from '../server/journal.mjs'
const now='2026-11-26T10:00:00.000Z',id='a3cf6400-d7b5-4056-b47b-e9d49ee8a0a3'
const draft={id,slug:'airport-guide',lang:'en',title:'Airport pickup guide',description:'A helpful airport guide for private travel.',intro:'Plan a private pickup for your airport trip.',sections:[{heading:'Before arrival',body:'Check your terminal before arrival.'},{heading:'Vehicle choice',body:'Choose the vehicle for your group.'}],updated_at:now}
test('only approved due articles can enter public HTML or sitemap',async()=>{
 const rows=[{...draft,status:'draft',publish_at:now},{...draft,slug:'future',status:'approved',publish_at:'2027-01-01T00:00:00Z'},{...draft,slug:'live',title:'<script>alert(1)</script>',status:'approved',publish_at:now,approved_by:id}]
 const db=async path=>{assert.match(path,/status=eq.approved&publish_at=lte./);return rows}
 const live=await publicArticles('en','',now,db)
 assert.deepEqual(live.map(r=>r.slug),['live'])
 assert.equal(live[0].approved_by,undefined)
 const html=renderJournal('en',live,'live',false)
 assert.match(html,/&lt;script&gt;/)
 assert.doesNotMatch(html,/<script>alert/)
 assert.doesNotMatch(html,/hreflang="ko"/)
 const sitemap=await journalSitemap(now,db)
 assert.match(sitemap,/\/journal\/live\//)
 assert.doesNotMatch(sitemap,/airport-guide|future/)
})
test('owner-only approval requires explicit confirmation, draft status and optimistic lock',async()=>{
 const owner={id,role:'owner'}
 let called=0
 const db=async(path,opts)=>{called++;assert.match(path,/status=eq.draft/);assert.match(path,/updated_at=eq./);assert.equal(opts.body.approved_by,id);return [opts.body]}
 await assert.rejects(journalAdmin({...owner,role:'operator'},{action:'list'},now,db),/Owner/)
 await assert.rejects(journalAdmin(owner,{action:'approve',id,expected_updated_at:now,publish_at:now},now,db),/confirmation/)
 assert.equal(called,0)
 const rows=await journalAdmin(owner,{action:'approve',id,expected_updated_at:now,publish_at:'2027-01-01T00:00:00Z',confirm:true},now,db)
 assert.equal(rows[0].status,'approved');assert.equal(called,1)
 await assert.rejects(journalAdmin(owner,{action:'approve',id,expected_updated_at:now,publish_at:now,confirm:true},now,async()=>[]),/changed/)
 assert.throws(()=>validateDraft({...draft,slug:'../secret'}))
})

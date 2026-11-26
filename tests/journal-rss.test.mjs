import {test} from 'node:test'
import assert from 'node:assert/strict'
import {journalRss} from '../server/journal.mjs'
test('RSS exposes only approved due language-matched articles and escapes HTML',async()=>{
 const now='2026-11-26T09:00:00Z',rows=[{slug:'live',lang:'en',title:'A & B',description:'<unsafe>',status:'approved',publish_at:now},{slug:'hidden',lang:'en',status:'draft',publish_at:now},{slug:'future',lang:'en',status:'approved',publish_at:'2027-01-01T00:00:00Z'},{slug:'other',lang:'ko',status:'approved',publish_at:now}]
 const rss=await journalRss('en',now,async()=>rows)
 assert.match(rss,/<rss version="2.0">/)
 assert.match(rss,/A &amp; B/)
 assert.match(rss,/&lt;unsafe&gt;/)
 assert.match(rss,/\/journal\/live\//)
 assert.doesNotMatch(rss,/hidden|future|\/journal\/other\//)
})

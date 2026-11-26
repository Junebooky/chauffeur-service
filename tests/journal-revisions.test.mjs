import {test} from 'node:test'
import assert from 'node:assert/strict'
import {journalAdmin,publicArticles} from '../server/journal.mjs'
const id='a3cf6400-d7b5-4056-b47b-e9d49ee8a0a3',token='d6a334d2-95b5-4ca5-bbd5-2054c3915bad'
const owner={id,role:'owner'},now='2026-11-26T11:00:00.000Z',version='2026-11-26T10:00:00.123456+00:00'
const draft={slug:'airport-guide',lang:'en',title:'Airport pickup guide',description:'A useful airport pickup guide.',intro:'Prepare your private airport journey.',sections:[{heading:'Arrival',body:'Check your terminal before you arrive.'},{heading:'Vehicle',body:'Choose a vehicle for your travel needs.'}]}
const live={...draft,id,status:'approved',publish_at:'2026-11-25T10:00:00Z',updated_at:version,revision_token:null,revision_draft:null}
const request={id,expected_updated_at:version,expected_revision_token:null}
test('save revision does not change public content, timestamp or identity',async()=>{
 let patch
 const db=async(path,opts)=>{assert.ok(path.includes(encodeURIComponent(version)));assert.match(path,/status=eq.approved&publish_at=lte./);assert.match(path,/revision_token=is.null/);if(!opts)return [live];patch=opts.body;return [{...live,...patch}]}
 const result=await journalAdmin(owner,{...draft,...request,action:'save_revision',title:'Revised airport pickup'},now,db)
 assert.equal(result[0].title,live.title);assert.equal(result[0].updated_at,version)
 assert.deepEqual(Object.keys(patch).sort(),['revision_draft','revision_token'])
 assert.equal(patch.revision_draft.title,'Revised airport pickup')
 assert.match(patch.revision_token,/^[a-f0-9-]{36}$/)
 const publicRows=await publicArticles('en','',now,async()=>result)
 assert.equal(publicRows[0].revision_draft,undefined);assert.equal(publicRows[0].revision_token,undefined);assert.equal(publicRows[0].title,live.title)
})
test('approval publishes saved draft atomically with explicit owner review, preserves URL and original date',async()=>{
 const saved={...live,revision_token:token,revision_draft:{...draft,title:'Revised airport pickup'}}
 let writes=0
 const db=async(path,opts)=>{assert.match(path,new RegExp('revision_token=eq.'+token));if(!opts)return [saved];writes++;assert.equal(opts.body.title,'Revised airport pickup');assert.equal(opts.body.updated_at,now);assert.equal(opts.body.approved_by,id);assert.equal(opts.body.revision_token,null);for(const k of ['slug','lang','publish_at','status'])assert.equal(Object.hasOwn(opts.body,k),false);return [{...saved,...opts.body}]}
 const req={...request,expected_revision_token:token,action:'approve_revision',title:'unreviewed body'}
 await assert.rejects(journalAdmin(owner,req,now,db),/confirmation/)
 await assert.rejects(journalAdmin({...owner,role:'operator'},{...req,confirm:true},now,db),/Owner/)
 const rows=await journalAdmin(owner,{...req,confirm:true},now,db)
 assert.equal(rows[0].publish_at,live.publish_at);assert.equal(writes,1)
 await assert.rejects(journalAdmin(owner,{...req,confirm:true},now,async(path,opts)=>opts?[]:[saved]),/changed/)
})
test('stale, future or archived revision and identity changes fail; discard keeps live content',async()=>{
 await assert.rejects(journalAdmin(owner,{...draft,...request,action:'save_revision'},now,async()=>[]),/changed/)
 await assert.rejects(journalAdmin(owner,{...draft,...request,action:'save_revision',slug:'new-url'},now,async()=>[live]),/cannot change/)
 const saved={...live,revision_token:token,revision_draft:draft}
 const db=async(path,opts)=>{if(!opts)return [saved];assert.deepEqual(opts.body,{revision_draft:null,revision_token:null});return [{...saved,...opts.body}]}
 await journalAdmin(owner,{...request,action:'discard_revision',expected_revision_token:token},now,db)
})

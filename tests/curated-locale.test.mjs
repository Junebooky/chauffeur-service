import test from 'node:test'
import assert from 'node:assert/strict'
import popular from '../server/popular-places.json' with { type: 'json' }
import { curatedLabels, curatedSearchTerms, curatedPlaceForLocale } from '../src/i18n/curated-places.mjs'
import { searchPlaces, resolvePlace, validatePlaceSelection } from '../server/places-serverless.mjs'
const sessionToken='curated-locale-test-1234'
test('each curated place has bilingual labels and identical server-owned coordinates',()=>{
 for(const p of popular){
  const en=curatedPlaceForLocale(p.id,'en'),ko=curatedPlaceForLocale(p.id,'ko')
  assert.equal(en.name,p.name)
  assert.equal(en.address,p.address)
  assert.match(ko.name,/\p{Script=Hangul}/u)
  assert.match(ko.address,/\p{Script=Hangul}/u)
  assert.equal(ko.latitude,en.latitude)
  assert.equal(ko.longitude,en.longitude)
  assert.equal(ko.isStation,en.isStation)
  assert.ok(curatedSearchTerms(p).includes(p.addressKo))
  assert.deepEqual(validatePlaceSelection({id:p.id,address:'fake',latitude:0,longitude:0},'ko'),ko)
 }
 assert.equal(curatedLabels('unknown','ko'),null)
 assert.match(curatedLabels('curated:hyehwa-station','ko').displayAddress,/지하 120/)
})
test('serverless popular suggestions and resolution use locale, not query language',async()=>{
 for(const locale of ['en','ko']){
  const empty=await searchPlaces({query:'',sessionToken,locale})
  assert.equal(empty.status,200)
  assert.equal(empty.data.results.length,6)
  assert.equal(empty.data.results[0].name,curatedLabels(popular[0].id,locale).name)
  for(const query of ['ICN T1','인천공항 제1여객터미널','인천국제공항 제1여객터미널']){
   const response=await searchPlaces({query,sessionToken,locale})
   assert.equal(response.data.results[0].id,'curated:icn-t1')
   assert.equal(response.data.results[0].address,curatedLabels('curated:icn-t1',locale).address)
  }
  const selected=await resolvePlace({id:'curated:icn-t1',sessionToken,locale})
  assert.deepEqual(selected.data,curatedPlaceForLocale('curated:icn-t1',locale))
 }
})

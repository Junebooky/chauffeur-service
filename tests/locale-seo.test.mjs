import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {localeHtml} from '../scripts/build-locale-html.mjs'
test('localized HTML has reciprocal alternates and independent canonical URLs',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8')
 for(const lang of ['ko','en']){
  const html=localeHtml(source,lang)
  assert.ok(html.includes('<html lang="'+lang+'"'))
  assert.ok(html.includes('rel="canonical" href="https://www.jpchauffeurkorea.com/'+lang+'/"'))
  assert.ok(html.includes('hreflang="ko"'))
  assert.ok(html.includes('hreflang="en"'))
  assert.ok(html.includes('hreflang="x-default"'))
  assert.match(html,lang==='ko'?/<title>.*프리미엄 의전 차량 서비스<\/title>/:/<title>.*Private Chauffeur Service in Seoul<\/title>/)
 }
})

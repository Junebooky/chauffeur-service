import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {localeHtml} from '../scripts/build-locale-html.mjs'
test('localized HTML uses root English canonical and distinct Korean canonical',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8')
 for(const lang of ['ko','en']){
  const html=localeHtml(source,lang)
  assert.ok(html.includes('<html lang="'+lang+'"'))
  assert.ok(html.includes('rel="canonical" href="https://www.jpchauffeurkorea.com'+(lang==='ko'?'/ko/':'/')+'"'))
  assert.ok(html.includes('hreflang="ko"'))
  assert.ok(html.includes('hreflang="en" href="https://www.jpchauffeurkorea.com/"'))
  assert.ok(html.includes('hreflang="x-default"'))
  assert.match(html,lang==='ko'?/<title>.*프리미엄 의전 차량 서비스<\/title>/:/<title>.*Private Chauffeur Service in Seoul<\/title>/)
 }
})

 test('public sitemap excludes duplicate English route and advertises canonical alternates',()=>{
 const xml=readFileSync(new URL('../public/sitemap.xml',import.meta.url),'utf8')
 assert.doesNotMatch(xml, /<loc>https:\/\/www\.jpchauffeurkorea\.com\/en\/<\/loc>/)
 assert.match(xml, /hreflang="en" href="https:\/\/www\.jpchauffeurkorea\.com\/"/)
 })

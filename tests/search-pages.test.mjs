import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildSearchPages} from '../scripts/build-search-pages.mjs'
test('bilingual search pages are readable without JS and use self-canonical language alternates',()=>{
 const dir=mkdtempSync(join(tmpdir(),'chauffeur-seo-'))
 try{
  writeFileSync(join(dir,'sitemap.xml'),'<urlset><url><loc>https://www.jpchauffeurkorea.com/</loc></url><url><loc>https://www.jpchauffeurkorea.com/ko/</loc></url><url><loc>https://www.jpchauffeurkorea.com/en/</loc></url><url><loc>https://www.jpchauffeurkorea.com/admin/live</loc></url></urlset>')
  const urls=buildSearchPages(dir)
  assert.equal(urls.length,8)
  const en=readFileSync(join(dir,'services/seoul-chauffeur-service/index.html'),'utf8')
  const ko=readFileSync(join(dir,'ko/services/seoul-chauffeur-service/index.html'),'utf8')
  assert.match(en,/<html lang="en">/)
  assert.match(ko,/<html lang="ko">/)
  assert.match(en,/<h1>Private Chauffeur Service in Seoul<\/h1>/)
  assert.match(ko,/<h1>서울 VIP 의전 서비스<\/h1>/)
  assert.match(en,/hreflang="ko" href="https:\/\/www.jpchauffeurkorea.com\/ko\/services\/seoul-chauffeur-service\/"/)
  assert.match(ko,/rel="canonical" href="https:\/\/www.jpchauffeurkorea.com\/ko\/services\/seoul-chauffeur-service\/"/)
  assert.match(en,/"@type":"Service"/)
  assert.match(en,/href="\/en\/#reservation"/)
  assert.doesNotMatch(en,/Sprinter 519|<script src=|type="module"/)
  const sitemap=readFileSync(join(dir,'sitemap.xml'),'utf8')
  assert.match(sitemap,/<loc>https:\/\/www.jpchauffeurkorea.com\/ko\/<\/loc>/)
  assert.doesNotMatch(sitemap,/\/admin\/live/)
  assert.doesNotMatch(sitemap,/<loc>https:\/\/www\.jpchauffeurkorea\.com\/en\/<\/loc>/)
  assert.match(sitemap,/<xhtml:link rel="alternate" hreflang="en" href="https:\/\/www\.jpchauffeurkorea\.com\/"\/>/)
  assert.match(sitemap,/<xhtml:link rel="alternate" hreflang="ko" href="https:\/\/www.jpchauffeurkorea.com\/ko\/services\/seoul-chauffeur-service\/"/)
  assert.deepEqual(buildSearchPages(dir),urls)
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('initial HTML exposes useful public navigation before React mounts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'chauffeur-initial-'))
 try{
  for(const folder of ['','en','ko']){
   const p=join(dir,folder);mkdirSync(p,{recursive:true});writeFileSync(join(p,'index.html'),'<html><body><div id="root"></div></body></html>')
  }
  buildSearchPages(dir)
  const en=readFileSync(join(dir,'en/index.html'),'utf8'),ko=readFileSync(join(dir,'ko/index.html'),'utf8')
  assert.match(en,/<h1>JP Chauffeur Korea \| Private Chauffeur Service in Seoul<\/h1>/)
  assert.match(ko,/<h1>JP Chauffeur Korea \| 프리미엄 의전 차량 서비스<\/h1>/)
  assert.match(en,/href="\/journal\/"/);assert.match(ko,/href="\/ko\/journal\/"/)
  assert.match(en,/href="\/services\/incheon-airport-transfer\/"/)
  assert.match(ko,/href="\/ko\/services\/incheon-airport-transfer\/"/)
  buildSearchPages(dir)
  assert.equal(readFileSync(join(dir,'en/index.html'),'utf8'),en)
 }finally{rmSync(dir,{recursive:true,force:true})}
})

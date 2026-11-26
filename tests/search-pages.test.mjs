import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildSearchPages} from '../scripts/build-search-pages.mjs'
test('bilingual search pages are readable without JS and use self-canonical language alternates',()=>{
 const dir=mkdtempSync(join(tmpdir(),'chauffeur-seo-'))
 try{
  writeFileSync(join(dir,'sitemap.xml'),'<urlset><url><loc>https://www.jpchauffeurkorea.com/</loc></url><url><loc>https://www.jpchauffeurkorea.com/ko/</loc></url><url><loc>https://www.jpchauffeurkorea.com/admin/live</loc></url></urlset>')
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
  assert.match(sitemap,/<xhtml:link rel="alternate" hreflang="ko" href="https:\/\/www.jpchauffeurkorea.com\/ko\/services\/seoul-chauffeur-service\/"/)
  assert.deepEqual(buildSearchPages(dir),urls)
 }finally{rmSync(dir,{recursive:true,force:true})}
})

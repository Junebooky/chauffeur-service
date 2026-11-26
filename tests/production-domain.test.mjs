import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('production domain metadata uses canonical www and keeps admin routes out of search',()=>{
 const site='https://www.jpchauffeurkorea.com/'
 assert.ok(read('index.html').includes('rel="canonical" href="'+site+'"'))
 assert.ok(read('index.html').includes('<meta name="naver-site-verification" content="e8bc57b622cd9de0d846b0d510d69b295f6788d1" />'))
 assert.ok(read('index.html').includes('https://www.googletagmanager.com/gtm.js?id=GTM-PTN9FZCL'))
 assert.ok(read('public/sitemap.xml').includes('<loc>'+site+'</loc>'))
 assert.ok(!read('public/sitemap.xml').includes('/admin'))
 assert.ok(read('public/robots.txt').includes('Sitemap: '+site+'sitemap.xml'))
 const config=JSON.parse(read('vercel.json'))
 for(const path of ['/admin','/admin/','/admin/:path*','/api/:path*']){
  assert.ok(config.headers.find(h=>h.source===path)?.headers.some(h=>h.key==='X-Robots-Tag'&&h.value==='noindex, nofollow'))
 }
 assert.notEqual(config.git.deploymentEnabled?.main,false)
 assert.equal(config.git.deploymentEnabled['feature/seo-integration'],false)
})

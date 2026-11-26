import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const script=read('public/analytics.js')
function run(path,stored,host='www.jpchauffeurkorea.com'){
 const scripts=[],nodes=[]
 const element=()=>({style:{},children:[],append(...a){this.children.push(...a)},appendChild(a){this.children.push(a)},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(name,fn){this[name]=fn}})
 const body=element(),head={appendChild(s){scripts.push(s)}}
 const document={head,body,documentElement:{lang:'en'},createElement(){const n=element();nodes.push(n);return n}}
 const window={location:{protocol:'https:',hostname:host,origin:'https://'+host,pathname:path,search:'?email=secret@example.com'},localStorage:{getItem:()=>stored,setItem(){}},addEventListener(){}}
 vm.runInNewContext(script,{window,document,Date})
 return {window,scripts,nodes}
}
test('admin and previews excluded; consent required; event data is allowlisted',()=>{
 for(const [path,host] of [['/admin/live','www.jpchauffeurkorea.com'],['/en/','preview.vercel.app']]){
  const r=run(path,'allow',host);assert.equal(r.scripts.length,0);assert.equal(r.window.chauffeurAnalytics,undefined)
 }
 const r=run('/en/',null);assert.equal(r.scripts.length,0)
 r.window.chauffeurAnalytics.track('generate_lead',{email:'secret@example.com'})
 assert.equal(r.window.dataLayer.filter(e=>e.event==='generate_lead').length,0)
 r.nodes.find(n=>n.textContent==='Allow analytics').click()
 assert.equal(r.scripts.length,1)
 r.window.chauffeurAnalytics.track('generate_lead',{journey_type:'multiple',email:'secret@example.com',pickup:'private location',vehicle:'g90'})
 const e=r.window.dataLayer.find(e=>e.event==='generate_lead')
 assert.equal(e.journey_type,'multiple');assert.equal(e.page_location,'https://www.jpchauffeurkorea.com/en/')
 assert.equal(e.email,undefined);assert.equal(e.pickup,undefined)
 assert.doesNotMatch(JSON.stringify(r.window.dataLayer),/secret@example.com|private location/)
 r.nodes.find(n=>n.textContent==='Analytics settings').click()
 r.nodes.filter(n=>n.textContent==='Essential only').at(-1).click()
 r.window.chauffeurAnalytics.track('generate_lead')
 assert.equal(r.window.dataLayer.filter(e=>e.event==='generate_lead').length,1)
})
test('page event deduplication and confirmed new-request lead guard',()=>{
 const r=run('/ko/','allow');r.window.chauffeurAnalytics.track('chauffeur_page_view')
 assert.equal(r.window.dataLayer.filter(e=>e.event==='chauffeur_page_view').length,1)
 r.window.location.pathname='/en/';r.window.chauffeurAnalytics.refreshLocale()
 assert.equal(r.window.dataLayer.filter(e=>e.event==='chauffeur_page_view').length,2)
 const src=read('src/Booking.tsx')
 assert.match(src,/response\.status === 201.*data\.status === 'pending'.*!trackedLead\.current/)
 assert.match(src,/trackedLead\.current = true\s+trackAnalytics\('generate_lead'/)
 assert.match(src,/trackedLead\.current = false/)
})

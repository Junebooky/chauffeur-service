import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../public/analytics.js',import.meta.url),'utf8')
function run(path,choice,host='www.jpchauffeurkorea.com'){
 const nodes=[],scripts=[],callbacks=[]
 const el=()=>({style:{},children:[],append(...a){this.children.push(...a)},appendChild(a){this.children.push(a)},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(name,fn){this[name]=fn}})
 const document={head:{appendChild(s){scripts.push(s)}},body:el(),documentElement:{lang:'en'},title:'Chauffeur',referrer:'https://external.example/search?q=private',createElement(){const n=el();nodes.push(n);return n}}
 const window={location:{protocol:'https:',hostname:host,origin:'https://'+host,pathname:path,search:'?email=private@example.com'},localStorage:{getItem:()=>choice,setItem(){}},addEventListener(){},requestAnimationFrame(fn){callbacks.push(fn)}}
 vm.runInNewContext(source,{window,document,URL,URLSearchParams,Date})
 return {window,document,nodes,scripts,flush(){while(callbacks.length)callbacks.shift()()}}
}
test('consent gate, one direct GA tag, sanitized events and withdrawal',()=>{
 const r=run('/en/',null)
 assert.equal(r.scripts.length,0)
 assert.equal(r.window.gtag('event','generate_lead'),false)
 r.nodes.find(n=>n.textContent==='Allow analytics').click();r.flush()
 assert.equal(r.scripts.length,1)
 assert.match(r.scripts[0].src,/gtag\/js\?id=G-8VWZ2SPG0Q/)
 assert.equal(r.window.gtag('event','page_view'),false)
 assert.equal(r.window.gtag('event','generate_lead',{email:'private@example.com',pickup:'secret address',service_id:'airport'}),true)
 const lead=r.window.dataLayer.find(a=>a[0]==='event'&&a[1]==='generate_lead')[2]
 assert.equal(lead.page_location,'https://www.jpchauffeurkorea.com/en/')
 assert.equal(lead.page_referrer,'https://external.example/')
 assert.equal(lead.email,undefined);assert.equal(lead.pickup,undefined)
 assert.doesNotMatch(JSON.stringify(r.window.dataLayer),/private@example.com|secret address|\?q=private/)
 r.nodes.find(n=>n.textContent==='Analytics settings').click()
 r.nodes.filter(n=>n.textContent==='Essential only').at(-1).click()
 assert.equal(r.window.gtag('event','generate_lead'),false)
 for(const [path,host] of [['/admin/live','www.jpchauffeurkorea.com'],['/en/','preview.vercel.app']])assert.equal(run(path,'allow',host).scripts.length,0)
})
test('static service and journal pages share direct analytics',()=>{
 for(const path of ['/services/incheon-airport-transfer/','/ko/journal/airport-guide/']){
  const r=run(path,'allow');r.flush()
  assert.equal(r.scripts.length,1)
  assert.equal(r.window.dataLayer.filter(a=>a[0]==='event'&&a[1]==='page_view').length,1)
 }
})

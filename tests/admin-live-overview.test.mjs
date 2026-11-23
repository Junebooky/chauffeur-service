import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import overview from '../api/admin-overview.js'
import booking from '../api/reservations.js'
import { createApp } from '../server/app.mjs'

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8')
const response = () => ({
  statusCode:200,headers:{},data:null,
  setHeader(name,value){this.headers[name]=value},
  status(value){this.statusCode=value;return this},
  json(value){this.data=value;return this},
})
const uuid = '84b1be38-2732-4b21-a912-46ca35d6ed5b'
const dayId = '9419ec45-239f-46bd-9c45-c18444f4000b'
function setupDb(){
  const before={url:process.env.SUPABASE_URL, secret:process.env.SUPABASE_SECRET_KEY, legacy:process.env.SUPABASE_SERVICE_ROLE_KEY}
  process.env.SUPABASE_URL='https://local-test.supabase.co'
  process.env.SUPABASE_SECRET_KEY='sb_secret_test_only'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  return ()=>{for(const [key,value] of Object.entries({SUPABASE_URL:before.url,SUPABASE_SECRET_KEY:before.secret,SUPABASE_SERVICE_ROLE_KEY:before.legacy})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
}
function json(data,status=200){return {ok:status>=200&&status<300,status,async text(){return JSON.stringify(data)}}}

test('admin route reads real Supabase summaries, never returning customer details',async()=>{
  const restore=setupDb()
  const originalFetch=globalThis.fetch
  const calls=[]
  globalThis.fetch=async (url,options)=>{
    calls.push({url:String(url),headers:options.headers})
    if(String(url).includes('/reservations?'))return json([{id:uuid,reference:'CH-X9N8P7Q6',status:'requested',created_at:'2026-11-23T00:00:00Z',customer_name:'SECRET CUSTOMER',customer_email:'private@secret.invalid'}])
    if(String(url).includes('/reservation_days?'))return json([{id:dayId,reservation_id:uuid,service_code:'airport',vehicle_class:'g90',pickup_address:'SECRET LOCATION'}])
    if(String(url).includes('/assignments?'))return json([])
    if(String(url).includes('/payment_records?'))return json([])
    throw Error('Unmocked query '+url)
  }
  try{
    const res=response()
    await overview({method:'GET'},res)
    assert.equal(res.statusCode,200)
    assert.equal(res.data.metrics.requests,1)
    assert.equal(res.data.metrics.new,1)
    assert.equal(res.data.reservations[0].service,'airport')
    assert.equal(res.data.reservations[0].dayCount,1)
    assert.ok(!JSON.stringify(res.data).includes('SECRET'))
    assert.ok(!JSON.stringify(res.data).includes('private@'))
    assert.ok(!JSON.stringify(res.data).includes(uuid))
    assert.ok(!JSON.stringify(res.data).includes('CH-X9N8P7Q6'))
    assert.ok(calls.every(call=>call.headers.apikey==='sb_secret_test_only'&&!('Authorization' in call.headers)))
  }finally{globalThis.fetch=originalFetch;restore()}
})

test('customer POST persists a real front-end-shaped booking via atomic Supabase RPC',async()=>{
  const restore=setupDb()
  const originalFetch=globalThis.fetch
  const calls=[]
  globalThis.fetch=async (url,options)=>{
    calls.push({url:String(url),headers:options.headers,body:options.body ? JSON.parse(options.body) : null})
    if(String(url).includes('/rpc/check_booking_submission_limit_v1'))return json(true)
    if(String(url).includes('/rpc/create_booking_request_v1'))return json({id:uuid,reference:'CH-ABCDEF12',created:true})
    throw Error('Unexpected DB request '+url)
  }
  const future=new Date(Date.now()+15*86400000).toISOString().slice(0,10)
  const place={id:'curated:four-seasons',name:'Four Seasons Hotel Seoul',address:'97 Saemunan-ro, Jongno-gu, Seoul, South Korea',latitude:37.5706,longitude:126.976,source:'popular'}
  try{
    const res=response()
    await booking({
      method:'POST',
      headers:{'idempotency-key':'9b1df81a-70c2-4953-8218-adc23443c778','x-forwarded-for':'127.0.0.1'},
      body:{
        name:'Test Guest',email:'guest@example.com',phone:'+821012345678',
        contactMethod:'email',consent:true,options:[],
        date:future,time:'12:00',service:'airport',vehicle:'g90',
        pickup:'Seoul, Republic of Korea',destination:'Seoul, Republic of Korea',
        pickupPlace:place,destinationPlace:place,
        journeys:[{date:future,time:'12:00',service:'airport',vehicle:'g90',pickup:'Seoul',destination:'Seoul',pickupPlace:place,destinationPlace:place,stops:[],flight:''}],
      },
      socket:{remoteAddress:'127.0.0.1'},
    },res)
    assert.equal(res.statusCode,201,JSON.stringify(res.data))
    assert.equal(res.data.reference,'CH-ABCDEF12')
    assert.equal(res.data.status,'pending')
    const rpc=calls.find(call=>call.url.includes('create_booking_request_v1'))
    assert.ok(rpc)
    assert.equal(rpc.body.p_days.length,1)
    assert.equal(rpc.body.p_days[0].vehicle,'g90')
    assert.equal(rpc.body.p_customer.email,'guest@example.com')
    assert.ok(calls.every(call=>call.headers.apikey==='sb_secret_test_only'&&!('Authorization' in call.headers)))
  }finally{globalThis.fetch=originalFetch;restore()}
})

test('live admin board replaces sample mode and preserves auth on real mutations',()=>{
  const main=read('src/main.tsx')
  const overviewUI=read('src/AdminOverview.tsx')
  const secureAPI=read('api/admin.js')
  const app=read('server/app.mjs')
  assert.match(main, /<AdminOverview \/>/)
  assert.doesNotMatch(main, /AdminPreview/)
  assert.match(overviewUI, /\/api\/admin-overview/)
  assert.doesNotMatch(overviewUI, /SAMPLE-00[1-9]|Example Holdings/)
  assert.match(secureAPI, /await requireStaff\(req\)/)
  assert.match(app, /app\.all\('\/api\/reservations'/)
  assert.match(app, /app\.all\('\/api\/admin-overview'/)
})

test('local Express routes to live overview if configured',async()=>{
  const restore=setupDb()
  const originalFetch=globalThis.fetch
  globalThis.fetch=async url=>{
    if(String(url).includes('/reservations?'))return json([])
    throw Error('Unexpected test request: '+url)
  }
  const {app,close}=createApp({databasePath:':memory:',placesOptions:{apiKey:''}})
  const listener=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server))})
  try{
    const r=await originalFetch('http://127.0.0.1:'+listener.address().port+'/api/admin-overview')
    assert.equal(r.status,200)
    const data=await r.json()
    assert.equal(data.metrics.requests,0)
    assert.deepEqual(data.reservations,[])
  }finally{await new Promise(resolve=>listener.close(resolve));close();globalThis.fetch=originalFetch;restore()}
})

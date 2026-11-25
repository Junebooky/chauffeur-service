import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import handler from '../api/admin.js'

const staffId='825d4a2d-b0e7-40d2-9e26-36d2e52a4b7e'
const bookingId='a3cf6400-d7b5-4056-b47b-e9d49ee8a0a3'
const response=()=>({
  statusCode:200,data:null,headers:{},
  setHeader(k,v){this.headers[k]=v},status(s){this.statusCode=s;return this},
  json(body){this.data=body;return this}
})
const json=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data),json:async()=>data})
const withEnv=(fn)=>{
  const before=Object.fromEntries(['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY'].map(k=>[k,process.env[k]]))
  process.env.SUPABASE_URL='https://example.supabase.co'
  process.env.SUPABASE_SECRET_KEY='sb_secret_TEST_ONLY'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_TEST_ONLY'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  return Promise.resolve().then(fn).finally(()=>{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v}})
}
test('public cannot perform booking approval without a staff session',async()=>withEnv(async()=>{
  const original=globalThis.fetch
  let called=0
  globalThis.fetch=async()=>{called++;throw Error('Must never fetch')}
  try{
    const res=response()
    await handler({method:'POST',headers:{},body:{action:'advance',reservation_id:bookingId,expected_status:'requested',status:'confirmed'}},res)
    assert.equal(res.statusCode,401)
    assert.equal(called,0)
  }finally{globalThis.fetch=original}
}))
test('owner can confirm a booking without supplier and driver assignment, even if mail is unavailable',async()=>withEnv(async()=>{
  const original=globalThis.fetch
  const savedUser=process.env.SMTP_USER
  delete process.env.SMTP_USER
  const calls=[]
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),body:options?.body?JSON.parse(options.body):null})
    if(String(url).includes('/auth/v1/user'))return json({id:staffId})
    if(String(url).includes('staff_members?'))return json([{active:true,role:'owner'}])
    if(String(url).includes('rpc/confirm_and_queue_v1'))return json({ok:true,status:'confirmed'})
    if(String(url).includes('rpc/claim_confirmation_v1'))return json({ok:true,snapshot:{}})
    if(String(url).includes('confirmation_deliveries?'))return json(null)
    throw Error('Unexpected request')
  }
  try{
    const res=response()
    await handler({
      method:'POST',headers:{authorization:'Bearer STUB_SESSION'},
      body:{action:'confirm_and_send',reservation_id:bookingId,expected_status:'requested',
        expected_updated_at:'2026-11-25T00:00:00Z',payment_method:'on_site'},
    },res)
    assert.equal(res.statusCode,200)
    assert.equal(res.data.ok,true)
    assert.equal(res.data.data.status,'confirmed')
    assert.equal(res.data.data.delivery,'failed')
    const rpc=calls.find(call=>call.url.includes('rpc/confirm_and_queue_v1'))
    assert.ok(rpc)
    assert.equal(rpc.body.p_expected_status,'requested')
    assert.equal(rpc.body.p_payment_method,'on_site')
    assert.equal(rpc.body.p_actor_user_id,staffId)
    assert.equal(rpc.body.p_reservation_id,bookingId)
    assert.ok(!calls.some(call=>call.url.includes('assignments')))
    assert.ok(calls.some(call=>call.body?.status==='failed'))
  }finally{globalThis.fetch=original;if(savedUser===undefined)delete process.env.SMTP_USER;else process.env.SMTP_USER=savedUser}
}))
test('stale booking approval is rejected instead of overwriting latest state',async()=>withEnv(async()=>{
  const original=globalThis.fetch
  globalThis.fetch=async(url)=>{
    if(String(url).includes('/auth/v1/user'))return json({id:staffId})
    if(String(url).includes('staff_members?'))return json([{active:true,role:'operator'}])
    if(String(url).includes('rpc/confirm_and_queue_v1'))return json({ok:false,reason:'stale',status:'completed'})
    throw Error('Unexpected request')
  }
  try{
    const res=response()
    await handler({method:'POST',headers:{authorization:'Bearer TOKEN'},body:{
      action:'confirm_and_send',reservation_id:bookingId,expected_status:'requested',expected_updated_at:'2026-11-25T00:00:00Z',payment_method:'on_site'
    }},res)
    assert.equal(res.statusCode,409)
    assert.match(res.data.error,/새로고침/)
  }finally{globalThis.fetch=original}
}))
test('Korean dashboard exposes explicit booking approval but no unverified mutations',()=>{
  const source=readFileSync(new URL('../src/Admin.tsx',import.meta.url),'utf8')
  const overview=readFileSync(new URL('../src/AdminOverview.tsx',import.meta.url),'utf8')
  const labels=readFileSync(new URL('../src/admin-locale.ts',import.meta.url),'utf8')
  assert.match(source,/요청 확인했어요|nextActions/)
  assert.match(source,/expected_status:current.status/)
  assert.match(source,/관리자 이메일/)
  assert.match(source,/예약 확정하고 이메일 보내기/)
  assert.doesNotMatch(source,/입금 대기|결제 확인|예약금/)
  assert.doesNotMatch(overview,/입금 대기/)
  assert.match(source,/sandbox=""/)
  assert.match(overview,/예약 처리하기/)
  assert.match(overview,/import Admin from '.\/Admin'/)
  assert.doesNotMatch(overview,/\/api\/admin',\s*\{\s*method:'POST'/)
  assert.match(labels,/차량·기사 배정 없이 확정/)
  assert.match(labels,/requested:'새 예약'/)
})

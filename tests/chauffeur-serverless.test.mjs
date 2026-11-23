import { test } from 'node:test'
import assert from 'node:assert/strict'
import bookingHandler from '../api/reservations.js'
import adminHandler from '../api/admin.js'
import availabilityHandler from '../api/availability.js'
import { readFileSync } from 'node:fs'

function fakeResponse() {
  return {
    statusCode: 200, headers: {}, payload: null,
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    json(data) { this.payload = data; return this },
  }
}
function availabilityRequest() {
  const date=new Date(Date.now()+20*86400000).toISOString().slice(0,10)
  return {method:'GET',url:'/api/availability?date='+date+'&time=20:00&service=airport'}
}
test('booking API has safe method and no-database behavior', async () => {
  const res=fakeResponse()
  await bookingHandler({method:'GET',headers:{}},res)
  assert.equal(res.statusCode,405)
  const missing=fakeResponse()
  await bookingHandler({method:'POST',headers:{},body:{}},missing)
  assert.equal(missing.statusCode,503)
  assert.equal(missing.headers['Cache-Control'],'no-store')
})
test('admin API rejects unsafe method or missing database', async () => {
  const res=fakeResponse()
  await adminHandler({method:'DELETE'},res)
  assert.equal(res.statusCode,405)
  const missing=fakeResponse()
  await adminHandler({method:'GET',headers:{}},missing)
  assert.equal(missing.statusCode,503)
})
test('availability readiness reflects server persistence configuration only', () => {
  const previousUrl=process.env.SUPABASE_URL
  const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    let r=fakeResponse()
    availabilityHandler(availabilityRequest(),r)
    assert.equal(r.payload.bookingSubmissionReady,false)
    process.env.SUPABASE_URL='https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY='SERVER_TEST_ONLY'
    r=fakeResponse()
    availabilityHandler(availabilityRequest(),r)
    assert.equal(r.payload.bookingSubmissionReady,true)
  } finally {
    if(previousUrl===undefined)delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL=previousUrl
    if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey
  }
})
test('operations UI route and server-only isolation remain explicit', () => {
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')
  const helper=readFileSync(new URL('../server/chauffeur-supabase.mjs',import.meta.url),'utf8')
  assert.match(main,/window\.location\.pathname/)
  assert.match(main,/lazy\(\(\) => import\('\.\/Admin'\)\)/)
  assert.doesNotMatch(helper,/process\.env\.VITE_SUPABASE_PUBLISHABLE_KEY.*service_role/i)
  assert.match(helper,/requireStaff/)
})

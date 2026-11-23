import { test } from 'node:test'
import assert from 'node:assert/strict'
import searchHandler from '../api/places/search.js'
import resolveHandler from '../api/places/resolve.js'
import { validatePlaceSelection } from '../server/places-serverless.mjs'
import { createApp } from '../server/app.mjs'

const token = '09876543-210f-4fed-beca-445566778899'
const makeRes = () => ({
  statusCode: 200,headers:{},data:null,
  setHeader(key,val){this.headers[key]=val},
  status(code){this.statusCode=code;return this},
  json(data){this.data=data;return this},
})
const original = {
  google: process.env.GOOGLE_MAPS_API_KEY,
  google2: process.env.GOOGLE_PLACES_API_KEY,
  secret:process.env.SUPABASE_SECRET_KEY,
  legacy:process.env.SUPABASE_SERVICE_ROLE_KEY,
  url:process.env.SUPABASE_URL,
}
const restore = () => {
  for(const [key,value] of Object.entries({
    GOOGLE_MAPS_API_KEY:original.google,
    GOOGLE_PLACES_API_KEY:original.google2,
    SUPABASE_SECRET_KEY:original.secret,
    SUPABASE_SERVICE_ROLE_KEY:original.legacy,
    SUPABASE_URL:original.url,
  })){if(value===undefined)delete process.env[key];else process.env[key]=value}
}
const popularOnly=()=>{
  delete process.env.GOOGLE_MAPS_API_KEY
  delete process.env.GOOGLE_PLACES_API_KEY
}
const doCall=async(handler,body,method='POST')=>{
  const res=makeRes()
  await handler({method,body},res)
  return res
}

test('Vercel places API serves popular locations with no Google credential',async()=>{
  try{
    popularOnly()
    const opened=await doCall(searchHandler,{query:'',sessionToken:token})
    assert.equal(opened.statusCode,200)
    assert.equal(opened.data.mode,'popular')
    assert.equal(opened.data.results.length,6)
    assert.ok(opened.data.results.some(p=>p.id==='curated:josun-palace'))
    assert.ok(opened.data.results.some(p=>p.id==='curated:le-meridien-myeongdong'))
    const korean=await doCall(searchHandler,{query:'포시즌',sessionToken:token})
    assert.equal(korean.statusCode,200)
    assert.equal(korean.data.results[0].id,'curated:four-seasons')
    const resolved=await doCall(resolveHandler,{id:'curated:icn-t2',sessionToken:token})
    assert.equal(resolved.statusCode,200)
    assert.equal(resolved.data.latitude,37.4686)
    assert.equal(resolved.data.source,'popular')
    assert.equal(validatePlaceSelection({id:'curated:icn-t2',address:'tampered'}).latitude,37.4686)
    assert.equal(validatePlaceSelection({id:'not-curated'}),null)
  }finally{restore()}
})

test('Vercel places API rejects non-POST methods and invalid request bodies as JSON',async()=>{
  const get=await doCall(searchHandler,{},'GET')
  assert.equal(get.statusCode,405)
  assert.match(get.headers['Content-Type'],/application\/json/)
  const invalid=await doCall(searchHandler,{query:'Seoul',sessionToken:'bad'})
  assert.equal(invalid.statusCode,400)
  assert.match(invalid.data.error,/valid place|valid location/)
  const unresolved=await doCall(resolveHandler,{id:'fake-id',sessionToken:token})
  assert.equal(unresolved.statusCode,400)
})

test('Google place resolution is stateless and bookings can verify signed selections',async()=>{
  const oldFetch=globalThis.fetch
  try{
    process.env.GOOGLE_MAPS_API_KEY='test-google-key'
    process.env.SUPABASE_SECRET_KEY='sb_secret_TESTING_ONLY'
    delete process.env.GOOGLE_PLACES_API_KEY
    globalThis.fetch=async(url,opts)=>{
      if(String(url).includes('places:autocomplete'))return {
        ok:true,async json(){return {suggestions:[{placePrediction:{placeId:'exampleplace',structuredFormat:{mainText:{text:'Example Hotel'},secondaryText:{text:'Seoul, South Korea'}}}}]}}
      }
      return {ok:true,async json(){return {
        id:'exampleplace',displayName:{text:'Example Hotel'},
        formattedAddress:'1 Sample Road, Seoul, South Korea',
        location:{latitude:37.55,longitude:127.01},
        addressComponents:[{types:['country'],shortText:'KR'}]
      }}}
    }
    const search=await doCall(searchHandler,{query:'Example Hotel',sessionToken:token})
    assert.equal(search.statusCode,200)
    assert.equal(search.data.mode,'google')
    assert.equal(search.data.results[0].id,'exampleplace')
    const resolved=await doCall(resolveHandler,{id:'exampleplace',sessionToken:token})
    assert.equal(resolved.statusCode,200)
    assert.ok(resolved.data.selectionToken.includes('.'))
    const canonical=validatePlaceSelection(resolved.data)
    assert.equal(canonical.address,'1 Sample Road, Seoul, South Korea')
    assert.equal(validatePlaceSelection({...resolved.data,address:'Another address'}),null)
    assert.equal(validatePlaceSelection({...resolved.data,id:'another-place'}),null)
  }finally{globalThis.fetch=oldFetch;restore()}
})

test('Google provider failures do not expose upstream secrets',async()=>{
  const oldFetch=globalThis.fetch
  try{
    process.env.GOOGLE_MAPS_API_KEY='private-key-for-test'
    globalThis.fetch=async()=>({ok:false,body:{cancel:async()=>{}},status:403,
      async json(){return {error:{message:'project-secret-that-must-not-leak'}}}})
    const search=await doCall(searchHandler,{query:'NoMatchUniquePlaceXYZ',sessionToken:token})
    assert.equal(search.statusCode,503)
    assert.ok(!JSON.stringify(search.data).includes('project-secret'))
  }finally{globalThis.fetch=oldFetch;restore()}
})

test('local Express configured with Supabase uses the same stateless location routes',async()=>{
  const oldFetch=globalThis.fetch
  try{
    popularOnly()
    process.env.SUPABASE_URL='https://test.supabase.co'
    process.env.SUPABASE_SECRET_KEY='sb_secret_TESTING_ONLY'
    const {app,close}=createApp({databasePath:':memory:',placesOptions:{apiKey:''}})
    const listener=await new Promise(resolve=>{
      const s=app.listen(0,'127.0.0.1',()=>resolve(s))
    })
    try{
      const res=await oldFetch('http://127.0.0.1:'+listener.address().port+'/api/places/search',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:'르메르디앙',sessionToken:token}),
      })
      assert.equal(res.status,200)
      const data=await res.json()
      assert.equal(data.results[0].id,'curated:le-meridien-myeongdong')
    }finally{await new Promise(resolve=>listener.close(resolve));close()}
  }finally{globalThis.fetch=oldFetch;restore()}
})

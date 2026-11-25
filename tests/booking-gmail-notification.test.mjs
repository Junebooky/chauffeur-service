import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sendBookingNotification} from '../server/booking-notification.mjs'
import {GmailDeliveryError} from '../server/gmail.mjs'
const id='a3cf6400-d7b5-4056-b47b-e9d49ee8a0a3'
test('booking receipt uses company inbox and original saved itinerary, claims once, and blocks ambiguous retries',async()=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','GMAIL_ALLOWED_EMAIL']
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetchOld=globalThis.fetch
 Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TEST',GMAIL_ALLOWED_EMAIL:'company@example.invalid'})
 const row={id,status:'pending',attempts:0}
 const json=data=>({ok:true,text:async()=>JSON.stringify(data)})
 globalThis.fetch=async(url,opts)=>{
  const u=String(url)
  if(u.includes('notification_outbox?')){
   if(opts.method==='GET')return json([row])
   const b=JSON.parse(opts.body)
   if(b.status==='sending'&&b.attempts){if(!['pending','failed'].includes(row.status))return json([]);Object.assign(row,b);return json([row])}
   Object.assign(row,b);return json(null)
  }
  if(u.includes('reservations?'))return json([{reference:'CH-TEST1234',request_payload:{name:'Guest',email:'guest@example.invalid',phone:'01000000000',options:[],journeys:[{date:'2027-01-01',time:'09:00',service:'airport',vehicle:'g90',pickup:'Airport',destination:'Hotel',total:300000}]}}])
  throw Error('Unexpected route')
 }
 try{
  let count=0
  const prepare=async mail=>{
   assert.equal(mail.to,'company@example.invalid')
   assert.equal(mail.replyTo,'guest@example.invalid')
   assert.match(mail.html,/New Reservation Request/i)
   return async()=>{count++;return {id:'gmail-id'}}
  }
  assert.equal(await sendBookingNotification(id,{prepare}),'sent')
  assert.equal(await sendBookingNotification(id,{prepare}),'sent')
  assert.equal(count,1)
  row.status='failed'
  assert.equal(await sendBookingNotification(id,{prepare:async()=>async()=>{throw new GmailDeliveryError(true)}}),'sending')
  assert.equal(await sendBookingNotification(id,{prepare}),'sending')
  assert.equal(count,1)
  row.status='failed'
  assert.equal(await sendBookingNotification(id,{prepare:async()=>{throw Error('not connected')}}),'failed')
 }finally{globalThis.fetch=fetchOld;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}
})

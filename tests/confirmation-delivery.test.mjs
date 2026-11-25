import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCustomerConfirmation, buildOperatorEmail } from '../server/notifications.mjs'
import { buildConfirmationPdf } from '../server/confirmation-pdf.mjs'
import { confirmationPreview, sendQueuedConfirmation } from '../server/confirmation-delivery.mjs'
const sample={
  reference:'CH-TEST1234',name:'Guest <Team>',email:'guest@example.invalid',
  total:300000,taxIncluded:false,quoteRequired:false,paymentMethod:'on_site',
  updatedAt:'2026-11-25T00:00:00Z',options:[],
  journeys:[{date:'2026-12-31',time:'09:00',service:'airport',vehicle:'g90',pickup:'Incheon Airport',
    destination:'서울 Grand Hyatt',stops:[{location:'City Hall'}],flight:'KE123',total:300000}]
}
test('customer confirmation reuses branded template with real confirmed wording and safe escaping',()=>{
  const email=buildCustomerConfirmation(sample)
  assert.match(email.subject,/Booking Confirmed/)
  assert.match(email.html,/cid:chauffeur-email-header/)
  assert.match(email.html,/Your journey is confirmed/)
  assert.match(email.html,/Guest &lt;Team&gt;/)
  assert.match(email.html,/Payment on the day/)
  assert.match(email.html,/Pick-up Service/)
  assert.match(email.html,/Genesis G90/)
  assert.doesNotMatch(email.html,/Pending confirmation|Reply to guest|pending request/)
  assert.match(buildOperatorEmail({reference:sample.reference,total:sample.total,details:{...sample}}).html,/Pending confirmation/)
  assert.match(buildCustomerConfirmation({...sample,paymentMethod:'separate',taxIncluded:true}).html,/Payment as agreed with our team/)
})
test('server-generated PDF has valid byte offsets, multi-page support and complete route content',()=>{
  const pdf=buildConfirmationPdf({...sample,journeys:Array.from({length:15},()=>sample.journeys[0])})
  const text=pdf.toString('latin1')
  assert.ok(text.startsWith('%PDF-1.4'))
  assert.match(text,/\/Type \/Pages \/Count [2-9]/)
  assert.ok(text.includes(Buffer.from('City Hall').toString('hex')))
  const match=text.match(/startxref\n(\d+)\n%%EOF/)
  assert.equal(text.slice(Number(match[1]),Number(match[1])+4),'xref')
  const xref=text.slice(Number(match[1])).split('\n')
  const n=Number(xref[1].split(' ')[1])
  for(let i=1;i<n;i++){
    const offset=Number(xref[i+2].slice(0,10))
    assert.ok(text.slice(offset).startsWith(i+' 0 obj\n'))
  }
  const preview=confirmationPreview(sample)
  assert.equal(preview.filename,sample.reference+'-Confirmation.pdf')
  assert.equal(preview.paymentMethod,'on_site')
  assert.ok(preview.html.includes('data:image/jpeg;base64,'))
  assert.ok(Buffer.from(preview.pdfBase64,'base64').subarray(0,5).equals(Buffer.from('%PDF-')))
  assert.throws(()=>confirmationPreview({...sample,quoteRequired:true}),/최종/)
  assert.throws(()=>confirmationPreview({...sample,email:'guest@example.invalid,other@example.invalid'}),/이메일/)
})
test('SMTP delivery attaches PDF, uses customer as sole recipient, and never silently repeats ambiguous sends',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','SMTP_USER','SMTP_APP_PASSWORD','SMTP_FROM_EMAIL']
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
  Object.assign(process.env,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TEST',SMTP_USER:'operator@example.invalid',SMTP_APP_PASSWORD:'fake-test-password',SMTP_FROM_EMAIL:'operator@example.invalid'})
  const original=globalThis.fetch
  const updates=[]
  let claimable=true
  const id='a3cf6400-d7b5-4056-b47b-e9d49ee8a0a3'
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('rpc/claim_confirmation_v1')){
      const response=claimable?{ok:true,snapshot:sample}:{ok:false,reason:'not_claimable'}
      claimable=false
      return {ok:true,text:async()=>JSON.stringify(response)}
    }
    if(String(url).includes('confirmation_deliveries?')){
      updates.push(JSON.parse(options.body));return {ok:true,text:async()=>''}
    }
    throw Error('Unexpected request')
  }
  try{
    let sent
    const status=await sendQueuedConfirmation(id,id,{createTransport:()=>({sendMail:async mail=>{
      sent=mail;return {accepted:[sample.email]}
    }})})
    assert.equal(status,'sent')
    assert.equal(sent.to,sample.email)
    assert.equal(sent.replyTo,'operator@example.invalid')
    assert.ok(sent.attachments.some(a=>a.filename.endsWith('-Confirmation.pdf')&&a.content.subarray(0,5).equals(Buffer.from('%PDF-'))))
    assert.ok(updates.some(x=>x.status==='sent'))
    await assert.rejects(sendQueuedConfirmation(id,id,{createTransport:()=>{throw Error('duplicate')}}),/이미 발송/)
    claimable=true
    const uncertain=await sendQueuedConfirmation(id,id,{createTransport:()=>({sendMail:async()=>{throw Object.assign(new Error('Network'),{code:'ETIMEDOUT'})}})})
    assert.equal(uncertain,'uncertain')
    assert.ok(updates.some(x=>x.status==='uncertain'))
  }finally{globalThis.fetch=original;for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
})
test('reservation confirmation contact link opens a blank draft',()=>{
  const booking=readFileSync(new URL('../src/Booking.tsx',import.meta.url),'utf8')
  assert.match(booking,/href=\{customQuoteEmail\(\)\}/)
  assert.doesNotMatch(booking,/I have a question about my reservation request/)
})

test('branded A4 confirmation embeds the existing email banner and fits a standard three-day itinerary on one page',()=>{
 const airport={name:'Incheon Airport - Terminal 1',address:'272 Gonghang-ro, Jung-gu, Incheon, South Korea'}
 const hotel={name:'Hotel in Seoul Gangnam',address:'231 Teheran-ro, Gangnam-gu, Seoul, South Korea'}
 const route=(a,b)=>({pickup:a.address,destination:b.address,pickupPlace:{name:a.name},destinationPlace:{name:b.name}})
 const pdf=buildConfirmationPdf({...sample,total:930000,journeys:[
  {date:'2027-01-10',time:'10:00',service:'airport',vehicle:'carnival_limousine',...route(airport,hotel),flight:'KE123',total:200000},
  {date:'2027-01-11',time:'20:00',service:'day',vehicle:'sprinter_319',...route(hotel,hotel),stops:[{location:'Coex Mall'}],total:530000},
  {date:'2027-01-12',time:'06:30',service:'airport',vehicle:'staria',...route(hotel,airport),total:200000}
 ]})
 const raw=pdf.toString('latin1')
 assert.match(raw,/\/Type \/Pages \/Count 1\b/)
 assert.match(raw,/\/Subtype \/Image/)
 assert.match(raw,/\/Banner Do Q/)
 assert.match(raw,/\/BaseFont \/Symbol/)
 assert.ok(raw.includes(Buffer.from('GUEST DETAILS').toString('hex')))
 assert.ok(raw.includes(Buffer.from('KRW 930,000').toString('hex')))
 assert.ok(raw.includes(Buffer.from('Coex Mall').toString('hex')))
 assert.ok(raw.includes(Buffer.from('Tax excluded').toString('hex')))
 const match=raw.match(/startxref\n(\d+)\n%%EOF/)
 assert.equal(raw.slice(Number(match[1]),Number(match[1])+4),'xref')
})

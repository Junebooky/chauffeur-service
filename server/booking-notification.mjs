import { db,validUuid,ApiError } from './chauffeur-supabase.mjs'
import { buildOperatorEmail } from './notifications.mjs'
import { prepareAutomaticMail,GmailDeliveryError } from './gmail.mjs'
import catalog from '../src/catalog.json' with {type:'json'}
const query=id=>'notification_outbox?reservation_id=eq.'+id+'&event_type=eq.booking_requested'
// Existing outbox states: sending is also the conservative unknown state.
// Never claim sent/sending rows, including after a worker interruption.
export async function sendBookingNotification(id,{prepare=prepareAutomaticMail}={}){
 if(!validUuid(id))throw new ApiError(400,'예약을 다시 선택해 주세요.')
 const rows=await db(query(id)+'&select=id,status,attempts&limit=2')
 if(rows?.length!==1)return 'missing'
 const row=rows[0]
 if(!['pending','failed'].includes(row.status))return row.status
 const path='notification_outbox?id=eq.'+row.id
 const claimed=await db(path+'&status=eq.'+row.status+'&attempts=eq.'+row.attempts,{method:'PATCH',prefer:'return=representation',body:{status:'sending',attempts:row.attempts+1,last_error_code:null}})
 if(!claimed?.length)return 'sending'
 const update=body=>db(path+'&status=eq.sending',{method:'PATCH',prefer:'return=minimal',body})
 let attempted=false
 try{
  // Always use the saved original booking request, never a public retry body.
  const list=await db('reservations?select=reference,request_payload,quoted_total,quote_required&id=eq.'+id+'&limit=1')
  const r=list?.[0],details=r?.request_payload
  if(!r||!details||!Array.isArray(details.journeys))throw Error('Missing original booking')
  const journeys=details.journeys.map(d=>({...d,service:catalog.services.find(s=>s.id===d.service)?.name||d.service,vehicle:catalog.vehicles.find(v=>v.id===d.vehicle)?.name||d.vehicle}))
  const email=buildOperatorEmail({reference:r.reference,status:'pending',total:details.quoteRequired?null:details.journeys.reduce((n,d)=>n+(d.total||0),0),details:{...details,journeys}})
  // Recipient is the authorized company mailbox, not a customer-provided or
  // obsolete SMTP environment address.
  const to=process.env.GMAIL_ALLOWED_EMAIL?.trim().toLowerCase()
  if(!to)throw Error('Missing company mailbox')
  const send=await prepare({...email,to,messageId:'<chauffeur.'+r.reference+'@gmail.com>'})
  attempted=true
  await send()
  await update({status:'sent',sent_at:new Date().toISOString(),last_error_code:null})
  return 'sent'
 }catch(error){
  const uncertain=attempted&&(!(error instanceof GmailDeliveryError)||error.uncertain)
  const status=uncertain?'sending':'failed'
  try{await update({status,last_error_code:uncertain?'DELIVERY_UNKNOWN':'GMAIL_SEND_FAILED'})}catch{return 'sending'}
  return status
 }
}

import { gmailConfigured,automaticMailReady,prepareAutomaticMail,GmailDeliveryError } from './gmail.mjs'
import { buildCustomerConfirmation } from './notifications.mjs'
import { buildConfirmationPdf } from './confirmation-pdf.mjs'
import { db, ApiError } from './chauffeur-supabase.mjs'

const validPayment=method=>['on_site','separate'].includes(method)
export const mailConfigured=gmailConfigured
export function validateConfirmation(snapshot){
  if(!snapshot)throw new ApiError(404,'예약을 찾을 수 없어요.')
  if(snapshot.quoteRequired||snapshot.total==null||snapshot.taxIncluded==null)throw new ApiError(409,'먼저 최종 예약 금액과 세금 조건을 확인해 주세요.')
  if(!Array.isArray(snapshot.journeys)||!snapshot.journeys.length)throw new ApiError(409,'이동 일정을 먼저 확인해 주세요.')
  if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(snapshot.email||''))throw new ApiError(400,'고객 이메일을 확인해 주세요.')
  if(!validPayment(snapshot.paymentMethod))throw new ApiError(400,'결제 안내를 선택해 주세요.')
}
export function confirmationPreview(snapshot){
  validateConfirmation(snapshot)
  const message=buildCustomerConfirmation(snapshot)
  const pdf=buildConfirmationPdf(snapshot)
  // The preview uses the exact CID asset from the sent email, as a data URL.
  const html=message.attachments.reduce((value,a)=>a.cid?value.replace('cid:'+a.cid,'data:'+a.contentType+';base64,'+a.content.toString('base64')):value,message.html)
  return {subject:message.subject,html,to:snapshot.email,reference:snapshot.reference,
    total:snapshot.total,taxIncluded:snapshot.taxIncluded,updatedAt:snapshot.updatedAt,
    paymentMethod:snapshot.paymentMethod,pdfBase64:pdf.toString('base64'),filename:snapshot.reference+'-Confirmation.pdf',mailConfigured:mailConfigured()}
}
export async function getConfirmationPreview(id,method){
  if(!validPayment(method))throw new ApiError(400,'결제 안내를 선택해 주세요.')
  const snapshot=await db('rpc/confirmation_snapshot_v1',{method:'POST',body:{p_reservation_id:id,p_payment_method:method}})
  return {...confirmationPreview(snapshot),mailConfigured:await automaticMailReady()}
}
const statusError=reason=>{
  if(reason==='not_found')return new ApiError(404,'예약을 찾을 수 없어요.')
  if(reason==='stale')return new ApiError(409,'예약 정보가 변경됐어요. 새로고침 후 다시 확인해 주세요.')
  if(reason==='already_queued')return new ApiError(409,'이미 확정 메일이 등록됐어요. 발송 상태를 확인해 주세요.')
  if(reason==='quote_required')return new ApiError(409,'최종 요금과 세금 조건을 확인해 주세요.')
  if(reason==='not_claimable')return new ApiError(409,'이미 발송했거나 발송 결과 확인이 필요해요.')
  if(reason==='forbidden')return new ApiError(403,'예약을 처리할 권한이 없어요.')
  return new ApiError(409,'예약 또는 이메일 상태를 다시 확인해 주세요.')
}
export async function confirmAndSend({id,expectedStatus,updatedAt,paymentMethod,staffId}){
  if(!validPayment(paymentMethod)||typeof updatedAt!=='string'||!Number.isFinite(Date.parse(updatedAt)))
    throw new ApiError(400,'예약 미리보기를 다시 열어 주세요.')
  const result=await db('rpc/confirm_and_queue_v1',{method:'POST',body:{
    p_reservation_id:id,p_expected_status:expectedStatus,p_expected_updated_at:updatedAt,
    p_payment_method:paymentMethod,p_actor_user_id:staffId
  }})
  if(!result?.ok)throw statusError(result?.reason)
  // The DB commit is final regardless of a subsequent mail problem.
  try{return {status:'confirmed',delivery:await sendQueuedConfirmation(id,staffId)}}
  catch{return {status:'confirmed',delivery:'pending'}}
}
export async function sendQueuedConfirmation(id,staffId,{prepare=prepareAutomaticMail,configured=mailConfigured}={}){
  const claim=await db('rpc/claim_confirmation_v1',{method:'POST',body:{p_reservation_id:id,p_actor_user_id:staffId}})
  if(!claim?.ok)throw statusError(claim?.reason)
  const path='confirmation_deliveries?reservation_id=eq.'+id+'&status=eq.sending'
  const update=body=>db(path,{method:'PATCH',prefer:'return=minimal',body:{...body,updated_at:new Date().toISOString()}})
  let attempted=false
  try{
    if(!configured()){
      await update({status:'failed',last_error_code:'GMAIL_NOT_CONFIGURED'})
      return 'failed'
    }
    validateConfirmation(claim.snapshot)
    const snapshot=claim.snapshot
    const email=buildCustomerConfirmation(snapshot)
    const pdf=claim.pdf_base64?Buffer.from(claim.pdf_base64,'base64'):buildConfirmationPdf(snapshot)
    const messageId='<chauffeur.confirmation.'+id+'@gmail.com>'
    await update({pdf_base64:pdf.toString('base64'),message_id:messageId})
    const send=await prepare({
      to:snapshot.email,subject:email.subject,text:email.text,html:email.html,
      attachments:[...email.attachments,{filename:snapshot.reference+'-Confirmation.pdf',content:pdf,contentType:'application/pdf'}],
      messageId,
    })
    attempted=true
    await send()
    await update({status:'sent',sent_at:new Date().toISOString(),last_error_code:null})
    return 'sent'
  }catch(error){
    // A failure before transmission or explicit Gmail rejection is retryable.
    const status=attempted&&(!(error instanceof GmailDeliveryError)||error.uncertain)?'uncertain':'failed'
    try{await update({status,last_error_code:status==='uncertain'?'DELIVERY_UNKNOWN':'SEND_FAILED'})}catch{/* DB remains sending; manual reconciliation required */}
    return status
  }
}

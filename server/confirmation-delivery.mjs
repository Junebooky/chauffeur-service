import nodemailer from 'nodemailer'
import { buildCustomerConfirmation } from './notifications.mjs'
import { buildConfirmationPdf } from './confirmation-pdf.mjs'
import { db, ApiError } from './chauffeur-supabase.mjs'

const validPayment=method=>['on_site','separate'].includes(method)
export const mailConfigured=()=>Boolean(process.env.SMTP_USER?.trim()&&process.env.SMTP_APP_PASSWORD?.replace(/\s+/g,'')&&(process.env.SMTP_FROM_EMAIL||process.env.SMTP_USER)?.trim())
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
  return confirmationPreview(snapshot)
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
export async function sendQueuedConfirmation(id,staffId,{createTransport=nodemailer.createTransport}={}){
  const claim=await db('rpc/claim_confirmation_v1',{method:'POST',body:{p_reservation_id:id,p_actor_user_id:staffId}})
  if(!claim?.ok)throw statusError(claim?.reason)
  const path='confirmation_deliveries?reservation_id=eq.'+id+'&status=eq.sending'
  const update=body=>db(path,{method:'PATCH',prefer:'return=minimal',body:{...body,updated_at:new Date().toISOString()}})
  let attempted=false
  try{
    if(!mailConfigured()){
      await update({status:'failed',last_error_code:'SMTP_NOT_CONFIGURED'})
      return 'failed'
    }
    validateConfirmation(claim.snapshot)
    const snapshot=claim.snapshot
    const email=buildCustomerConfirmation(snapshot)
    const pdf=claim.pdf_base64?Buffer.from(claim.pdf_base64,'base64'):buildConfirmationPdf(snapshot)
    const username=process.env.SMTP_USER.trim()
    const sender=(process.env.SMTP_FROM_EMAIL||username).trim()
    const messageId='<chauffeur.confirmation.'+id+'@'+(username.split('@')[1]||'gmail.com')+'>'
    await update({pdf_base64:pdf.toString('base64'),message_id:messageId})
    const secure=(process.env.SMTP_SECURE||'true').toLowerCase()==='true'
    const transport=createTransport({
      host:process.env.SMTP_HOST||'smtp.gmail.com',port:Number(process.env.SMTP_PORT||465),secure,requireTLS:!secure,
      auth:{user:username,pass:process.env.SMTP_APP_PASSWORD.replace(/\s+/g,'')},
      connectionTimeout:7000,greetingTimeout:7000,socketTimeout:12000,
    })
    attempted=true
    const info=await transport.sendMail({
      from:{name:'Chauffeur Service',address:sender},to:snapshot.email,replyTo:sender,
      subject:email.subject,text:email.text,html:email.html,
      attachments:[...email.attachments,{filename:snapshot.reference+'-Confirmation.pdf',content:pdf,contentType:'application/pdf'}],
      messageId,
    })
    if(!Array.isArray(info?.accepted)||!info.accepted.some(a=>String(a).toLowerCase()===snapshot.email.toLowerCase())){
      await update({status:'failed',last_error_code:'RECIPIENT_REJECTED'})
      return 'failed'
    }
    await update({status:'sent',sent_at:new Date().toISOString(),last_error_code:null})
    return 'sent'
  }catch(error){
    // SMTP timeouts/disconnects can occur AFTER acceptance. Never retry blindly.
    const clearlyRejected=error?.code==='EAUTH'||error?.code==='EENVELOPE'
    const status=attempted&&!clearlyRejected?'uncertain':'failed'
    try{await update({status,last_error_code:status==='uncertain'?'DELIVERY_UNKNOWN':'SEND_FAILED'})}catch{/* DB remains sending; manual reconciliation required */}
    return status
  }
}

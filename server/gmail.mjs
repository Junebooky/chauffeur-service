import { randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual } from 'node:crypto'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import addressparser from 'nodemailer/lib/addressparser/index.js'
import { db,ApiError,validUuid } from './chauffeur-supabase.mjs'
const AUTH='https://accounts.google.com/o/oauth2/v2/auth',TOKEN='https://oauth2.googleapis.com/token'
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me/'
const SCOPES=['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send']
const COOKIE='chauffeur_gmail_state'
const REDIRECTS=new Set(['http://localhost:5173/api/gmail/callback','https://chauffeur-service-bice.vercel.app/api/gmail/callback'])
const hash=s=>createHash('sha256').update(s).digest('hex')
const enc=encodeURIComponent
const config=()=>{
 const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,secret=process.env.GOOGLE_OAUTH_CLIENT_SECRET,redirect=process.env.GOOGLE_OAUTH_REDIRECT_URI,key=process.env.GMAIL_TOKEN_ENCRYPTION_KEY,email=process.env.GMAIL_ALLOWED_EMAIL?.trim().toLowerCase()
 if(!clientId||!secret||!REDIRECTS.has(redirect)||!/^[0-9a-f]{64}$/i.test(key||'')||!email)return null
 return {clientId,secret,redirect,key:Buffer.from(key,'hex'),email}
}
export const gmailConfigured=()=>Boolean(config())
const requireConfig=()=>{const c=config();if(!c)throw new ApiError(503,'Gmail 연결 환경을 먼저 설정해 주세요.');return c}
const owner=staff=>{if(staff?.role!=='owner'||!validUuid(staff.id))throw new ApiError(403,'Gmail은 소유자 계정만 연결하고 사용할 수 있어요.')}
const connectionQuery=(staff,c)=>'gmail_connections?owner_id=eq.'+staff.id+'&redirect_uri=eq.'+enc(c.redirect)
const cookie=(c,value,age)=>COOKIE+'='+value+'; Path=/api/gmail/callback; HttpOnly; SameSite=Lax; Max-Age='+age+(c.redirect.startsWith('https:')?'; Secure':'')
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
const aad=(id,c)=>Buffer.from(id+'|'+c.redirect+'|'+c.email)
function encrypt(value,id,c){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',c.key,iv);cipher.setAAD(aad(id,c))
 return [iv,Buffer.concat([cipher.update(value,'utf8'),cipher.final()]),cipher.getAuthTag()].map(b=>b.toString('base64url')).join('.')
}
function decrypt(value,id,c){
 const [iv,body,tag]=value.split('.').map(s=>Buffer.from(s,'base64url'))
 const d=createDecipheriv('aes-256-gcm',c.key,iv);d.setAAD(aad(id,c));d.setAuthTag(tag)
 return Buffer.concat([d.update(body),d.final()]).toString('utf8')
}
async function token(c,params){
 const res=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.secret,...params}),signal:AbortSignal.timeout(12000),cache:'no-store'})
 const data=await res.json()
 if(!res.ok||!data.access_token)throw new ApiError(409,'Google 인증을 완료하지 못했어요. Gmail을 다시 연결해 주세요.')
 return data
}
async function gmail(access,path,body){
 const res=await fetch(GMAIL+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000),cache:'no-store'})
 if(!res.ok)throw new ApiError(res.status===401||res.status===403?409:502,'Gmail 요청을 완료하지 못했어요. 연결 상태를 확인해 주세요.')
 return res.json()
}
async function accessFor(staff,c){
 const rows=await db(connectionQuery(staff,c)+'&select=email,encrypted_refresh_token&limit=1')
 if(!rows?.length||rows[0].email!==c.email)throw new ApiError(409,'먼저 Gmail을 연결해 주세요.')
 let refresh
 try{refresh=decrypt(rows[0].encrypted_refresh_token,staff.id,c)}catch{throw new ApiError(409,'Gmail 암호화 설정이 바뀌었어요. 다시 연결해 주세요.')}
 const data=await token(c,{grant_type:'refresh_token',refresh_token:refresh})
 if(data.refresh_token)await db(connectionQuery(staff,c),{method:'PATCH',body:{encrypted_refresh_token:encrypt(data.refresh_token,staff.id,c)},prefer:'return=minimal'})
 return data.access_token
}
// Automatic reservation mail may run without a browser session. Resolve only
// an active owner connection for the configured company mailbox/environment.
// Multiple owners are ambiguous and must be resolved, not silently selected.
async function automaticOwner(c){
 const rows=await db('gmail_connections?select=owner_id&email=eq.'+enc(c.email)+'&redirect_uri=eq.'+enc(c.redirect)+'&limit=20')
 const owners=[]
 for(const row of rows||[]){
  if(!validUuid(row.owner_id))continue
  const members=await db('staff_members?select=role,active&user_id=eq.'+row.owner_id+'&limit=1')
  if(members?.[0]?.active&&members[0].role==='owner')owners.push({id:row.owner_id,role:'owner'})
 }
 if(owners.length!==1)throw new ApiError(409,'회사 Gmail을 소유자 계정으로 연결해 주세요.')
 return owners[0]
}
export async function automaticMailReady(){
 try{const c=requireConfig();const staff=await automaticOwner(c);const rows=await db(connectionQuery(staff,c)+'&select=email,encrypted_refresh_token&limit=1');return Boolean(rows?.[0]?.email===c.email&&decrypt(rows[0].encrypted_refresh_token,staff.id,c))}
 catch{return false}
}
export class GmailDeliveryError extends Error {
 constructor(uncertain){super(uncertain?'Gmail delivery outcome is unknown.':'Gmail rejected the message.');this.uncertain=uncertain}
}
// Compile MIME (including CID images and PDFs) before transmission. A timeout
// or invalid success response AFTER send is ambiguous; never retry blindly.
async function prepareSend(access,c,mail,threadId){
 const raw=await new MailComposer({...mail,from:{name:'Chauffeur Service',address:c.email},disableFileAccess:true,disableUrlAccess:true}).compile().build()
 if(raw.length>25*1024*1024)throw new ApiError(400,'메일 첨부파일이 너무 커요.')
 return async()=>{
  let res
  try{res=await fetch(GMAIL+'messages/send',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({raw:raw.toString('base64url'),...(threadId?{threadId}:{})}),signal:AbortSignal.timeout(15000),cache:'no-store'})}
  catch{throw new GmailDeliveryError(true)}
  if(!res.ok)throw new GmailDeliveryError(![400,401,403,404,413,429].includes(res.status))
  let result
  try{result=await res.json()}catch{throw new GmailDeliveryError(true)}
  if(!result?.id)throw new GmailDeliveryError(true)
  return {id:result.id,threadId:result.threadId}
 }
}
export async function prepareAutomaticMail(mail){
 const c=requireConfig(),staff=await automaticOwner(c),access=await accessFor(staff,c)
 // Do not allow callers to override the configured company sender.
 return prepareSend(access,c,{...mail,replyTo:mail.replyTo||c.email})
}
export async function gmailStatus(staff){
 owner(staff)
 const c=config()
 if(!c)return {configured:false,connected:false}
 const rows=await db(connectionQuery(staff,c)+'&select=email,connected_at&limit=1')
 return {configured:true,connected:rows?.[0]?.email===c.email,email:c.email,connectedAt:rows?.[0]?.connected_at||null}
}
export async function gmailStart(staff,res){
 owner(staff);const c=requireConfig(),state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url')
 await db('gmail_oauth_states?expires_at=lt.'+enc(new Date().toISOString()),{method:'DELETE',prefer:'return=minimal'})
 await db('gmail_oauth_states',{method:'POST',body:{state_hash:hash(state),owner_id:staff.id,redirect_uri:c.redirect,verifier,expires_at:new Date(Date.now()+600000).toISOString()},prefer:'return=minimal'})
 res.setHeader('Set-Cookie',cookie(c,state,600))
 return {url:AUTH+'?'+new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirect,response_type:'code',scope:SCOPES.join(' '),access_type:'offline',prompt:'consent select_account',login_hint:c.email,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'})}
}
export async function gmailCallback(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer')
 const done=result=>{res.setHeader('Location','/admin/live?gmail='+result);return res.status(303).end()}
 const c=config()
 if(req.method!=='GET')return res.status(405).end()
 if(!c)return done('not_configured')
 res.setHeader('Set-Cookie',cookie(c,'',0))
 try{
  const query=new URL(req.url,'http://localhost').searchParams,state=query.get('state'),code=query.get('code')
  const stored=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)
  if(!state||!/^[A-Za-z0-9_-]{43}$/.test(state)||!stored||!/^[A-Za-z0-9_-]{43}$/.test(stored)||!equal(state,stored))return done('state_error')
  const rows=await db('gmail_oauth_states?state_hash=eq.'+hash(state)+'&redirect_uri=eq.'+enc(c.redirect)+'&expires_at=gt.'+enc(new Date().toISOString()),{method:'DELETE',prefer:'return=representation'})
  const saved=rows?.[0]
  if(!saved||!validUuid(saved.owner_id))return done('state_error')
  if(query.has('error')||!code||code.length>4096)return done('cancelled')
  const members=await db('staff_members?select=role,active&user_id=eq.'+saved.owner_id+'&limit=1')
  if(!members?.[0]?.active||members[0].role!=='owner')return done('forbidden')
  const data=await token(c,{grant_type:'authorization_code',code,redirect_uri:c.redirect,code_verifier:saved.verifier})
  if(!data.refresh_token||!SCOPES.every(s=>(data.scope||'').split(' ').includes(s)))return done('permissions')
  const profile=await gmail(data.access_token,'profile')
  if(profile.emailAddress?.toLowerCase()!==c.email)return done('wrong_account')
  await db('gmail_connections?on_conflict=owner_id,redirect_uri',{method:'POST',body:{owner_id:saved.owner_id,redirect_uri:c.redirect,email:c.email,encrypted_refresh_token:encrypt(data.refresh_token,saved.owner_id,c),connected_at:new Date().toISOString()},prefer:'resolution=merge-duplicates,return=minimal'})
  return done('connected')
 }catch{return done('error')}
}
async function labelId(access){
 const data=await gmail(access,'labels')
 return (data.labels||[]).find(l=>l.name==='CHAUFFEUR'&&l.type==='user')?.id||null
}
const header=(message,name)=>(message.payload?.headers||[]).find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||''
const safeMessage=m=>Array.isArray(m.labelIds)&&!m.labelIds.some(l=>['SPAM','TRASH'].includes(l))
const allowed=(m,label)=>safeMessage(m)&&(m.labelIds.includes('INBOX')||m.labelIds.includes('SENT')||Boolean(label&&m.labelIds.includes(label)))
const replyAddress=m=>{
 if(m.labelIds?.includes('SENT'))return ''
 const value=header(m,'Reply-To')||header(m,'From')
 if(/[\r\n]/.test(value))return ''
 const parsed=addressparser(value,{flatten:true})
 const addr=parsed.length===1?parsed[0].address:''
 return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(addr||'')?addr:''
}
const metadata=m=>({id:m.id,threadId:m.threadId,from:header(m,'From'),subject:header(m,'Subject'),date:header(m,'Date'),snippet:m.snippet||'',replyTo:replyAddress(m),unread:m.labelIds?.includes('UNREAD')||false})
const msgId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id)
export async function gmailList(staff,folder='business',pageToken=''){
 owner(staff);if(!['business','inbox','sent','review'].includes(folder)||typeof pageToken!=='string'||pageToken.length>1500)throw new ApiError(400,'메일함을 다시 선택해 주세요.')
 const c=requireConfig(),access=await accessFor(staff,c),label=await labelId(access)
 if(folder==='business'&&!label)return {labelFound:false,messages:[],hasMore:false,nextPageToken:null}
 const selectedLabel=folder==='business'?label:folder==='sent'?'SENT':'INBOX'
 const q='-in:spam -in:trash'+(folder==='inbox'?' -category:promotions -category:social':folder==='review'?' {category:promotions category:social}':'')
 const list=await gmail(access,'messages?'+new URLSearchParams({labelIds:selectedLabel,q,maxResults:'20',...(pageToken?{pageToken}:{})}))
 const messages=await Promise.all((list.messages||[]).filter(m=>msgId(m.id)).map(m=>gmail(access,'messages/'+m.id+'?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Date')))
 return {labelFound:!!label,messages:messages.filter(m=>safeMessage(m)&&m.labelIds.includes(selectedLabel)).map(metadata),hasMore:!!list.nextPageToken,nextPageToken:list.nextPageToken||null}
}

function plain(part){
 if(!part||part.filename)return ''
 if(part.mimeType==='text/plain'&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8')
 return (part.parts||[]).map(plain).filter(Boolean).join('\n')
}
export async function gmailRead(staff,id){
 owner(staff);if(!msgId(id))throw new ApiError(400,'메일을 다시 선택해 주세요.')
 const access=await accessFor(staff,requireConfig()),label=await labelId(access)
 const meta=await gmail(access,'messages/'+id+'?format=metadata')
 if(!allowed(meta,label))throw new ApiError(404,'업무 라벨이 지정된 메일만 열 수 있어요.')
 const message=await gmail(access,'messages/'+id+'?format=full')
 if(!allowed(message,label))throw new ApiError(404,'업무 메일을 찾을 수 없어요.')
 return {...metadata(message),body:plain(message.payload).slice(0,50000)||message.snippet||'',plainTextOnly:true}
}
export async function gmailSend(staff,b){
 owner(staff);const c=requireConfig()
 const to=typeof b.to==='string'?b.to.trim():'',subject=typeof b.subject==='string'?b.subject.trim():'',body=typeof b.message==='string'?b.message:''
 if(b.confirm!==true||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)||to.length>254||!subject||subject.length>200||/[\r\n]/.test(subject)||!body.trim()||body.length>10000)throw new ApiError(400,'받는 사람, 제목, 본문을 다시 확인해 주세요.')
 const access=await accessFor(staff,c)
 let mail={to,subject,text:body},threadId
 if(b.replyId){
  if(!msgId(b.replyId))throw new ApiError(400,'답장할 메일을 다시 선택해 주세요.')
  const label=await labelId(access),original=await gmail(access,'messages/'+b.replyId+'?format=metadata')
  const address=replyAddress(original),id=header(original,'Message-ID')
  if(!allowed(original,label)||!address||address.toLowerCase()!==to.toLowerCase()||!/^<[^<>\s]+>$/.test(id)||!msgId(original.threadId))throw new ApiError(409,'원본 메일 또는 답장 주소를 다시 확인해 주세요.')
  const expected=/^re:/i.test(header(original,'Subject'))?header(original,'Subject'):'Re: '+header(original,'Subject')
  if(subject!==expected.trim())throw new ApiError(400,'답장 제목은 원본과 같아야 해요.')
  const refs=(header(original,'References').match(/<[^<>\s]+>/g)||[]).slice(-20)
  mail={...mail,inReplyTo:id,references:[...refs,id]}
  threadId=original.threadId
 }
 try{return await (await prepareSend(access,c,mail,threadId))()}
 catch(error){if(error instanceof GmailDeliveryError)throw new ApiError(409,error.uncertain?'발송 결과를 확인할 수 없어요. 보낸 메일을 확인한 뒤 다시 시도해 주세요.':'Gmail이 발송 요청을 거절했어요. 연결 상태를 확인해 주세요.');throw error}
}

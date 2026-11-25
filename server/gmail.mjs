import { randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual } from 'node:crypto'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
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
const allowed=(m,label)=>m.labelIds?.includes(label)&&!m.labelIds.some(l=>['SPAM','TRASH'].includes(l))
const metadata=m=>({id:m.id,threadId:m.threadId,from:header(m,'From'),subject:header(m,'Subject'),date:header(m,'Date'),snippet:m.snippet||'',unread:m.labelIds?.includes('UNREAD')||false})
const msgId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id)
export async function gmailList(staff){
 owner(staff);const c=requireConfig(),access=await accessFor(staff,c),label=await labelId(access)
 if(!label)return {labelFound:false,messages:[],hasMore:false}
 const list=await gmail(access,'messages?labelIds='+enc(label)+'&q='+enc('-in:spam -in:trash')+'&maxResults=20')
 const messages=await Promise.all((list.messages||[]).filter(m=>msgId(m.id)).map(m=>gmail(access,'messages/'+m.id+'?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date')))
 return {labelFound:true,messages:messages.filter(m=>allowed(m,label)).map(metadata),hasMore:!!list.nextPageToken}
}
function plain(part){
 if(!part||part.filename)return ''
 if(part.mimeType==='text/plain'&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8')
 return (part.parts||[]).map(plain).filter(Boolean).join('\n')
}
export async function gmailRead(staff,id){
 owner(staff);if(!msgId(id))throw new ApiError(400,'메일을 다시 선택해 주세요.')
 const access=await accessFor(staff,requireConfig()),label=await labelId(access)
 if(!label)throw new ApiError(404,'업무 메일 라벨을 먼저 확인해 주세요.')
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
 const raw=await new MailComposer({from:c.email,to,subject,text:body}).compile().build()
 const result=await gmail(access,'messages/send',{raw:raw.toString('base64url')})
 return {id:result.id,threadId:result.threadId}
}

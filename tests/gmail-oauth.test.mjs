import {test} from 'node:test'
import assert from 'node:assert/strict'
import {gmailStart,gmailCallback,gmailStatus,gmailList,gmailRead,gmailSend,prepareAutomaticMail,automaticMailReady} from '../server/gmail.mjs'
const id='a3cf6400-d7b5-4056-b47b-e9d49ee8a0a3',staff={id,role:'owner'},redirect='http://localhost:5173/api/gmail/callback'
const settings={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TEST',GOOGLE_OAUTH_CLIENT_ID:'test-client',GOOGLE_OAUTH_CLIENT_SECRET:'test-secret',GOOGLE_OAUTH_REDIRECT_URI:redirect,GMAIL_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),GMAIL_ALLOWED_EMAIL:'owner@example.invalid'}
const response=()=>({headers:{},code:0,setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},end(){return this}})
const json=data=>({ok:true,json:async()=>data,text:async()=>JSON.stringify(data)})
test('owner-only OAuth uses PKCE, single-use state, browser cookie, exact account and encrypted refresh token; mail is label scoped',async()=>{
 const original=globalThis.fetch,old=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]]))
 Object.assign(process.env,settings)
 let state,connection,raw
 const requests=[]
 globalThis.fetch=async(url,opts)=>{
  const u=String(url),b=opts.body&&typeof opts.body==='string'?JSON.parse(opts.body):opts.body
  requests.push(u)
  if(u.includes('gmail_oauth_states?')&&opts.method==='DELETE'){
   if(u.includes('state_hash=eq.')){const result=state?[state]:[];state=null;return json(result)}
   return json(null)
  }
  if(u.endsWith('/gmail_oauth_states')&&opts.method==='POST'){state=b;return json(null)}
  if(u.includes('staff_members?'))return json([{role:'owner',active:true}])
  if(u.includes('gmail_connections?on_conflict=')){connection=b;return json(null)}
  if(u.includes('gmail_connections?'))return json(connection?[connection]:[])
  if(u==='https://oauth2.googleapis.com/token'){
   if(b.get('grant_type')==='authorization_code'){assert.ok(b.get('code_verifier'));return json({access_token:'ACCESS',refresh_token:'REFRESH_PRIVATE',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'})}
   assert.equal(b.get('refresh_token'),'REFRESH_PRIVATE');return json({access_token:'ACCESS'})
  }
  if(u.endsWith('/profile'))return json({emailAddress:'owner@example.invalid'})
  if(u.endsWith('/labels'))return json({labels:[{name:'CHAUFFEUR',id:'Label_1',type:'user'}]})
  if(u.includes('/messages?')){assert.match(u,/labelIds=Label_1/);return json({messages:[{id:'valid'},{id:'spam'}]})}
  if(u.includes('/messages/valid?'))return json({id:'valid',labelIds:['Label_1'],payload:{mimeType:'text/plain',body:{data:Buffer.from('Business inquiry').toString('base64url')},headers:[{name:'Subject',value:'New inquiry'}]}})
  if(u.includes('/messages/spam?'))return json({id:'spam',labelIds:['Label_1','SPAM']})
  if(u.endsWith('/messages/send')){raw=Buffer.from(b.raw,'base64url').toString();return json({id:'sent-id',threadId:'thread-id'})}
  throw Error('unexpected mock route')
 }
 try{
  await assert.rejects(gmailStatus({...staff,role:'operator'}),/소유자/)
  const start=response(),result=await gmailStart(staff,start),u=new URL(result.url),s=u.searchParams.get('state')
  assert.equal(u.searchParams.get('redirect_uri'),redirect)
  assert.equal(u.searchParams.get('code_challenge_method'),'S256')
  assert.equal(u.searchParams.get('access_type'),'offline')
  assert.match(start.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/)
  assert.notEqual(state.state_hash,s)
  const bad=response()
  await gmailCallback({method:'GET',url:'/api/gmail/callback?state='+s+'&code=code',headers:{}},bad)
  assert.match(bad.headers.Location,/state_error/)
  assert.ok(state)
  const good=response(),req={method:'GET',url:'/api/gmail/callback?state='+s+'&code=code',headers:{cookie:'chauffeur_gmail_state='+s}}
  await gmailCallback(req,good)
  assert.equal(good.code,303);assert.match(good.headers.Location,/gmail=connected$/)
  assert.ok(connection.encrypted_refresh_token);assert.doesNotMatch(connection.encrypted_refresh_token,/REFRESH_PRIVATE/)
  const replay=response();await gmailCallback(req,replay);assert.match(replay.headers.Location,/state_error/)
  const status=await gmailStatus(staff);assert.equal(status.connected,true);assert.doesNotMatch(JSON.stringify(status),/encrypted_refresh_token|REFRESH_PRIVATE/)
  const list=await gmailList(staff);assert.deepEqual(list.messages.map(m=>m.id),['valid'])
  assert.equal((await gmailRead(staff,'valid')).body,'Business inquiry')
  await assert.rejects(gmailRead(staff,'spam'),/업무 라벨/)
  await assert.rejects(gmailSend(staff,{to:'guest@example.invalid',subject:'Hello',message:'Hello'}),/확인/)
  const sent=await gmailSend(staff,{to:'guest@example.invalid',subject:'Hello',message:'Hello',confirm:true})
  assert.equal(sent.id,'sent-id');assert.match(raw,/To: guest@example.invalid/)
  assert.equal(await automaticMailReady(),true)
  const automatic=await prepareAutomaticMail({to:'guest@example.invalid',subject:'Confirmation',html:'<h1>Confirmed</h1>',text:'Confirmed',attachments:[{filename:'Confirmation.pdf',content:Buffer.from('%PDF-test'),contentType:'application/pdf'}]})
  assert.equal((await automatic()).id,'sent-id')
  assert.match(raw,/From: Chauffeur Service <owner@example.invalid>/)
  assert.match(raw,/Content-Type: application\/pdf/)
  assert.match(raw,/Confirmation\.pdf/)
 }finally{globalThis.fetch=original;for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
})

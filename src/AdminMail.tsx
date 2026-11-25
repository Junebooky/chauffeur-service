import { useEffect,useState } from 'react'
import type { FormEvent } from 'react'
import { Mail,RefreshCw,ArrowRight,ExternalLink } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
type Api=(method:'GET'|'POST',body?:Record<string,unknown>)=>Promise<any>
type Connection={configured:boolean;connected:boolean;email?:string}
type Message={id:string;from:string;subject:string;date:string;snippet:string;unread:boolean;body?:string}
const notices:Record<string,string>={connected:'Gmail을 연결했어요.',wrong_account:'등록한 업무 Gmail 계정으로 다시 연결해 주세요.',permissions:'메일 읽기와 보내기 권한을 모두 허용해 주세요.',state_error:'연결 요청이 만료됐어요. 다시 연결해 주세요.',cancelled:'Google 연결을 취소했어요.',not_configured:'서버의 Gmail 설정을 확인해 주세요.',error:'Gmail 연결을 완료하지 못했어요. 다시 시도해 주세요.',forbidden:'소유자 권한이 필요해요.'}
export default function AdminMail({api,role}:{api:Api;role:string|undefined}){
 const [connection,setConnection]=useState<Connection|null>(null)
 const [messages,setMessages]=useState<Message[]>([])
 const [labelFound,setLabelFound]=useState(true)
 const [more,setMore]=useState(false)
 const [selected,setSelected]=useState<Message|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState(()=>notices[new URLSearchParams(window.location.search).get('gmail')||'']||'')
 const [compose,setCompose]=useState(false)
 const [to,setTo]=useState(''),[subject,setSubject]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{
  if(role!=='owner')return
  let active=true
  api('POST',{action:'gmail_status'}).then(r=>{if(active)setConnection(r.data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'연결 상태를 확인하지 못했어요.')})
  const query=new URLSearchParams(window.location.search)
  if(query.has('gmail')){query.delete('gmail');window.history.replaceState({},'',window.location.pathname+(query.size?'?'+query.toString():'')+window.location.hash)}
  return()=>{active=false}
 },[api,role])
 const run=async(fn:()=>Promise<void>)=>{
  setBusy(true);setError('')
  try{await fn()}catch(e){setError(e instanceof Error?e.message:'다시 시도해 주세요.')}finally{setBusy(false)}
 }
 const connect=()=>void run(async()=>{
  const r=await api('POST',{action:'gmail_start'})
  window.location.assign(r.data.url)
 })
 const refresh=()=>void run(async()=>{
  const r=await api('POST',{action:'gmail_list'})
  setMessages(r.data.messages);setLabelFound(r.data.labelFound);setMore(r.data.hasMore);setSelected(null)
 })
 const read=(id:string)=>void run(async()=>{const r=await api('POST',{action:'gmail_read',id});setSelected(r.data)})
 const send=(e:FormEvent)=>{
  e.preventDefault()
  if(!window.confirm(to+' 주소로 이메일을 보낼까요?'))return
  void run(async()=>{
   await api('POST',{action:'gmail_send',to,subject,message,confirm:true})
   setNotice('Gmail에 이메일 발송 요청을 완료했어요.');setCompose(false);setTo('');setSubject('');setMessage('')
  })
 }
 return <>
  <div className="admin-heading"><div><SectionEyebrow>고객 소통</SectionEyebrow><DisplayHeading as="h1">메일함</DisplayHeading><p>업무 메일만 확인하고 고객에게 안내해 주세요.</p></div></div>
  {notice&&<div className="admin-success admin-banner" role="status">{notice}<button onClick={()=>setNotice('')}>닫기</button></div>}
  {error&&<div className="admin-error admin-banner" role="alert">{error}<button onClick={()=>setError('')}>닫기</button></div>}
  {role!=='owner'?<section className="admin-ops-panel"><p>Gmail은 소유자 계정으로만 사용할 수 있어요.</p></section>:!connection?<section className="admin-ops-panel"><p>연결 상태를 확인하고 있어요.</p></section>:<>
   <section className="admin-ops-panel"><h2><Mail size={17}/> {connection.connected?'Gmail 연결됨':'Gmail 연결'}</h2>
    <p className="admin-ko-caption">{connection.email||'서버 환경변수 설정이 필요해요.'}</p>
    <p className="admin-ko-caption">CHAUFFEUR 라벨을 지정한 메일만 조회해요. 개인 메일이나 스팸은 자동으로 가져오지 않아요.</p>
    <div className="admin-ko-actions"><button className="admin-secondary" disabled={busy||!connection.configured} onClick={connect}>{connection.connected?'Gmail 다시 연결':'Google 계정 연결'} <ArrowRight size={14}/></button>{connection.connected&&<button className="admin-primary" disabled={busy} onClick={refresh}><RefreshCw size={15}/> 업무 메일 확인</button>}</div>
   </section>
   {connection.connected&&<section className="admin-ops-panel">
    <div className="admin-mail-heading"><h2>업무 메일</h2><button className="admin-secondary" disabled={busy} onClick={()=>{setCompose(!compose);setSelected(null)}}>{compose?'작성 닫기':'메일 쓰기'}</button></div>
    {compose&&<form className="admin-edit-form" onSubmit={send}>
     <label>받는 사람<input type="email" required maxLength={254} value={to} onChange={e=>setTo(e.target.value)}/></label>
     <label>제목<input required maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
     <label>본문<textarea rows={7} required maxLength={10000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
     <button className="admin-primary" disabled={busy}>이메일 보내기 <ArrowRight size={14}/></button>
    </form>}
    {!labelFound&&<p className="admin-ko-caption">Gmail에서 CHAUFFEUR 라벨을 만들고 업무 메일에 지정해 주세요. <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Gmail 열기 <ExternalLink size={12}/></a></p>}
    {busy&&<p className="admin-ko-caption">요청을 처리하고 있어요…</p>}
    {!busy&&labelFound&&!messages.length&&<p className="admin-ko-caption">업무 메일 확인 버튼을 누르면 라벨이 지정된 메일을 불러와요.</p>}
    {messages.map(m=><button className="admin-task-row admin-mail-row" key={m.id} disabled={busy} onClick={()=>{setCompose(false);read(m.id)}}><Mail size={15}/><span><strong>{m.subject||'(제목 없음)'}</strong><small>{m.from}</small><small>{m.snippet}</small></span><ArrowRight size={14}/></button>)}
    {more&&<p className="admin-ko-caption">최신 업무 메일 20건을 표시해요. 이전 메일은 Gmail에서 확인해 주세요.</p>}
    {selected&&<div className="admin-mail-detail"><h2>{selected.subject||'(제목 없음)'}</h2><p className="admin-ko-caption">{selected.from} · {selected.date}</p><pre>{selected.body}</pre><p className="admin-ko-caption">보안을 위해 HTML, 원격 이미지와 첨부파일은 열지 않아요.</p><button className="admin-secondary" onClick={()=>setSelected(null)}>닫기</button></div>}
   </section>}
  </>}
 </>
}

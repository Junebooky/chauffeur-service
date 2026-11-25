import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, ClipboardList, FileText, LogOut, Mail, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import { bookingStatusKo, serviceKo, vehicleKo, moneyKo, dateKo, dayKo, nextActions } from './admin-locale'
import './admin.css'
import './admin-korean.css'

type Session = { access_token:string; refresh_token:string }
type Reservation = {
  id:string; reference:string;customer_name:string;customer_email:string;customer_phone:string;
  status:string;customer_type:string;quoted_total:number|null;quote_required:boolean;created_at:string;tax_included:boolean|null;
  contact_method:string;messenger_contact:string|null; company_name:string|null;
}
type Journey = {
  id:string;reservation_id:string;position:number;service_date:string;pickup_time:string;
  service_code:string;vehicle_class:string;pickup_address:string;destination_address:string;
  flight_number:string|null;stops?:Array<{location:string;place?:{name?:string}}>;
}
type Delivery = {reservation_id:string;status:'pending'|'sending'|'sent'|'failed'|'uncertain';attempts:number;sent_at:string|null;claimed_at:string|null}
type Snapshot = {role:string;reservations:Reservation[];days:Journey[];deliveries:Delivery[]}
type Preview = {subject:string;html:string;to:string;reference:string;total:number;taxIncluded:boolean;updatedAt:string;pdfBase64:string;filename:string;mailConfigured:boolean;paymentMethod:'on_site'|'separate'}
const deliveryLabels:Record<string,string>={pending:'발송 대기',sending:'발송 결과 확인 필요',sent:'발송 완료',failed:'발송 실패',uncertain:'발송 결과 확인 필요'}
function downloadConfirmation(preview:Preview){
  const bytes=Uint8Array.from(atob(preview.pdfBase64),c=>c.charCodeAt(0))
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}))
  const link=document.createElement('a');link.href=url;link.download=preview.filename;link.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

const DB_URL = import.meta.env.VITE_SUPABASE_URL as string|undefined
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined
const SESSION_KEY='chauffeur-admin-session'
const storedSession = ():Session|null => {
  try {
    const data=sessionStorage.getItem(SESSION_KEY)
    if(!data)return null
    const value=JSON.parse(data) as Session
    return value.access_token && value.refresh_token ? value:null
  }catch{return null}
}
const setStored = (session:Session) => {sessionStorage.setItem(SESSION_KEY,JSON.stringify(session))}
const credential = () => ({apikey:PUBLIC_KEY||'','Content-Type':'application/json'})
const readableError = async (response:Response, fallback:string) => {
  try {const json=await response.json();return typeof json?.msg==='string'?json.msg:typeof json?.error_description==='string'?json.error_description:typeof json?.error==='string'?json.error:fallback}
  catch{return fallback}
}
function AuthGate({onLogin}:{onLogin:(session:Session)=>void}) {
  const [email,setEmail]=useState('')
  const [code,setCode]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [sent,setSent]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const configOk=Boolean(DB_URL&&PUBLIC_KEY)
  const requestLink=async(e:FormEvent)=>{
    e.preventDefault();setError('');setNotice('')
    if(!configOk){setError('관리자 인증 설정을 확인해 주세요.');return}
    setBusy(true)
    try{
      const response=await fetch(DB_URL+'/auth/v1/otp?redirect_to='+encodeURIComponent(window.location.origin+'/admin/live'),{
        method:'POST',headers:credential(),body:JSON.stringify({email:email.trim(),create_user:false})
      })
      if(!response.ok)throw new Error(await readableError(response,'이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setSent(true)
      setNotice('메일함을 확인해 주세요. 로그인 링크를 누르면 바로 업무를 시작할 수 있어요.')
    }catch(err){setError(err instanceof Error?err.message:'다시 시도해 주세요.')}
    finally{setBusy(false)}
  }
  const verify=async(e:FormEvent)=>{
    e.preventDefault();setError('');setBusy(true)
    try{
      const response=await fetch(DB_URL+'/auth/v1/verify',{
        method:'POST',headers:credential(),body:JSON.stringify({email:email.trim(),token:code.trim(),type:'email'})
      })
      if(!response.ok)throw new Error(await readableError(response,'인증번호가 맞지 않아요. 다시 확인해 주세요.'))
      const data=await response.json()
      if(!data.access_token||!data.refresh_token)throw new Error('로그인 정보를 확인하지 못했어요.')
      onLogin({access_token:data.access_token,refresh_token:data.refresh_token})
    }catch(err){setError(err instanceof Error?err.message:'다시 시도해 주세요.')}
    finally{setBusy(false)}
  }
  const passwordLogin=async(e:FormEvent)=>{
    e.preventDefault();setError('');setBusy(true)
    try{
      const response=await fetch(DB_URL+'/auth/v1/token?grant_type=password',{
        method:'POST',headers:credential(),body:JSON.stringify({email:email.trim(),password})
      })
      if(!response.ok)throw new Error('이메일이나 비밀번호를 다시 확인해 주세요.')
      const data=await response.json()
      if(!data.access_token||!data.refresh_token)throw new Error('인증에 실패했어요.')
      onLogin({access_token:data.access_token,refresh_token:data.refresh_token})
    }catch(err){setError(err instanceof Error?err.message:'다시 시도해 주세요.')}
    finally{setBusy(false)}
  }
  return <div className="admin-root admin-login admin-ko">
    <section className="admin-login-card admin-auth-card">
      <div className="admin-logo"><span className="admin-ko-mark">J</span><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <SectionEyebrow>관리자 전용</SectionEyebrow>
      <DisplayHeading as="h1">예약을 처리해 볼까요?</DisplayHeading>
      <p>고객 정보와 예약 승인 내용은 관리자만 볼 수 있어요. 비밀번호 대신 이메일로 로그인할 수 있어요.</p>
      <form className="admin-stack" onSubmit={showPassword?passwordLogin:requestLink}>
        <label>관리자 이메일<input type="email" required autoComplete="email" placeholder="이메일 주소 입력" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        {showPassword&&<label>비밀번호<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>}
        <button type="submit" disabled={busy||!configOk} className="admin-primary">{busy?'확인하고 있어요…':showPassword?'로그인하기':'이메일로 로그인 링크 받기'} <ArrowRight size={15}/></button>
      </form>
      {sent&&!showPassword&&<form onSubmit={verify} className="admin-stack admin-code-entry"><label>메일에 인증번호가 있다면 입력해 주세요<input inputMode="numeric" autoComplete="one-time-code" placeholder="인증번호" value={code} onChange={e=>setCode(e.target.value)} required /></label><button type="submit" disabled={busy||!code.trim()} className="admin-secondary">인증번호 확인</button></form>}
      {notice&&<p className="admin-success" role="status">{notice}</p>}
      {error&&<p className="admin-error" role="alert">{error}</p>}
      <button className="admin-text-link" onClick={()=>{setShowPassword(!showPassword);setError('')}}>{showPassword?'이메일 링크로 로그인':'기존 비밀번호로 로그인'}</button>
      <a className="admin-back" href="/admin"><ArrowLeft size={13}/> 예약 현황만 보기</a>
    </section>
  </div>
}
const Empty=({children}:{children:ReactNode})=><div className="admin-empty">{children}</div>

export default function Admin(){
  const [session,setSession]=useState<Session|null>(storedSession)
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
  const [loading,setLoading]=useState(false)
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [selectedId,setSelectedId]=useState('')
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [paymentMethod,setPaymentMethod]=useState<'on_site'|'separate'>('on_site')
  const [preview,setPreview]=useState<Preview|null>(null)
  const [previewId,setPreviewId]=useState('')
  const [previewReadOnly,setPreviewReadOnly]=useState(false)
  const [previewPending,setPreviewPending]=useState(false)
  const confirmationDialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{if(preview&&confirmationDialog.current&&!confirmationDialog.current.open)confirmationDialog.current.showModal()},[preview])

  useEffect(()=>{
    const hash=window.location.hash
    const params=new URLSearchParams(hash.startsWith('#')?hash.slice(1):'')
    const access=params.get('access_token'),refresh=params.get('refresh_token')
    if(access&&refresh){
      const next={access_token:access,refresh_token:refresh}
      setStored(next);setSession(next)
      window.history.replaceState({},'',window.location.pathname+window.location.search)
    }
    const query=new URLSearchParams(window.location.search)
    const type=query.get('error_description')
    if(type)setError('로그인 링크가 만료되었어요. 다시 요청해 주세요.')
  },[])
  const signOut=()=>{sessionStorage.removeItem(SESSION_KEY);setSession(null);setSnapshot(null);setPreview(null)}
  const api=useCallback(async(method:'GET'|'POST',body?:Record<string,unknown>)=>{
    if(!session)throw new Error('로그인이 필요해요.')
    const call=async(token:string)=>fetch('/api/admin',{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})})
    let response=await call(session.access_token)
    if(response.status===401&&DB_URL&&PUBLIC_KEY){
      const refreshed=await fetch(DB_URL+'/auth/v1/token?grant_type=refresh_token',{
        method:'POST',headers:credential(),body:JSON.stringify({refresh_token:session.refresh_token})
      })
      if(refreshed.ok){
        const data=await refreshed.json()
        if(data.access_token&&data.refresh_token){
          const next={access_token:data.access_token,refresh_token:data.refresh_token}
          setStored(next);setSession(next)
          response=await call(next.access_token)
        }
      }
    }
    if(response.status===401){signOut();throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.')}
    let data:any
    try {data=await response.json()} catch {throw new Error('서버 응답을 확인하지 못했어요.')}
    if(!response.ok)throw new Error(data.error||'처리하지 못했어요. 다시 시도해 주세요.')
    return data
  },[session])
  const refresh=useCallback(async()=>{
    if(!session)return
    setLoading(true)
    try{
      const s=await api('GET') as Snapshot
      setSnapshot(s)
      setSelectedId(prev=>s.reservations.some(r=>r.id===prev)?prev:s.reservations[0]?.id||'')
    }catch(err){setError(err instanceof Error?err.message:'예약을 불러오지 못했어요.')}
    finally{setLoading(false)}
  },[api,session])
  useEffect(()=>{void refresh()},[refresh])
  const mutate=async(body:Record<string,unknown>,success:string)=>{
    setPending(true);setError('');setMessage('')
    try {await api('POST',body);setMessage(success);await refresh()}
    catch(err){setError(err instanceof Error?err.message:'다시 시도해 주세요.')}
    finally{setPending(false)}
  }
  const reservations=snapshot?.reservations||[]
  const items=useMemo(()=>reservations.filter(r=>
    (filter==='all'||r.status===filter||filter==='reviewing'&&['quoted','awaiting_deposit'].includes(r.status))&&[r.reference,r.customer_name,r.customer_email].some(s=>s.toLowerCase().includes(search.toLowerCase()))
  ),[reservations,search,filter])
  const current=reservations.find(r=>r.id===selectedId)||null
  const days=(snapshot?.days||[]).filter(d=>d.reservation_id===selectedId).sort((a,b)=>a.position-b.position)
  const delivery=(snapshot?.deliveries||[]).find(d=>d.reservation_id===selectedId)
  const canEdit=!!snapshot&&['owner','admin','operator'].includes(snapshot.role)
  const stats=[
    ['새 예약',reservations.filter(r=>r.status==='requested').length],
    ['확인 중',reservations.filter(r=>['reviewing','quoted','awaiting_deposit'].includes(r.status)).length],
    ['확정된 예약',reservations.filter(r=>['confirmed','in_progress'].includes(r.status)).length],
  ] as const
  const openPreview=async(readOnly=false,method=paymentMethod)=>{
    if(!current||!canEdit)return
    setPreviewPending(true);setError('');setPreview(null)
    try{
      const res=await api('POST',{action:readOnly?'confirmation_document':'confirmation_preview',reservation_id:current.id,payment_method:method})
      setPreview(res.data as Preview);setPreviewId(current.id);setPreviewReadOnly(readOnly)
    }catch(err){setError(err instanceof Error?err.message:'미리보기를 불러오지 못했어요.')}
    finally{setPreviewPending(false)}
  }
  const sendConfirmation=async()=>{
    if(!current||!preview||current.id!==previewId||pending||!preview.mailConfigured)return
    setPending(true);setError('');setMessage('')
    try{
      const res=await api('POST',{action:'confirm_and_send',reservation_id:current.id,expected_status:current.status,
        expected_updated_at:preview.updatedAt,payment_method:preview.paymentMethod})
      setPreview(null)
      setMessage(res.data.delivery==='sent'?'예약을 확정하고 고객에게 확인서를 보냈어요.':'예약은 확정됐어요. 이메일 발송 상태를 확인해 주세요.')
      await refresh()
    }catch(err){setError(err instanceof Error?err.message:'확정 결과를 확인하지 못했어요. 새로고침해 주세요.');setPreview(null);await refresh()}
    finally{setPending(false)}
  }
  const retry=async()=>{
    if(!current||pending)return
    setPending(true);setError('');setMessage('')
    try{
      const res=await api('POST',{action:'retry_confirmation',reservation_id:current.id})
      setMessage(res.data.delivery==='sent'?'고객에게 확인서를 보냈어요.':'발송 상태를 다시 확인해 주세요.')
      await refresh()
    }catch(err){setError(err instanceof Error?err.message:'다시 시도해 주세요.');await refresh()}
    finally{setPending(false)}
  }
  const change=(status:string)=>{
    if(!current)return
    if(status==='confirmed'){void openPreview();return}
    if(['declined','cancelled','completed'].includes(status)&&!window.confirm(
      status==='cancelled'?'예약을 취소할까요?':status==='declined'?'이 예약을 거절할까요?':'서비스를 완료 처리할까요?'))return
    void mutate({action:'advance',reservation_id:current.id,expected_status:current.status,status},'예약 상태를 변경했어요.')
  }
  if(!session)return <AuthGate onLogin={s=>{setStored(s);setSession(s);setSnapshot(null)}}/>
  return <div className="admin-root admin-ko">
    <aside className="admin-sidebar">
      <div className="admin-logo"><span className="admin-ko-mark">J</span><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <p className="admin-sidebar-eyebrow">운영 관리</p>
      <button className="selected" type="button"><ClipboardList size={17}/> 예약 관리</button>
      <div className="admin-sidebar-bottom"><span><ShieldCheck size={14}/> 관리자 권한 · {snapshot?.role||'확인 중'}</span><a href="/admin">예약 현황만 보기 <ArrowRight size={13}/></a><button onClick={signOut}><LogOut size={15}/> 로그아웃</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>CHAUFFEUR / 예약 관리</span><button disabled={loading} onClick={()=>void refresh()}><RefreshCw size={14}/> 새로고침</button></header>
      <div className="admin-content">
        {error&&<div className="admin-error admin-banner" role="alert">{error}<button onClick={()=>setError('')}>닫기</button></div>}
        {message&&<div className="admin-success admin-banner" role="status">{message}<button onClick={()=>setMessage('')}>닫기</button></div>}
        <>
          <div className="admin-heading"><div><SectionEyebrow>예약 운영</SectionEyebrow><DisplayHeading as="h1">예약 업무, 여기서 끝내요.</DisplayHeading><p>새 예약을 확인하고 고객에게 확정 안내를 보내 주세요.</p></div><span className="admin-count">실제 예약 {reservations.length}건</span></div>
          <div className="admin-stats">{stats.map(([label,count])=><div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div>
          <div className="admin-board">
            <section className="admin-list">
              <div className="admin-panel-heading"><h2>예약 요청</h2><span>최신 {reservations.length}건</span></div>
              <div className="admin-filters"><div className="admin-search"><Search size={15}/><input aria-label="예약 검색" placeholder="예약번호 또는 고객명 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="admin-select-wrap"><select value={filter} aria-label="예약 상태" onChange={e=>setFilter(e.target.value)}><option value="all">전체 상태</option>{Object.entries(bookingStatusKo).filter(([status])=>!['quoted','awaiting_deposit'].includes(status)).map(([status,name])=><option value={status} key={status}>{name}</option>)}</select><ChevronDown size={14}/></div></div>
              {loading&&!snapshot?<Empty>예약을 불러오고 있어요…</Empty>:!items.length?<Empty>{reservations.length?'조건에 맞는 예약이 없어요.':'아직 접수된 예약이 없어요.'}</Empty>:<div className="admin-booking-list">{items.map(r=><button key={r.id} className={'admin-booking '+(r.id===selectedId?'active':'')} onClick={()=>{setSelectedId(r.id);setPreview(null);setPaymentMethod('on_site')}}><div><strong>{r.reference}</strong><span>{r.customer_name}</span><small>{dateKo(r.created_at)}</small></div><div className="admin-booking-right"><span className={'admin-status '+r.status}>{bookingStatusKo[r.status]||r.status}</span></div></button>)}</div>}
            </section>
            <section className="admin-detail">
              {!current?<Empty>왼쪽에서 예약을 선택해 주세요.</Empty>:<>
                <div className="admin-panel-heading"><div><span className="admin-eyebrow">예약 상세</span><h2>{current.reference}</h2></div><span className={'admin-status '+current.status}>{bookingStatusKo[current.status]||current.status}</span></div>
                <div className="admin-detail-scroll">
                  <section className="admin-section admin-ko-step"><span className="admin-ko-eyebrow">지금 할 일</span><h3>{current.status==='requested'?'새 예약이 도착했어요.':current.status==='confirmed'?'예약이 확정됐어요.':current.status==='completed'?'서비스가 완료됐어요.':'예약 진행 상태를 확인해 주세요.'}</h3>
                    <p className="admin-ko-caption">차량과 기사는 나중에 준비해도 괜찮아요. 먼저 예약을 확정하고 확인서를 보내 주세요.</p>
                    {canEdit&&<div className="admin-ko-actions">{(nextActions[current.status]||[]).map(a=><button type="button" key={a.to} disabled={pending||previewPending} className={'admin-action-'+a.style} title={a.hint} onClick={()=>change(a.to)}>{pending||previewPending?'처리하고 있어요…':a.label}{a.style==='primary'&&<ArrowRight size={15}/>}</button>)}</div>}
                    {!canEdit&&<p className="admin-ko-caption">이 계정은 예약 변경 권한이 없어요.</p>}
                  </section>
                  <section className="admin-section"><h3>고객 정보</h3><div className="admin-info-grid"><div><small>예약자</small><strong>{current.customer_name}</strong></div><div><small>전화번호</small><strong>{current.customer_phone}</strong></div><div className="wide"><small>이메일</small><strong>{current.customer_email}</strong></div>{current.company_name&&<div className="wide"><small>기업명</small><strong>{current.company_name}</strong></div>}</div></section>
                  <section className="admin-section"><h3>이동 일정 <span>총 {days.length}일</span></h3>{days.map(d=><div className="admin-ko-day" key={d.id}><div className="admin-day-top"><span>DAY {String(d.position).padStart(2,'0')}</span><strong>{dayKo(d.service_date)} · {d.pickup_time.slice(0,5)}</strong></div><h4>{vehicleKo(d.vehicle_class)} · {serviceKo(d.service_code)}</h4><div className="admin-ko-route"><span>{d.pickup_address}</span><ArrowRight size={13}/><span>{d.destination_address}</span></div>{d.flight_number&&<small>항공편 {d.flight_number}</small>}
                    {d.stops?.map((stop,i)=><small className="admin-ko-caption" key={i}>경유 {i+1} · {stop.place?.name||stop.location}</small>)}
                  </div>)}</section>
                  <section className="admin-section"><h3>예약 요금</h3><div className="admin-money"><span>서비스 금액 · {current.tax_included===true?'세금 포함':current.tax_included===false?'세금 별도':'세금 확인 필요'}</span><strong>{moneyKo(current.quoted_total)}</strong></div></section>
                  {['confirmed','in_progress','completed','cancelled'].includes(current.status)&&<section className="admin-section"><h3><Mail size={16}/> 고객에게 보낸 안내</h3>
                    {delivery?<><div className="admin-money"><span>확정 이메일</span><strong>{deliveryLabels[delivery.status]||delivery.status}</strong></div>
                      {delivery.sent_at&&<p className="admin-ko-caption">{dateKo(delivery.sent_at)} 발송 요청이 Gmail에 전달됐어요.</p>}
                      {['uncertain','sending'].includes(delivery.status)&&<p className="admin-ko-caption">중복 발송을 막기 위해 자동 재발송하지 않아요. Gmail 보낸편지함에서 먼저 확인해 주세요.</p>}
                      {canEdit&&<div className="admin-ko-actions"><button type="button" className="admin-action-secondary" disabled={previewPending||pending} onClick={()=>void openPreview(true)}><FileText size={14}/> 확인서 및 이메일 보기</button>
                        {['pending','failed'].includes(delivery.status)&&current.status!=='cancelled'&&<button type="button" className="admin-action-primary" disabled={pending} onClick={()=>void retry()}>확정 이메일 다시 보내기</button>}</div>}
                    </>:<><p className="admin-ko-caption">아직 확정 이메일 발송 기록이 없어요.</p>{canEdit&&current.status==='confirmed'&&<button type="button" className="admin-secondary" disabled={previewPending||pending} onClick={()=>void openPreview()}>확정 이메일 준비하기</button>}</>}
                  </section> 
                </div>
              </>}
            </section>
          </div>
        </>
      </div>
    </main>
    {preview&&current?.id===previewId&&<dialog ref={confirmationDialog} className="admin-confirmation-modal" aria-labelledby="confirmation-modal-title" onCancel={e=>{e.preventDefault();if(!pending)setPreview(null)}}>
        <header><div><span className="admin-ko-eyebrow">{preview.reference}</span><h2 id="confirmation-modal-title">{previewReadOnly?'확정 안내 내용':'예약을 확정할까요?'}</h2></div><button type="button" aria-label="닫기" disabled={pending} onClick={()=>setPreview(null)}><X size={18}/></button></header>
        {!previewReadOnly&&<p className="admin-ko-caption">고객에게 보낼 이메일과 PDF 확인서를 먼저 확인해 주세요.</p>}
        <div className="admin-confirmation-meta"><small>받는 사람</small><strong>{preview.to}</strong><small>제목</small><strong>{preview.subject}</strong><small>서비스 금액</small><strong>{moneyKo(preview.total)} · {preview.taxIncluded?'세금 포함':'세금 별도'}</strong></div>
        {!previewReadOnly&&<label className="admin-confirmation-payment">결제 안내<select value={paymentMethod} disabled={previewPending||pending} onChange={e=>{const method=e.target.value as 'on_site'|'separate';setPaymentMethod(method);void openPreview(false,method)}}><option value="on_site">현장결제</option><option value="separate">고객과 별도 협의</option></select></label>}
        <iframe title="고객용 확정 이메일 미리보기" sandbox="" srcDoc={preview.html} className="admin-confirmation-email"/>
        <button className="admin-secondary" type="button" onClick={()=>downloadConfirmation(preview)}><FileText size={16}/> {preview.filename} 확인서 받기</button>
        {!previewReadOnly&&<><p className="admin-ko-caption">{preview.mailConfigured?'확정 후 이메일이 전송돼요. 차량·기사 배정은 필요하지 않아요.':'이메일 발송 환경을 먼저 설정해 주세요.'}</p><button className="admin-primary" type="button" disabled={pending||previewPending||!preview.mailConfigured} onClick={()=>void sendConfirmation()}>{pending?'예약을 확정하고 있어요…':'예약 확정하고 이메일 보내기'} <ArrowRight size={15}/></button></>}
    </dialog>}
  </div>
}

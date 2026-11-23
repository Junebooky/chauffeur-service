import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, CreditCard, LogOut, Plus, RefreshCw, Search, ShieldCheck, Truck, UserRound } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import { bookingStatusKo, serviceKo, vehicleKo, moneyKo, dateKo, dayKo, nextActions } from './admin-locale'
import './admin.css'
import './admin-korean.css'

type Session = { access_token:string; refresh_token:string }
type Reservation = {
  id:string; reference:string;customer_name:string;customer_email:string;customer_phone:string;
  status:string;customer_type:string;quoted_total:number|null;quote_required:boolean;created_at:string;
  contact_method:string;messenger_contact:string|null; company_name:string|null;
}
type Journey = {
  id:string;reservation_id:string;position:number;service_date:string;pickup_time:string;
  service_code:string;vehicle_class:string;pickup_address:string;destination_address:string;
  flight_number:string|null
}
type Assignment = {id:string;reservation_day_id:string;status:string;supplier_id:string|null;driver_id:string|null}
type Partner = {id:string;company_name:string}
type Driver = {id:string;full_name:string}
type Payment = {id:string;reservation_id:string;kind:string;method:string;status:string;amount:number;created_at:string}
type Snapshot = {role:string;reservations:Reservation[];days:Journey[];assignments:Assignment[];suppliers:Partner[];drivers:Driver[];payments:Payment[]}

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
  const [tab,setTab]=useState<'reservations'|'partners'>('reservations')
  const [supplierName,setSupplierName]=useState('')
  const [driverName,setDriverName]=useState('')
  const [paymentAmount,setPaymentAmount]=useState('')
  const [paymentMethod,setPaymentMethod]=useState('bank_transfer')
  const [paymentKind,setPaymentKind]=useState('deposit')
  const [assignFor,setAssignFor]=useState('')
  const [supplier,setSupplier]=useState('')
  const [driver,setDriver]=useState('')
  const [readyToAssign,setReadyToAssign]=useState(false)

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
  const signOut=()=>{sessionStorage.removeItem(SESSION_KEY);setSession(null);setSnapshot(null)}
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
    (filter==='all'||r.status===filter)&&[r.reference,r.customer_name,r.customer_email].some(s=>s.toLowerCase().includes(search.toLowerCase()))
  ),[reservations,search,filter])
  const current=reservations.find(r=>r.id===selectedId)||null
  const days=(snapshot?.days||[]).filter(d=>d.reservation_id===selectedId).sort((a,b)=>a.position-b.position)
  const payments=(snapshot?.payments||[]).filter(p=>p.reservation_id===selectedId)
  const canEdit=!!snapshot&&['owner','admin','operator'].includes(snapshot.role)
  const canPay=!!snapshot&&['owner','admin','finance'].includes(snapshot.role)
  const received=payments.filter(p=>p.status==='paid'&&p.kind!=='refund').reduce((sum,p)=>sum+Number(p.amount),0)
  const stats=[
    ['새 예약',reservations.filter(r=>r.status==='requested').length],
    ['확인 중',reservations.filter(r=>['reviewing','quoted'].includes(r.status)).length],
    ['입금 대기',reservations.filter(r=>r.status==='awaiting_deposit').length],
    ['확정된 예약',reservations.filter(r=>['confirmed','in_progress'].includes(r.status)).length],
  ] as const
  const change=(status:string)=>{
    if(!current)return
    const irreversible=['confirmed','declined','cancelled','completed'].includes(status)
    if(irreversible&&!window.confirm(
      status==='confirmed'?'이 예약을 확정할까요?\n차량·기사 배정 여부와 관계없이 예약 상태가 확정으로 변경돼요.'
      :status==='cancelled'?'예약을 취소할까요?'
      :status==='declined'?'이 예약을 거절할까요?':'서비스를 완료 처리할까요?'))return
    void mutate({action:'advance',reservation_id:current.id,expected_status:current.status,status},
      status==='confirmed'?'예약이 확정됐어요. 이제 차량과 기사를 준비해 주세요.':'예약 상태를 변경했어요.')
  }
  if(!session)return <AuthGate onLogin={s=>{setStored(s);setSession(s);setSnapshot(null)}}/>
  return <div className="admin-root admin-ko">
    <aside className="admin-sidebar">
      <div className="admin-logo"><span className="admin-ko-mark">J</span><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <p className="admin-sidebar-eyebrow">운영 관리</p>
      <button className={tab==='reservations'?'selected':''} onClick={()=>setTab('reservations')}><ClipboardList size={17}/> 예약 관리</button>
      <button className={tab==='partners'?'selected':''} onClick={()=>setTab('partners')}><Truck size={17}/> 협력 업체 · 기사</button>
      <div className="admin-sidebar-bottom"><span><ShieldCheck size={14}/> 관리자 권한 · {snapshot?.role||'확인 중'}</span><a href="/admin">예약 현황만 보기 <ArrowRight size={13}/></a><button onClick={signOut}><LogOut size={15}/> 로그아웃</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>CHAUFFEUR / {tab==='reservations'?'예약 관리':'협력사 관리'}</span><button disabled={loading} onClick={()=>void refresh()}><RefreshCw size={14}/> 새로고침</button></header>
      <div className="admin-content">
        {error&&<div className="admin-error admin-banner" role="alert">{error}<button onClick={()=>setError('')}>닫기</button></div>}
        {message&&<div className="admin-success admin-banner" role="status">{message}<button onClick={()=>setMessage('')}>닫기</button></div>}
        {tab==='reservations'?<>
          <div className="admin-heading"><div><SectionEyebrow>예약 운영</SectionEyebrow><DisplayHeading as="h1">예약 업무, 여기서 끝내요.</DisplayHeading><p>먼저 예약을 확인하고 승인해 주세요. 배차는 나중에 해도 괜찮아요.</p></div><span className="admin-count">실제 예약 {reservations.length}건</span></div>
          <div className="admin-stats">{stats.map(([label,count])=><div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div>
          <div className="admin-board">
            <section className="admin-list">
              <div className="admin-panel-heading"><h2>예약 요청</h2><span>최신 {reservations.length}건</span></div>
              <div className="admin-filters"><div className="admin-search"><Search size={15}/><input aria-label="예약 검색" placeholder="예약번호 또는 고객명 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="admin-select-wrap"><select value={filter} aria-label="예약 상태" onChange={e=>setFilter(e.target.value)}><option value="all">전체 상태</option>{Object.entries(bookingStatusKo).map(([status,name])=><option value={status} key={status}>{name}</option>)}</select><ChevronDown size={14}/></div></div>
              {loading&&!snapshot?<Empty>예약을 불러오고 있어요…</Empty>:!items.length?<Empty>{reservations.length?'조건에 맞는 예약이 없어요.':'아직 접수된 예약이 없어요.'}</Empty>:<div className="admin-booking-list">{items.map(r=><button key={r.id} className={'admin-booking '+(r.id===selectedId?'active':'')} onClick={()=>{setSelectedId(r.id);setReadyToAssign(false);setAssignFor('')}}><div><strong>{r.reference}</strong><span>{r.customer_name}</span><small>{dateKo(r.created_at)}</small></div><div className="admin-booking-right"><span className={'admin-status '+r.status}>{bookingStatusKo[r.status]||r.status}</span></div></button>)}</div>}
            </section>
            <section className="admin-detail">
              {!current?<Empty>왼쪽에서 예약을 선택해 주세요.</Empty>:<>
                <div className="admin-panel-heading"><div><span className="admin-eyebrow">예약 상세</span><h2>{current.reference}</h2></div><span className={'admin-status '+current.status}>{bookingStatusKo[current.status]||current.status}</span></div>
                <div className="admin-detail-scroll">
                  <section className="admin-section admin-ko-step"><span className="admin-ko-eyebrow">지금 할 일</span><h3>{current.status==='requested'?'새 예약이 도착했어요.':current.status==='awaiting_deposit'?'입금 확인 후 확정해 주세요.':current.status==='confirmed'?'이제 실제 차량과 기사를 준비해 주세요.':current.status==='completed'?'서비스가 완료됐어요.':'예약 진행 상태를 확인해 주세요.'}</h3>
                    <p className="admin-ko-caption">차량 번호판이나 특정 기사를 등록하지 않아도 예약을 먼저 확정할 수 있어요.</p>
                    {canEdit&&<div className="admin-ko-actions">{(nextActions[current.status]||[]).map(a=><button type="button" key={a.to} disabled={pending} className={'admin-action-'+a.style} title={a.hint} onClick={()=>change(a.to)}>{pending?'처리하고 있어요…':a.label}{a.style==='primary'&&<ArrowRight size={15}/>}</button>)}</div>}
                    {!canEdit&&<p className="admin-ko-caption">이 계정은 예약 변경 권한이 없어요.</p>}
                  </section>
                  <section className="admin-section"><h3>고객 정보</h3><div className="admin-info-grid"><div><small>예약자</small><strong>{current.customer_name}</strong></div><div><small>전화번호</small><strong>{current.customer_phone}</strong></div><div className="wide"><small>이메일</small><strong>{current.customer_email}</strong></div>{current.company_name&&<div className="wide"><small>기업명</small><strong>{current.company_name}</strong></div>}</div></section>
                  <section className="admin-section"><h3>이동 일정 <span>총 {days.length}일</span></h3>{days.map((d,i)=><div className="admin-ko-day" key={d.id}><div className="admin-day-top"><span>DAY {String(d.position).padStart(2,'0')}</span><strong>{dayKo(d.service_date)} · {d.pickup_time.slice(0,5)}</strong></div><h4>{vehicleKo(d.vehicle_class)} · {serviceKo(d.service_code)}</h4><div className="admin-ko-route"><span>{d.pickup_address}</span><ArrowRight size={13}/><span>{d.destination_address}</span></div>{d.flight_number&&<small>항공편 {d.flight_number}</small>}
                    <div className="admin-ko-assign-label"><span>{(snapshot?.assignments||[]).some(a=>a.reservation_day_id===d.id&&['assigned','confirmed'].includes(a.status))?'배차 등록됨':'차량·기사 미배정 · 지금은 괜찮아요'}</span>{canEdit&&<button type="button" className="admin-text-link" onClick={()=>{setAssignFor(assignFor===d.id?'':d.id);setReadyToAssign(true);setSupplier('');setDriver('')}}>{assignFor===d.id?'닫기':'배차 정보 등록'}</button>}</div>
                    {readyToAssign&&assignFor===d.id&&<div className="admin-ko-assign-form"><p>차량과 기사가 정해졌을 때만 등록해 주세요.</p><label>차량 공급업체<select value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">나중에 선택</option>{snapshot?.suppliers.map(p=><option value={p.id} key={p.id}>{p.company_name}</option>)}</select></label><label>담당 기사<select value={driver} onChange={e=>setDriver(e.target.value)}><option value="">나중에 선택</option>{snapshot?.drivers.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select></label><button type="button" className="admin-secondary" disabled={pending} onClick={()=>void mutate({action:'assignment',reservation_day_id:d.id,status:'assigned',supplier_id:supplier,driver_id:driver},'배차 정보를 저장했어요.')}>배차 저장</button></div>}
                  </div>)}</section>
                  <section className="admin-section"><h3><CreditCard size={16}/> 결제 확인</h3><div className="admin-money"><span>예약 금액</span><strong>{moneyKo(current.quoted_total)}</strong></div><div className="admin-money"><span>확인된 입금액</span><strong>{canPay?moneyKo(received):'권한 필요'}</strong></div>
                    {canPay&&<><p className="admin-ko-caption">은행이나 PayPal에서 실제 입금을 확인한 다음 기록해 주세요. 입금 기록이 없어도 예약 확정은 가능해요.</p><div className="admin-ko-payment-list">{payments.map(p=><div key={p.id}><span>{p.kind==='deposit'?'예약금':'잔금'} · {p.status==='paid'?'입금 확인':'입금 요청'}</span><strong>{moneyKo(Number(p.amount))}</strong></div>)}</div><form className="admin-ko-payment-form" onSubmit={e=>{e.preventDefault();void mutate({action:'payment',reservation_id:current.id,kind:paymentKind,method:paymentMethod,status:'paid',amount:Number(paymentAmount)},'입금 기록을 저장했어요.');setPaymentAmount('')}}><label>구분<select value={paymentKind} onChange={e=>setPaymentKind(e.target.value)}><option value="deposit">예약금</option><option value="balance">잔금</option><option value="full">전액</option></select></label><label>입금 방법<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="bank_transfer">계좌이체</option><option value="paypal_invoice">PayPal</option><option value="international_wire">해외송금</option><option value="other">기타</option></select></label><label>확인한 금액 (원)<input required type="number" min="1" step="1" placeholder="금액 입력" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><button type="submit" disabled={pending||!Number(paymentAmount)} className="admin-secondary"><Check size={15}/> 입금 확인 기록</button></form></>}
                  </section>
                </div>
              </>}
            </section>
          </div>
        </>:<>
          <div className="admin-heading"><div><SectionEyebrow>운영 네트워크</SectionEyebrow><DisplayHeading as="h1">협력사 관리</DisplayHeading><p>차량과 기사가 확정되면 등록하면 돼요. 예약 승인에는 필요하지 않아요.</p></div></div>
          <div className="admin-partner-grid">
            <section className="admin-partner-panel"><h2><Truck size={17}/> 차량 공급업체 <span>{snapshot?.suppliers.length||0}</span></h2>{snapshot?.suppliers.map(p=><div className="admin-partner-line" key={p.id}><strong>{p.company_name}</strong></div>)}{!snapshot?.suppliers.length&&<Empty>아직 등록된 업체가 없어요.</Empty>}{canEdit&&<form className="admin-stack" onSubmit={e=>{e.preventDefault();void mutate({action:'supplier',company_name:supplierName},'차량 업체를 등록했어요.');setSupplierName('')}}><label>업체 이름<input required placeholder="예: 협력 차량 업체" value={supplierName} onChange={e=>setSupplierName(e.target.value)}/></label><button type="submit" className="admin-secondary" disabled={pending}><Plus size={15}/> 업체 등록</button></form>}</section>
            <section className="admin-partner-panel"><h2><UserRound size={17}/> 의전 기사 <span>{snapshot?.drivers.length||0}</span></h2>{snapshot?.drivers.map(p=><div className="admin-partner-line" key={p.id}><strong>{p.full_name}</strong></div>)}{!snapshot?.drivers.length&&<Empty>아직 등록된 기사가 없어요.</Empty>}{canEdit&&<form className="admin-stack" onSubmit={e=>{e.preventDefault();void mutate({action:'driver',full_name:driverName},'기사를 등록했어요.');setDriverName('')}}><label>기사 이름<input required placeholder="기사 이름 입력" value={driverName} onChange={e=>setDriverName(e.target.value)}/></label><button type="submit" className="admin-secondary" disabled={pending}><Plus size={15}/> 기사 등록</button></form>}</section>
          </div>
        </>}
      </div>
    </main>
  </div>
}

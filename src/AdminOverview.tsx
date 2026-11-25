import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ClipboardList, RefreshCw, Search, ShieldCheck, Truck } from 'lucide-react'
import AdminBrand from './components/ui/AdminBrand'
import { bookingStatusKo, serviceKo, vehicleKo, dateKo } from './admin-locale'
import Admin from './Admin'
import './admin.css'
import './admin-overview.css'
import './admin-korean.css'

type Entry = {
  number:number;maskedReference:string;status:string;createdAt:string;
  dayCount:number;
  service:string|null;fleet:string|null
}
type Board = {
  scope:string;updatedAt:string;
  metrics:{requests:number;new:number;sourcing:number;confirmed:number};
  reservations:Entry[]
}
const steps=[
  {name:'요청 접수',hint:'고객이 예약을 보냈어요.'},
  {name:'예약 확정',hint:'관리자가 확정해요. 차량과 기사는 나중에 준비해요.'},
  {name:'서비스 진행',hint:'예약된 일정대로 서비스를 제공해요.'}
]
const stageIndex=(item:Entry)=>{
  if(['completed','in_progress'].includes(item.status)) return 2
  if(item.status==='confirmed') return 1
  if(['reviewing','quoted','awaiting_deposit'].includes(item.status))return 0
  if(item.status==='cancelled'||item.status==='declined')return 0
  return 0
}
export default function AdminOverview(){
  const [manage,setManage]=useState(false)
  const [board,setBoard]=useState<Board|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [selected,setSelected]=useState<number|null>(null)
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const refresh=useCallback(async(silent=false)=>{
    if(!silent)setBusy(true)
    try{
      const response=await fetch('/api/admin-overview',{method:'GET',headers:{Accept:'application/json'},cache:'no-store'})
      const data=await response.json()
      if(!response.ok||!Array.isArray(data.reservations))throw new Error(data.error||'예약 정보를 불러올 수 없어요.')
      setBoard(data as Board);setError('')
      setSelected(prev=>prev!==null&&data.reservations.some((r:Entry)=>r.number===prev)
        ? prev : data.reservations[0]?.number??null)
    }catch(err){setError(err instanceof Error?err.message:'예약 정보를 불러오지 못했어요.')}
    finally{setBusy(false)}
  },[])
  useEffect(()=>{
    void refresh()
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh(true)},30000)
    return ()=>window.clearInterval(timer)
  },[refresh])
  const rows=board?.reservations||[]
  const filtered=useMemo(()=>rows.filter(row=>
    (filter==='all'||row.status===filter||filter==='reviewing'&&['quoted','awaiting_deposit'].includes(row.status))&&[row.maskedReference,serviceKo(row.service),vehicleKo(row.fleet)].some(s=>s.toLowerCase().includes(search.toLowerCase()))
  ),[rows,filter,search])
  const current=rows.find(row=>row.number===selected)||null
  if(manage)return <Admin/>
  const stats=[
    ['새 예약',board?.metrics.new??0],
    ['확인 중',board?.metrics.sourcing??0],
    ['확정된 예약',board?.metrics.confirmed??0]
  ] as const
  return <div className="admin-root admin-overview admin-ko">
    <aside className="admin-sidebar">
      <AdminBrand />
      <p className="admin-sidebar-eyebrow">운영 현황</p>
      <button className="selected" type="button"><ClipboardList size={16}/> 예약 현황</button>
      <button type="button" onClick={()=>setManage(true)}><Truck size={16}/> 예약 처리하기 <ArrowRight size={12}/></button>
      <div className="admin-sidebar-bottom"><span><ShieldCheck size={14}/> 예약 현황은 안전하게 표시돼요</span><a href="/">고객 예약 페이지 <ArrowRight size={13}/></a></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>CHAUFFEUR / 예약 현황</span><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14}/> 새로고침</button></header>
      <div className="admin-content admin-overview-content">
        {error&&<div className="admin-error admin-banner" role="alert">{error}<button onClick={()=>void refresh()}>다시 시도</button></div>}
        <div className="admin-stats">{stats.map(([name,n])=><div key={name}><span>{name}</span><strong>{n}</strong></div>)}</div>
        <div className="admin-board">
          <section className="admin-list">
            <div className="admin-panel-heading"><h2>들어온 예약</h2><span>최근 100건</span></div>
            <div className="admin-filters"><div className="admin-search"><Search size={15}/><input aria-label="예약 검색" placeholder="예약번호나 서비스로 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="admin-select-wrap"><select aria-label="예약 상태" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">전체 상태</option>{Object.entries(bookingStatusKo).filter(([k])=>!['quoted','awaiting_deposit'].includes(k)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div></div>
            {!board&&!error?<div className="admin-empty">예약 정보를 가져오고 있어요…</div>
            :filtered.length===0?<div className="admin-empty"><CalendarDays size={24}/><strong>{rows.length?'조건에 맞는 예약이 없어요.':'아직 들어온 예약이 없어요.'}</strong><span>{rows.length?'검색어를 바꿔 보세요.':'고객이 예약을 보내면 이곳에 바로 나타나요.'}</span></div>
            :<div className="admin-booking-list">{filtered.map(r=><button key={r.number} className={'admin-booking '+(r.number===selected?'active':'')} onClick={()=>setSelected(r.number)}><div><strong>{r.maskedReference}</strong><span>{serviceKo(r.service)}</span><small>{r.dayCount}일 일정</small></div><div className="admin-booking-right"><span className={'admin-status '+r.status}>{bookingStatusKo[r.status]||r.status}</span><small>{dateKo(r.createdAt)}</small></div></button>)}</div>}
          </section>
          <section className="admin-detail">
            {!current?<div className="admin-empty"><ClipboardList size={24}/><strong>예약을 선택해 주세요.</strong><span>새 예약이 들어오면 바로 처리할 수 있어요.</span></div>:<>
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">예약 진행 현황</span><h2>{current.maskedReference}</h2></div><span className={'admin-status '+current.status}>{bookingStatusKo[current.status]||current.status}</span></div>
              <div className="admin-detail-scroll">
                <section className="admin-section"><h3>예약 정보</h3><div className="admin-info-grid"><div><small>서비스</small><strong>{serviceKo(current.service)}</strong></div><div><small>차량 유형</small><strong>{vehicleKo(current.fleet)}</strong></div><div><small>이동 일정</small><strong>총 {current.dayCount}일</strong></div><div><small>접수 시간</small><strong>{dateKo(current.createdAt)}</strong></div></div></section>
                <section className="admin-section"><h3>현재 진행 단계</h3><div className="admin-live-timeline">{steps.map((step,i)=>{
                  const done=i<=stageIndex(current)
                  return <div className={'admin-live-stage '+(done?'done':'')} key={step.name}><span className="admin-live-node">{done?<Check size={12}/>:i+1}</span><div><strong>{step.name}</strong><small>{step.hint}</small></div></div>
                })}</div></section>

              </div>
            </>}
          </section>
        </div>
        <div className="admin-live-footer"><ShieldCheck size={15}/> 고객 정보는 공개되지 않아요. 예약 확정은 관리자 인증 후 진행해요.</div>
      </div>
    </main>
  </div>
}
